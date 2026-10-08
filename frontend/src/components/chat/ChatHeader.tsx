"use client";

/**
 * The bar above a thread: who you are talking to, and the thread actions.
 *
 * The call buttons are placeholders, which the brief permits. They are
 * present rather than hidden because their absence would be the most
 * visible difference from the real app.
 */

import { Avatar } from "@/components/ui/Avatar";
import {
  BackIcon,
  MoreIcon,
  PhoneIcon,
  SearchIcon,
  TimerIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import { durationLabel, presenceLabel } from "@/lib/format";
import type { ConversationDetail } from "@/lib/types";

type ChatHeaderProps = {
  conversation: ConversationDetail;
  onBack: () => void;
  onOpenInfo: () => void;
  onComingSoon: (feature: string) => void;
};

export function ChatHeader({
  conversation,
  onBack,
  onOpenInfo,
  onComingSoon,
}: ChatHeaderProps) {
  const activeMembers = conversation.members.filter((m) => m.is_active);

  const subtitle =
    conversation.type === "group"
      ? `${activeMembers.length} members`
      : conversation.peer
        ? presenceLabel(conversation.peer.is_online, conversation.peer.last_seen_at)
        : "";

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-4">
      <button
        type="button"
        onClick={onBack}
        className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink md:hidden"
        aria-label="Back to chats"
      >
        <BackIcon />
      </button>

      <button
        type="button"
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pr-2 text-left transition-colors hover:bg-surface-hover"
      >
        <Avatar
          name={conversation.title}
          colorKey={conversation.avatar_color}
          url={conversation.avatar_url}
          size={36}
          online={conversation.peer?.is_online ?? false}
        />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">
            {conversation.title}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
            {conversation.peer?.is_online && (
              <span className="size-1.5 rounded-full bg-[#3fbb5c]" aria-hidden />
            )}
            <span className="truncate">{subtitle}</span>
            {conversation.disappearing_seconds > 0 && (
              <span className="flex items-center gap-0.5 text-ink-3">
                <TimerIcon size={12} />
                {durationLabel(conversation.disappearing_seconds)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Narrow screens keep only the two call buttons and the menu, so the
          name has room rather than truncating to two letters. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderButton label="Video call" onClick={() => onComingSoon("Video calls")}>
          <VideoIcon size={20} />
        </HeaderButton>
        <HeaderButton label="Voice call" onClick={() => onComingSoon("Voice calls")}>
          <PhoneIcon size={19} />
        </HeaderButton>
        <HeaderButton
          label="Search in conversation"
          className="hidden sm:flex"
          onClick={() => onComingSoon("In-chat search")}
        >
          <SearchIcon size={19} />
        </HeaderButton>
        <HeaderButton label="Conversation details" onClick={onOpenInfo}>
          <MoreIcon size={19} />
        </HeaderButton>
      </div>
    </header>
  );
}

function HeaderButton({
  children,
  label,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink ${className || "flex"}`}
    >
      {children}
    </button>
  );
}
