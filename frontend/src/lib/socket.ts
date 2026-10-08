"use client";

/**
 * The WebSocket client.
 *
 * A small class rather than a hook, so a single connection survives React
 * re-renders and strict-mode double effects. The hook in useSocket.ts owns
 * one instance and feeds its frames into the store.
 *
 * Reliability comes from three things:
 *   - a heartbeat, so a connection that has silently died is noticed
 *   - exponential backoff with jitter, so a server restart does not get
 *     hammered by every open tab at the same instant
 *   - replay on reconnect, which the store drives by refetching rather than
 *     the socket by buffering
 */

import { config } from "./config";

export type ServerFrame =
  | { type: "connected"; user_id: string; display_name: string }
  | { type: "pong" }
  | { type: "message.new"; conversation_id: string; message: unknown }
  | { type: "message.updated"; conversation_id: string; message: unknown }
  | {
      type: "message.status";
      conversation_id: string;
      message_id: string;
      status: string;
    }
  | {
      type: "typing";
      conversation_id: string;
      user_id: string;
      display_name: string;
      is_typing: boolean;
    }
  | { type: "presence"; user_id: string; is_online: boolean; last_seen_at: string }
  | { type: "conversation.updated"; conversation: unknown }
  | { type: "error"; detail: string };

export type SocketStatus = "connecting" | "open" | "closed";

const HEARTBEAT_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

type Handlers = {
  onFrame: (frame: ServerFrame) => void;
  onStatus: (status: SocketStatus) => void;
  /** Fired after a reconnect, so the caller can refetch what it missed. */
  onResume: () => void;
};

export class SignalSocket {
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closedByUs = false;
  private hasConnectedBefore = false;

  constructor(
    private readonly token: string,
    private readonly handlers: Handlers,
  ) {}

  connect(): void {
    this.closedByUs = false;
    this.handlers.onStatus("connecting");

    const url = `${config.wsUrl}?token=${encodeURIComponent(this.token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.handlers.onStatus("open");
      this.startHeartbeat();
      // A first connection has nothing to catch up on; a later one does.
      if (this.hasConnectedBefore) this.handlers.onResume();
      this.hasConnectedBefore = true;
    };

    socket.onmessage = (event) => {
      try {
        this.handlers.onFrame(JSON.parse(event.data) as ServerFrame);
      } catch {
        // A frame we cannot parse is not worth tearing the socket down for.
      }
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.handlers.onStatus("closed");
      if (!this.closedByUs) this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose always follows, which is where the reconnect is scheduled.
    };
  }

  send(frame: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    }
  }

  close(): void {
    this.closedByUs = true;
    this.stopHeartbeat();
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close();
    this.socket = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ type: "ping" }), HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private scheduleReconnect(): void {
    this.attempts += 1;
    // Exponential, capped, with jitter so tabs do not reconnect in lockstep.
    const base = Math.min(1000 * 2 ** (this.attempts - 1), MAX_BACKOFF_MS);
    const delay = base * (0.7 + Math.random() * 0.6);
    this.retry = setTimeout(() => this.connect(), delay);
  }
}
