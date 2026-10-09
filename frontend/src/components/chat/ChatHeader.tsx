"use client";

/**
 * The bar above a thread, as Signal Desktop draws it: a small avatar and
 * the name on the left, and on the right the video and voice call buttons,
 * search, and the overflow menu. While a message request is pending the
 * call buttons are absent, exactly as in the recording; they appear the
 * moment the request is accepted.
 *
 * Search moves to the chat list's field, scoped to this chat with a chip.
 */

import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import {
  ArchiveIcon,
  BackIcon,
  InfoIcon,
  MoreIcon,
  PhoneIcon,
  PinIcon,
  SearchIcon,
  TimerIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { Tooltip } from "@/components/ui/Tooltip";
import { durationLabel } from "@/lib/format";
import type { ConversationDetail } from "@/lib/types";

type ChatHeaderProps = {
  conversation: ConversationDetail;
  isRequest: boolean;
  /** Opens chat-scoped search in the left pane, as Signal Desktop does. */
  onSearch: () => void;
  onBack: () => void;
  onOpenInfo: () => void;
  onCall: (kind: "video" | "voice") => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDisappearing: (seconds: number) => void;
};

const TIMER_OPTIONS: [number, string][] = [
  [0, "Off"],
  [2419200, "4 weeks"],
  [604800, "1 week"],
  [86400, "1 day"],
  [28800, "8 hours"],
  [3600, "1 hour"],
  [300, "5 minutes"],
  [30, "30 seconds"],
];

export function ChatHeader({
  conversation,
  isRequest,
  onSearch,
  onBack,
  onOpenInfo,
  onCall,
  onTogglePin,
  onArchive,
  onDisappearing,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems: MenuItem[] = isRequest
    ? [
        { label: "Chat settings", icon: <InfoIcon />, onSelect: onOpenInfo },
        { label: "Archive", icon: <ArchiveIcon />, onSelect: onArchive },
      ]
    : [
        {
          label: "Disappearing messages",
          icon: <TimerIcon size={16} strokeWidth={1.7} />,
          submenu: TIMER_OPTIONS.map(([seconds, label]) => ({
            label: conversation.disappearing_seconds === seconds ? `✓  ${label}` : label,
            onSelect: () => onDisappearing(seconds),
          })),
        },
        { label: "Chat settings", icon: <InfoIcon />, onSelect: onOpenInfo },
        { type: "separator" },
        {
          label: conversation.is_pinned ? "Unpin chat" : "Pin chat",
          icon: <PinIcon size={16} strokeWidth={1.7} />,
          onSelect: onTogglePin,
        },
        { label: "Archive", icon: <ArchiveIcon />, onSelect: onArchive },
      ];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 bg-surface px-2 pt-1 md:px-3">
      <button
        type="button"
        onClick={onBack}
        className="flex size-8 items-center justify-center rounded-md text-ink hover:bg-surface-hover md:hidden"
        aria-label="Back to chats"
      >
        <BackIcon size={19} />
      </button>

      <>
        <button
          type="button"
          onClick={onOpenInfo}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1 pr-2 text-left"
        >
          <Avatar
            name={conversation.title}
            colorKey={conversation.avatar_color}
            url={conversation.avatar_url}
            size={28}
            online={conversation.peer?.is_online ?? false}
          />
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {conversation.title}
          </span>
          {conversation.disappearing_seconds > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-ink-2">
              <TimerIcon size={12} />
              {durationLabel(conversation.disappearing_seconds)}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isRequest && (
            <>
              <HeaderButton label="Start video call" onClick={() => onCall("video")}>
                <VideoIcon size={19} />
              </HeaderButton>
              <HeaderButton label="Start voice call" onClick={() => onCall("voice")}>
                <PhoneIcon size={17} />
              </HeaderButton>
            </>
          )}
          <HeaderButton label="Search in chat" onClick={onSearch}>
            <SearchIcon size={17} />
          </HeaderButton>
          <div className="relative">
            <HeaderButton label="More options" onClick={() => setMenuOpen((open) => !open)}>
              <MoreIcon size={17} />
            </HeaderButton>
            {menuOpen && (
              <Menu align="right" items={menuItems} onClose={() => setMenuOpen(false)} />
            )}
          </div>
        </div>
      </>
    </header>
  );
}

function HeaderButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex size-8 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-hover"
      >
        {children}
      </button>
    </Tooltip>
  );
}
