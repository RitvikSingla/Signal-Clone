"use client";

/**
 * Microphone and camera access.
 *
 * Signal Desktop asks in its own small "Allow Access" window before the
 * operating system prompt, worded for what you were doing: calling, or
 * recording a voice message. This module owns that step. requestMedia()
 * shows the dialog (once; after a grant it goes straight to the browser),
 * then asks the browser, and resolves with a stream or null.
 */

import { create } from "zustand";

import { useToasts } from "@/components/ui/Toasts";
import { useUi } from "@/store/ui";

export type MediaPurpose = "voice-message" | "voice-call" | "video-call";

type Pending = { purpose: MediaPurpose; resolve: (allowed: boolean) => void } | null;

export const usePermissionPrompt = create<{
  pending: Pending;
  ask: (purpose: MediaPurpose) => Promise<boolean>;
  answer: (allowed: boolean) => void;
}>((set, get) => ({
  pending: null,
  ask: (purpose) =>
    new Promise<boolean>((resolve) => {
      // A second request while one is open replaces it; the first is a no.
      get().pending?.resolve(false);
      set({ pending: { purpose, resolve } });
    }),
  answer: (allowed) => {
    get().pending?.resolve(allowed);
    set({ pending: null });
  },
}));

export const PROMPT_TEXT: Record<MediaPurpose, string> = {
  "voice-message": "To send voice messages, allow Signal Desktop to access your microphone.",
  "voice-call": "For calling, you must allow Signal Desktop to access your microphone.",
  "video-call": "For calling, you must allow Signal Desktop to access your microphone.",
};

export async function requestMedia(purpose: MediaPurpose): Promise<MediaStream | null> {
  const ui = useUi.getState();
  if (!ui.micAllowed) {
    const allowed = await usePermissionPrompt.getState().ask(purpose);
    if (!allowed) return null;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    useToasts.getState().push("This browser can't use a microphone here. Use https or localhost.");
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: purpose === "video-call",
    });
    useUi.getState().setMicAllowed(true);
    return stream;
  } catch (error) {
    // The browser said no, or there is no device. Forget the earlier grant
    // so Signal's own explanation shows again next time.
    useUi.getState().setMicAllowed(false);
    const name = error instanceof DOMException ? error.name : "";
    useToasts
      .getState()
      .push(
        name === "NotFoundError"
          ? "No microphone was found."
          : "Signal can't use your microphone. Allow it in your browser's site settings.",
      );
    return null;
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}
