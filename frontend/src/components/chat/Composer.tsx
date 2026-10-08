"use client";

/**
 * The message composer.
 *
 * Signal details reproduced here: the field is a pill, it grows with the
 * text up to a cap, Enter sends while Shift+Enter inserts a newline, and
 * the microphone becomes a send arrow the moment there is something to
 * send.
 */

import { useEffect, useRef, useState } from "react";

import {
  AttachIcon,
  CloseIcon,
  EmojiIcon,
  MicIcon,
  SendIcon,
} from "@/components/ui/Icons";
import type { Message } from "@/lib/types";

type ComposerProps = {
  replyingTo: Message | null;
  disabled?: boolean;
  onCancelReply: () => void;
  onSend: (body: string, replyToId: string | null) => void;
  onTyping: () => void;
};

const MAX_HEIGHT = 140;

/**
 * A draft belongs to its thread. Rather than clearing the field in an
 * effect when the conversation changes, the caller gives this component a
 * key of the conversation id, so React remounts it and the draft resets on
 * its own.
 */
export function Composer({
  replyingTo,
  disabled = false,
  onCancelReply,
  onSend,
  onTyping,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  // Focus the field when a reply starts, so the user can type immediately.
  useEffect(() => {
    if (replyingTo) field.current?.focus();
  }, [replyingTo]);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const hasText = value.trim().length > 0;

  function submit() {
    if (!hasText || disabled) return;
    onSend(value, replyingTo?.id ?? null);
    setValue("");
    onCancelReply();
    field.current?.focus();
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto w-full max-w-thread">
        {replyingTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-[3px] border-ultramarine bg-surface-sunken px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-ultramarine">
                Replying to {replyingTo.sender?.display_name ?? "Unknown"}
              </div>
              <div className="truncate text-[13px] text-ink-2">{replyingTo.body}</div>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="shrink-0 rounded-full p-1 text-ink-3 hover:bg-surface-hover hover:text-ink"
              aria-label="Cancel reply"
            >
              <CloseIcon size={15} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
            aria-label="Attach a file"
            title="Attachments arrive in a later phase"
          >
            <AttachIcon />
          </button>

          <div className="flex min-w-0 flex-1 items-end rounded-composer bg-surface-sunken px-3 py-1.5">
            <textarea
              id="composer-field"
              ref={field}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(event) => {
                setValue(event.target.value);
                onTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Message"
              className="max-h-[140px] w-full resize-none bg-transparent py-1 text-[15px] leading-[1.4] text-ink outline-none placeholder:text-ink-3"
            />
            <button
              type="button"
              className="mb-1 ml-2 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
              aria-label="Emoji"
              title="Emoji picker arrives in a later phase"
            >
              <EmojiIcon size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!hasText || disabled}
            className={`mb-1 flex size-9 shrink-0 items-center justify-center rounded-full transition-all ${
              hasText
                ? "bg-ultramarine text-white hover:bg-ultramarine-hover"
                : "text-ink-2"
            }`}
            aria-label={hasText ? "Send" : "Record a voice message"}
          >
            {hasText ? <SendIcon /> : <MicIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
