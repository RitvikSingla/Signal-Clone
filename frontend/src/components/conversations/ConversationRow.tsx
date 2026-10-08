"use client";

/**
 * One row in the conversation list.
 *
 * Signal's row is 72px: a 48px avatar with 12px either side, the name on
 * the first line with the timestamp right-aligned, and the message preview
 * on the second line with the unread pill right-aligned under it.
 */

import { Avatar } from "@/components/ui/Avatar";
import { MuteIcon, PinIcon, TickIcon } from "@/components/ui/Icons";
import { listTimestamp, previewText } from "@/lib/format";
import type { ConversationSummary } from "@/lib/types";

type ConversationRowProps = {
  conversation: ConversationSummary;
  selected: boolean;
  currentUserId: string;
  onSelect: (id: string) => void;
};

export function ConversationRow({
  conversation,
  selected,
  currentUserId,
  onSelect,
}: ConversationRowProps) {
  const last = conversation.last_message;
  const mine = last?.sender_id === currentUserId;
  const unread = conversation.unread_count > 0;

  const preview = last
    ? previewText(
        last.body,
        last.type,
        last.is_deleted,
        last.sender_name,
        conversation.type === "group",
        mine,
      )
    : "No messages yet";

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-3 px-3 text-left transition-colors ${
        selected ? "bg-surface-sunken" : "hover:bg-surface-hover"
      }`}
      style={{ height: 72 }}
    >
      <Avatar
        name={conversation.title}
        colorKey={conversation.avatar_color}
        url={conversation.avatar_url}
        size={48}
        online={conversation.peer?.is_online ?? false}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`truncate text-sm ${unread ? "font-semibold text-ink" : "font-medium text-ink"}`}
          >
            {conversation.title}
          </span>
          {conversation.is_pinned && (
            <PinIcon className="shrink-0 text-ink-3" />
          )}
          {conversation.is_muted && (
            <MuteIcon className="shrink-0 text-ink-3" />
          )}
          <span
            className={`ml-auto shrink-0 text-[11px] tabular-nums ${
              unread ? "font-medium text-ultramarine" : "text-ink-3"
            }`}
          >
            {listTimestamp(conversation.last_activity_at)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          {mine && last && last.type !== "system" && (
            <TickIcon
              double={last.status === "delivered" || last.status === "read"}
              size={15}
              className={
                last.status === "read" ? "shrink-0 text-ultramarine" : "shrink-0 text-ink-3"
              }
            />
          )}
          <span
            className={`truncate text-[13px] ${
              unread ? "text-ink" : "text-ink-2"
            } ${last?.type === "system" ? "italic" : ""}`}
          >
            {preview}
          </span>

          {unread && (
            <span className="ml-auto flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-ultramarine px-1.5 text-[11px] font-semibold text-white">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
