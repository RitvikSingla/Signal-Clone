"use client";

/**
 * One message bubble.
 *
 * Three Signal details this reproduces:
 *   - 18px radius everywhere except the tail corner of a run from the same
 *     sender, which drops to 4px
 *   - the timestamp and check marks sit inside the bubble, bottom right, on
 *     the same baseline, and only on the last message of a run
 *   - reactions overlap the bottom edge of the bubble rather than sitting
 *     below it
 */

import { ReplyIcon, TickIcon } from "@/components/ui/Icons";
import { clockTime } from "@/lib/format";
import type { Message } from "@/lib/types";

type MessageBubbleProps = {
  message: Message;
  mine: boolean;
  isGroup: boolean;
  /** First of a run from this sender: shows the name and the full radius. */
  startsRun: boolean;
  /** Last of a run: carries the tail, the timestamp and the ticks. */
  endsRun: boolean;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
};

/** The five Signal offers on the hover bar, in the same order. */
const QUICK_REACTIONS = ["❤️", "\u{1F44D}", "\u{1F602}", "\u{1F62E}", "\u{1F622}"];

export function MessageBubble({
  message,
  mine,
  isGroup,
  startsRun,
  endsRun,
  onReply,
  onReact,
}: MessageBubbleProps) {
  const deleted = message.deleted_at !== null;

  const tail = mine
    ? endsRun
      ? "rounded-br-bubble-tail"
      : ""
    : endsRun
      ? "rounded-bl-bubble-tail"
      : "";

  return (
    <div
      className={`group flex w-full gap-2 ${mine ? "justify-end" : "justify-start"} ${
        endsRun ? "mb-2" : "mb-0.5"
      }`}
    >
      {mine && <HoverActions message={message} onReply={onReply} onReact={onReact} align="left" />}

      <div className={`flex max-w-[68%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`relative rounded-bubble px-3 py-[7px] ${tail} ${
            mine
              ? "bg-bubble-out text-bubble-out-ink"
              : "bg-bubble-in text-bubble-in-ink"
          } ${message.reactions.length > 0 ? "mb-3" : ""}`}
        >
          {isGroup && !mine && startsRun && message.sender && (
            <div
              className="mb-0.5 text-[13px] font-semibold"
              style={{ color: `var(--${message.sender.avatar_color.toLowerCase()})` }}
            >
              {message.sender.display_name}
            </div>
          )}

          {message.reply_to && <QuotedStrip quoted={message.reply_to} mine={mine} />}

          <div className="flex flex-wrap items-end gap-x-2">
            <p
              className={`whitespace-pre-wrap break-words text-[15px] leading-[1.35] ${
                deleted ? "italic opacity-70" : ""
              }`}
            >
              {deleted ? "This message was deleted" : message.body}
            </p>

            {endsRun && (
              <span
                className={`ml-auto flex shrink-0 translate-y-[2px] items-center gap-1 text-[11px] tabular-nums ${
                  mine ? "text-white/70" : "text-ink-3"
                }`}
              >
                {message.edited_at && <span className="italic">edited</span>}
                {clockTime(message.created_at)}
                {mine && <StatusTicks status={message.status} />}
              </span>
            )}
          </div>

          {message.reactions.length > 0 && (
            <ReactionPills reactions={message.reactions} mine={mine} />
          )}
        </div>
      </div>

      {!mine && <HoverActions message={message} onReply={onReply} onReact={onReact} align="right" />}
    </div>
  );
}

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return (
      <span
        className="inline-block size-[11px] animate-pulse rounded-full border border-current"
        aria-label="Sending"
      />
    );
  }
  return (
    <TickIcon
      double={status === "delivered" || status === "read"}
      size={15}
      className={status === "read" ? "text-white" : ""}
    />
  );
}

function QuotedStrip({
  quoted,
  mine,
}: {
  quoted: NonNullable<Message["reply_to"]>;
  mine: boolean;
}) {
  return (
    <div
      className={`mb-1.5 rounded-md border-l-[3px] px-2 py-1 text-[13px] ${
        mine ? "border-white/60 bg-white/15" : "border-ultramarine bg-black/5"
      }`}
    >
      <div className="font-semibold">{quoted.sender_name ?? "Unknown"}</div>
      <div className="line-clamp-2 opacity-80">
        {quoted.is_deleted ? "This message was deleted" : quoted.body}
      </div>
    </div>
  );
}

function ReactionPills({
  reactions,
  mine,
}: {
  reactions: Message["reactions"];
  mine: boolean;
}) {
  const grouped = new Map<string, number>();
  for (const reaction of reactions) {
    grouped.set(reaction.emoji, (grouped.get(reaction.emoji) ?? 0) + 1);
  }

  return (
    <div
      className={`absolute -bottom-3 flex gap-1 ${mine ? "right-2" : "left-2"}`}
      title={reactions.map((r) => `${r.display_name} ${r.emoji}`).join(", ")}
    >
      {[...grouped.entries()].map(([emoji, count]) => (
        <span
          key={emoji}
          className="flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] leading-none text-ink shadow-sm"
        >
          {emoji}
          {count > 1 && <span className="text-ink-2">{count}</span>}
        </span>
      ))}
    </div>
  );
}

function HoverActions({
  message,
  onReply,
  onReact,
  align,
}: {
  message: Message;
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  align: "left" | "right";
}) {
  if (message.deleted_at) return <div className="w-7 shrink-0" />;

  return (
    <div
      className={`flex shrink-0 items-center self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
        align === "left" ? "order-first" : ""
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onReply(message)}
          className="flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-surface-hover hover:text-ink"
          aria-label="Reply"
          title="Reply"
        >
          <ReplyIcon />
        </button>

        <div
          className={`absolute bottom-8 z-10 hidden gap-0.5 rounded-full border border-border bg-surface-overlay p-1 shadow-lg group-hover:flex ${
            align === "left" ? "right-0" : "left-0"
          }`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message, emoji)}
              className="flex size-7 items-center justify-center rounded-full text-[15px] transition-transform hover:scale-125"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
