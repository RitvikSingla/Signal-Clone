"use client";

/**
 * The scrolling thread.
 *
 * Two behaviours that are easy to get wrong and very obvious when they are:
 * the view sticks to the bottom as messages arrive, unless the reader has
 * scrolled up to read history; and paging older messages upward preserves
 * the scroll position rather than jumping.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { LockIcon } from "@/components/ui/Icons";
import { dayDivider, isSameDay } from "@/lib/format";
import type { Message } from "@/lib/types";

type MessageListProps = {
  messages: Message[];
  currentUserId: string;
  isGroup: boolean;
  hasMore: boolean;
  loading: boolean;
  conversationId: string;
  typingPeople: { userId: string; displayName: string }[];
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
};

/** Consecutive messages from one sender within this window form a run. */
const RUN_WINDOW_MS = 5 * 60 * 1000;

export function MessageList({
  messages,
  currentUserId,
  isGroup,
  hasMore,
  loading,
  conversationId,
  typingPeople,
  onLoadOlder,
  onReply,
  onReact,
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const previousHeight = useRef(0);
  const previousCount = useRef(0);

  // Jump to the newest message when the thread changes.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    setPinnedToBottom(true);
    previousCount.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const grew = messages.length > previousCount.current;
    const prependedOlder = grew && previousHeight.current > 0 && !pinnedToBottom;

    if (prependedOlder) {
      // Keep the reader looking at the same message after older ones load.
      element.scrollTop = element.scrollHeight - previousHeight.current;
    } else if (pinnedToBottom) {
      element.scrollTop = element.scrollHeight;
    }

    previousHeight.current = element.scrollHeight;
    previousCount.current = messages.length;
  }, [messages, pinnedToBottom, typingPeople.length]);

  // Page older messages when the reader reaches the top.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    function handleScroll() {
      const node = scroller.current;
      if (!node) return;
      const distanceFromBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      setPinnedToBottom(distanceFromBottom < 80);
      if (node.scrollTop < 120 && hasMore && !loading) onLoadOlder();
    }

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, onLoadOlder]);

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
    >
      <div className="mx-auto flex w-full max-w-thread flex-col">
        {!hasMore && <EncryptionNotice />}

        {hasMore && (
          <div className="py-3 text-center text-[12px] text-ink-3">
            {loading ? "Loading earlier messages…" : "Scroll up for more"}
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const mine = message.sender?.id === currentUserId;

          const needsDivider =
            !previous || !isSameDay(previous.created_at, message.created_at);

          if (message.type === "system") {
            return (
              <div key={message.id}>
                {needsDivider && <DateDivider iso={message.created_at} />}
                <SystemMessage text={message.body ?? ""} />
              </div>
            );
          }

          const startsRun =
            needsDivider ||
            !previous ||
            previous.type === "system" ||
            previous.sender?.id !== message.sender?.id ||
            new Date(message.created_at).getTime() -
              new Date(previous.created_at).getTime() >
              RUN_WINDOW_MS;

          const endsRun =
            !next ||
            next.type === "system" ||
            next.sender?.id !== message.sender?.id ||
            !isSameDay(next.created_at, message.created_at) ||
            new Date(next.created_at).getTime() -
              new Date(message.created_at).getTime() >
              RUN_WINDOW_MS;

          return (
            <div key={message.id}>
              {needsDivider && <DateDivider iso={message.created_at} />}
              <MessageBubble
                message={message}
                mine={mine}
                isGroup={isGroup}
                startsRun={startsRun}
                endsRun={endsRun}
                onReply={onReply}
                onReact={onReact}
              />
            </div>
          );
        })}

        <TypingIndicator people={typingPeople} isGroup={isGroup} />
      </div>
    </div>
  );
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-2">
        {dayDivider(iso)}
      </span>
    </div>
  );
}

function SystemMessage({ text }: { text: string }) {
  return (
    <div className="my-2 flex justify-center">
      <span className="max-w-[80%] text-center text-[12px] leading-snug text-ink-2">
        {text}
      </span>
    </div>
  );
}

function EncryptionNotice() {
  return (
    <div className="mx-auto my-4 flex max-w-[82%] items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-center">
      <LockIcon className="mt-0.5 shrink-0 text-ink-3" />
      <p className="text-left text-[12px] leading-snug text-ink-2">
        Messages in this conversation are end-to-end encrypted. This clone
        simulates the protocol rather than implementing it.
      </p>
    </div>
  );
}
