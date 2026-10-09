"use client";

/**
 * The scrolling thread.
 *
 * Two behaviours that are easy to get wrong and very obvious when they are:
 * the view sticks to the bottom as messages arrive, unless the reader has
 * scrolled up to read history; and paging older messages upward preserves
 * the scroll position rather than jumping.
 *
 * Layout follows Signal Desktop: the conversation hero card first, a plain
 * centred day label ("Today"), incoming bubbles against the left edge and
 * outgoing against the right, with no column in the middle. An accepted
 * message request leaves its event line at the moment it was accepted.
 */

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { MessageBubble, type BubbleActions } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GroupIcon,
  PinIcon,
  ScrollDownIcon,
  TimerIcon,
} from "@/components/ui/Icons";
import { systemText } from "@/lib/groups";
import { useNow } from "@/hooks/useNow";
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
  hero: ReactNode;
  /** An event to slot into the timeline, such as "You accepted the request". */
  event: { at: string; node: ReactNode } | null;
  highlightId: string | null;
  /** Group member labels by user id, shown beside sender names. */
  labels?: Record<string, string>;
  /** This chat's outgoing bubble colour, when one is set. */
  outgoingColor?: string;
  unreadFromId: string | null;
  unreadCount: number;
  /** Ids ticked in selection mode; null when not selecting. */
  selection: string[] | null;
  onToggleSelected: (message: Message) => void;
  onLoadOlder: () => void;
  onJumpTo: (messageId: string) => void;
  actions: BubbleActions;
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
  hero,
  event,
  highlightId,
  labels,
  outgoingColor,
  unreadFromId,
  unreadCount,
  selection,
  onToggleSelected,
  onLoadOlder,
  onJumpTo,
  actions,
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const previousHeight = useRef(0);
  const previousCount = useRef(0);
  const now = useNow();

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
  }, [messages, pinnedToBottom, typingPeople.length, event?.at]);

  // The composer grows when a reply bar or staged files appear, which
  // shrinks this pane; stay on the newest message rather than letting the
  // bar cover it.
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let lastHeight = element.clientHeight;
    const observer = new ResizeObserver(() => {
      const node = scroller.current;
      if (!node) return;
      const shrunk = node.clientHeight < lastHeight;
      const gap = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (shrunk && gap < 80 + (lastHeight - node.clientHeight)) {
        node.scrollTop = node.scrollHeight;
      }
      lastHeight = node.clientHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Bring a search match into view.
  useEffect(() => {
    if (!highlightId) return;
    document
      .getElementById(`msg-${highlightId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId]);

  // Page older messages when the reader reaches the top.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    function handleScroll() {
      const node = scroller.current;
      if (!node) return;
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      setPinnedToBottom(distanceFromBottom < 80);
      if (node.scrollTop < 120 && hasMore && !loading) onLoadOlder();
    }

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, onLoadOlder]);

  // Where the event line goes: before the first message newer than it.
  const eventIndex = event
    ? (() => {
        const index = messages.findIndex((m) => m.created_at > event.at);
        return index === -1 ? messages.length : index;
      })()
    : -1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 md:px-5"
      >
        <div className="flex w-full flex-col">
          {!hasMore && hero}

          {hasMore && (
            <div className="py-3 text-center text-[12px] text-ink-2">
              {loading ? "Loading earlier messages…" : "Scroll up for more"}
            </div>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const mine = message.sender?.id === currentUserId;

            const needsDivider = !previous || !isSameDay(previous.created_at, message.created_at);

            const eventHere = index === eventIndex && event ? event.node : null;

            if (message.type === "system") {
              // Runs of two or more group updates fold into one line, as
              // Signal does; the first of the run renders the fold.
              const run = updateRunAt(messages, index);
              if (run && run.start !== index) return null;
              if (run) {
                return (
                  <Fragment key={message.id}>
                    {eventHere}
                    {needsDivider && <DateDivider iso={message.created_at} />}
                    <GroupUpdates
                      messages={messages.slice(run.start, run.end + 1)}
                      currentUserId={currentUserId}
                    />
                  </Fragment>
                );
              }
              return (
                <Fragment key={message.id}>
                  {eventHere}
                  {needsDivider && <DateDivider iso={message.created_at} />}
                  {message.event === "pinned" ? (
                    <PinnedEvent
                      who={
                        message.sender?.id === currentUserId
                          ? "You"
                          : (message.sender?.display_name ?? "Someone")
                      }
                      targetId={message.reply_to?.id ?? null}
                      onJumpTo={onJumpTo}
                    />
                  ) : (
                    <SystemMessage
                      text={systemText(message, currentUserId).text}
                      timer={message.event === "timer"}
                    />
                  )}
                </Fragment>
              );
            }

            const startsRun =
              needsDivider ||
              !previous ||
              previous.type === "system" ||
              previous.sender?.id !== message.sender?.id ||
              new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() >
                RUN_WINDOW_MS;

            const endsRun =
              !next ||
              next.type === "system" ||
              next.sender?.id !== message.sender?.id ||
              !isSameDay(next.created_at, message.created_at) ||
              new Date(next.created_at).getTime() - new Date(message.created_at).getTime() >
                RUN_WINDOW_MS;

            return (
              <Fragment key={message.id}>
                {eventHere}
                {needsDivider && <DateDivider iso={message.created_at} />}
                {message.id === unreadFromId && <UnreadDivider count={unreadCount} />}
                <MessageBubble
                  message={message}
                  mine={mine}
                  isGroup={isGroup}
                  currentUserId={currentUserId}
                  now={now}
                  highlighted={message.id === highlightId}
                  startsRun={startsRun}
                  endsRun={endsRun}
                  selecting={selection !== null}
                  selected={selection?.includes(message.id) ?? false}
                  onToggleSelected={onToggleSelected}
                  senderLabel={labels?.[message.sender?.id ?? ""] ?? null}
                  outgoingColor={outgoingColor}
                  actions={actions}
                />
              </Fragment>
            );
          })}

          {event && eventIndex === messages.length && event.node}

          <TypingIndicator people={typingPeople} isGroup={isGroup} />
        </div>
      </div>

      {!pinnedToBottom && (
        <button
          type="button"
          onClick={() => {
            const node = scroller.current;
            if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
          }}
          aria-label="Scroll to bottom"
          className="animate-pop-in absolute bottom-3 right-4 flex size-9 items-center justify-center rounded-full bg-surface-chip text-ink shadow-[0_2px_10px_rgba(0,0,0,0.35)] hover:brightness-110"
        >
          <ScrollDownIcon size={18} />
        </button>
      )}
    </div>
  );
}

/** "1 Unread Message", across the thread above the first unread one. */
function UnreadDivider({ count }: { count: number }) {
  return (
    <div className="my-3 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border-strong" />
      <span className="text-[12px] font-semibold text-ink">
        {count === 1 ? "1 Unread Message" : `${count} Unread Messages`}
      </span>
      <span className="h-px flex-1 bg-border-strong" />
    </div>
  );
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="my-3 text-center text-[12px] font-medium text-ink-2">{dayDivider(iso)}</div>
  );
}

/** "You pinned a message", with a button that jumps to it. */
function PinnedEvent({
  who,
  targetId,
  onJumpTo,
}: {
  who: string;
  targetId: string | null;
  onJumpTo: (messageId: string) => void;
}) {
  return (
    <div className="my-3 flex flex-col items-center gap-2 text-center">
      <p className="flex items-center gap-1.5 text-[12px] text-ink">
        <PinIcon size={14} strokeWidth={1.7} className="text-ink-2" />
        {who} pinned a message
      </p>
      {targetId && (
        <button
          type="button"
          onClick={() => onJumpTo(targetId)}
          className="rounded-full bg-surface-chip px-3 py-1 text-[12px] font-semibold text-link transition hover:brightness-110"
        >
          Go to message
        </button>
      )}
    </div>
  );
}

/**
 * Where a foldable run of group updates covers index, if anywhere. Pinned
 * events and timer changes stay on their own line, as in Signal.
 */
function updateRunAt(messages: Message[], index: number): { start: number; end: number } | null {
  const foldable = (m: Message | undefined) =>
    Boolean(m && m.type === "system" && m.event !== "pinned" && m.event !== "timer");
  if (!foldable(messages[index])) return null;
  let start = index;
  while (
    start > 0 &&
    foldable(messages[start - 1]) &&
    isSameDay(messages[start - 1].created_at, messages[index].created_at)
  )
    start -= 1;
  let end = index;
  while (
    end < messages.length - 1 &&
    foldable(messages[end + 1]) &&
    isSameDay(messages[end + 1].created_at, messages[index].created_at)
  )
    end += 1;
  return end > start ? { start, end } : null;
}

/** "👥 5 group updates ⌄", expanding to the list with a ⌃ under it. */
function GroupUpdates({ messages, currentUserId }: { messages: Message[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2.5 flex w-full flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full bg-surface-chip px-2.5 py-1 text-[12px] font-semibold text-ink hover:brightness-110"
      >
        <GroupIcon size={13} />
        {messages.length} group updates
        <ChevronDownIcon size={12} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <>
          {messages.map((m) => (
            <SystemMessage key={m.id} text={systemText(m, currentUserId).text} compact />
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse group updates"
            className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <ChevronUpIcon size={13} />
          </button>
        </>
      )}
    </div>
  );
}

function SystemMessage({
  text,
  timer = false,
  compact = false,
}: {
  text: string;
  timer?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "" : "my-2.5"} flex w-full justify-center`}>
      <span className="flex max-w-[min(90%,560px)] items-center gap-1.5 text-center text-[12px] leading-snug text-ink">
        {timer ? (
          <TimerIcon size={13} className="shrink-0 text-ink-2" />
        ) : (
          <GroupIcon size={13} className="shrink-0 text-ink-2" />
        )}
        {text}
      </span>
    </div>
  );
}
