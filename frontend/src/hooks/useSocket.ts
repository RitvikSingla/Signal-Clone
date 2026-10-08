"use client";

/**
 * Owns the single socket connection and routes its frames into the store.
 *
 * One instance per signed-in session. The ref guard matters in development:
 * React strict mode runs effects twice, and without it the app would open
 * two sockets and the presence flag would flap.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { SignalSocket, type ServerFrame, type SocketStatus } from "@/lib/socket";
import type { ConversationSummary, Message } from "@/lib/types";
import { useChat } from "@/store/chat";

/** How long a typing indicator survives without a refresh from the sender. */
const TYPING_TIMEOUT_MS = 6000;

export function useSocket(enabled: boolean) {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<SignalSocket | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const handleFrame = useCallback((frame: ServerFrame) => {
    const store = useChat.getState();

    switch (frame.type) {
      case "message.new":
        store.upsertMessage(frame.message as Message);
        break;

      case "message.updated":
        store.upsertMessage(frame.message as Message);
        break;

      case "message.status":
        store.applyStatus(
          frame.conversation_id,
          frame.message_id,
          frame.status as Message["status"],
        );
        break;

      case "typing": {
        store.setTyping(
          frame.conversation_id,
          frame.user_id,
          frame.display_name,
          frame.is_typing,
        );
        // Signal's indicator fades on its own if the sender goes quiet
        // without ever sending a stop frame, which happens when a tab is
        // closed mid-sentence.
        const key = `${frame.conversation_id}:${frame.user_id}`;
        const existing = typingTimers.current.get(key);
        if (existing) clearTimeout(existing);
        if (frame.is_typing) {
          typingTimers.current.set(
            key,
            setTimeout(() => {
              useChat
                .getState()
                .setTyping(frame.conversation_id, frame.user_id, frame.display_name, false);
              typingTimers.current.delete(key);
            }, TYPING_TIMEOUT_MS),
          );
        } else {
          typingTimers.current.delete(key);
        }
        break;
      }

      case "presence":
        store.applyPresence(frame.user_id, frame.is_online, frame.last_seen_at);
        break;

      case "conversation.updated":
        store.applyConversation(frame.conversation as ConversationSummary);
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = new SignalSocket(token, {
      onFrame: handleFrame,
      onStatus: setStatus,
      // A reconnect may have missed frames. Rather than buffering on the
      // server, the client refetches, which is simpler and always correct.
      onResume: () => {
        void useChat.getState().loadConversations();
        const activeId = useChat.getState().activeId;
        if (activeId) void useChat.getState().openConversation(activeId);
      },
    });

    socketRef.current = socket;
    socket.connect();

    const timers = typingTimers.current;
    return () => {
      socket.close();
      socketRef.current = null;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, [enabled, handleFrame]);

  // Acknowledge arrival for anything that landed since the last tick. Batched
  // rather than sent per message, so a burst costs one frame.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const ids = useChat.getState().takePendingDelivery();
      if (ids.length) {
        socketRef.current?.send({ type: "message.delivered", message_ids: ids });
      }
    }, 800);
    return () => clearInterval(timer);
  }, [enabled]);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.send({
      type: isTyping ? "typing.start" : "typing.stop",
      conversation_id: conversationId,
    });
  }, []);

  return { status, sendTyping };
}
