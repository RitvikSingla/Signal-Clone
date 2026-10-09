"use client";

/**
 * One row in the conversation list.
 *
 * As Signal Desktop draws it: a 48px avatar, the name on the first line
 * with the timestamp right-aligned, and the preview on the second line with
 * the unread count or the delivery icon right-aligned under the time. The
 * selected row is an inset rounded tile rather than a full-width band. A
 * request from a stranger reads "Message Request" instead of its text, and
 * a person typing replaces the preview with three dots.
 */

import { Avatar } from "@/components/ui/Avatar";
import { MuteIcon, PinIcon, StatusIcon } from "@/components/ui/Icons";
import { useNow } from "@/hooks/useNow";
import { listTimestamp, previewText } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";

type ConversationRowProps = {
  conversation: ConversationSummary;
  selected: boolean;
  currentUserId: string;
  isRequest: boolean;
  typing: boolean;
  onSelect: (id: string) => void;
};

export function ConversationRow({
  conversation,
  selected,
  currentUserId,
  isRequest,
  typing,
  onSelect,
}: ConversationRowProps) {
  // Re-render on the shared clock so "Now" becomes "1m" without a refresh.
  useNow();

  const last = conversation.last_message;
  const mine = last?.sender_id === currentUserId;
  const unread = conversation.unread_count > 0 && !isRequest;

  const preview = isRequest
    ? "Message Request"
    : last
      ? previewText(
          last.body,
          last.type,
          last.is_deleted,
          last.sender_name,
          conversation.type === "group",
          mine,
          last.event,
        )
      : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={selected ? "true" : undefined}
      className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 text-left transition-colors ${
        selected ? "bg-surface-selected" : "hover:bg-surface-hover"
      }`}
      style={{ height: 64 }}
    >
      <Avatar
        name={conversation.title}
        colorKey={conversation.avatar_color}
        url={conversation.avatar_url}
        size={42}
        online={conversation.peer?.is_online ?? false}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {conversation.title}
          </span>
          {conversation.is_pinned && <PinIcon className="shrink-0 text-ink-2" />}
          {conversation.is_muted && <MuteIcon className="shrink-0 text-ink-2" />}
          <span
            className={`ml-auto shrink-0 text-[11px] tabular-nums ${
              unread ? "font-semibold text-ink" : "text-ink-2"
            }`}
          >
            {listTimestamp(conversation.last_activity_at)}
          </span>
        </div>

        <div
          className="mt-0.5 flex items-center gap-1.5"
          style={{ ["--status-on-fill" as string]: "var(--surface-raised)" }}
        >
          {typing ? (
            <span className="flex h-[18px] items-center gap-[3px] pl-0.5" aria-label="Typing">
              <TypingDot delay="0ms" />
              <TypingDot delay="160ms" />
              <TypingDot delay="320ms" />
            </span>
          ) : (
            <span
              className={`truncate text-[12.5px] ${
                isRequest ? "font-semibold text-ink" : unread ? "text-ink" : "text-ink-2"
              } ${last?.type === "system" && !last.event && !isRequest ? "italic" : ""}`}
            >
              {preview}
            </span>
          )}

          {unread ? (
            <span className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-ultramarine px-1.5 text-[11px] font-semibold text-white">
              {conversation.unread_count}
            </span>
          ) : (
            mine &&
            last &&
            last.type !== "system" &&
            !typing && (
              <StatusIcon status={last.status} size={12} className="ml-auto shrink-0 text-ink-2" />
            )
          )}
        </div>
      </div>
    </button>
  );
}

function TypingDot({ delay }: { delay: string }) {
  return (
    <span
      className="size-[5px] rounded-full bg-ink-2 motion-safe:animate-[typing-bounce_1.1s_ease-in-out_infinite]"
      style={{ animationDelay: delay }}
    />
  );
}
