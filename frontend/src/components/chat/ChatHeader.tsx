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

import { muteItems } from "@/components/chat/MuteMenu";
import { Avatar } from "@/components/ui/Avatar";
import { useNickname } from "@/lib/nicknames";
import {
  ArchiveIcon,
  BackIcon,
  InfoIcon,
  MoreIcon,
  PhoneIcon,
  PhotoIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
  TimerIcon,
  TrashIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { Tooltip } from "@/components/ui/Tooltip";
import { TIMER_OPTIONS, timerLabel } from "@/lib/groups";
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
  onCustomTimer: () => void;
  onMute: (until: string | null) => void;
  onMuteUntil: () => void;
  onAllMedia: () => void;
  onSelectMessages: () => void;
  onMarkUnread: () => void;
  onBlock: () => void;
  onDelete: () => void;
  onLeave: () => void;
};

/** The ⋯ menu, in Signal's order for groups and for direct chats. */
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
  onCustomTimer,
  onMute,
  onMuteUntil,
  onAllMedia,
  onSelectMessages,
  onMarkUnread,
  onBlock,
  onDelete,
  onLeave,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isGroup = conversation.type === "group";
  const nickname = useNickname(isGroup ? null : conversation.peer?.id);
  const active = conversation.can_send !== false || !conversation.ended_at;

  const menuItems: MenuItem[] = isRequest
    ? [
        { label: "Chat settings", icon: <InfoIcon />, onSelect: onOpenInfo },
        { label: "Archive", icon: <ArchiveIcon />, onSelect: onArchive },
      ]
    : [
        {
          label: "Disappearing messages",
          icon: <TimerIcon size={16} strokeWidth={1.7} />,
          disabled: Boolean(conversation.ended_at),
          submenu: [
            ...TIMER_OPTIONS.map(({ seconds, label }) => ({
              label: conversation.disappearing_seconds === seconds ? `✓  ${label}` : label,
              onSelect: () => onDisappearing(seconds),
            })),
            { label: "Custom time…", onSelect: onCustomTimer },
          ],
        },
        {
          label: conversation.is_muted ? "Unmute notifications" : "Mute notifications",
          icon: <BellOffIcon />,
          ...(conversation.is_muted
            ? { onSelect: () => onMute(null) }
            : { submenu: muteItems(false, onMute, onMuteUntil) }),
        },
        {
          label: isGroup ? "Group settings" : "Chat settings",
          icon: <SettingsIcon size={16} strokeWidth={1.7} />,
          onSelect: onOpenInfo,
        },
        { label: "All media", icon: <PhotoIcon />, onSelect: onAllMedia },
        { type: "separator" },
        { label: "Select messages", icon: <SelectGlyph />, onSelect: onSelectMessages },
        { label: "Mark as unread", icon: <UnreadGlyph />, onSelect: onMarkUnread },
        {
          label: conversation.is_pinned ? "Unpin chat" : "Pin chat",
          icon: <PinIcon size={16} strokeWidth={1.7} />,
          onSelect: onTogglePin,
        },
        { label: "Archive", icon: <ArchiveIcon />, onSelect: onArchive },
        ...(isGroup ? [] : [{ label: "Block", icon: <BlockGlyph />, onSelect: onBlock }]),
        { label: "Delete", icon: <TrashIcon />, onSelect: onDelete },
        ...(isGroup && active
          ? [{ label: "Leave group", icon: <LeaveGlyph />, onSelect: onLeave }]
          : []),
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
            group={conversation.type === "group"}
          />
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {nickname ?? conversation.title}
          </span>
          {conversation.disappearing_seconds > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-ink-2">
              <TimerIcon size={12} />
              {timerLabel(conversation.disappearing_seconds)}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isRequest && !conversation.ended_at && (
            <>
              <HeaderButton label="Start video call" onClick={() => onCall("video")}>
                <VideoIcon size={19} />
              </HeaderButton>
              {/* Signal Desktop offers only a video call for groups. */}
              {!isGroup && (
                <HeaderButton label="Start voice call" onClick={() => onCall("voice")}>
                  <PhoneIcon size={17} />
                </HeaderButton>
              )}
            </>
          )}
          <HeaderButton label="Search in chat" onClick={onSearch}>
            <SearchIcon size={17} />
          </HeaderButton>
          <div className="relative">
            <HeaderButton label="Chat options" onClick={() => setMenuOpen((open) => !open)}>
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

function glyph(children: React.ReactNode) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
const BellOffIcon = () =>
  glyph(
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9Z" />
      <path d="M13.7 18a2 2 0 0 1-3.4 0M3 3l18 18" />
    </>,
  );
const SelectGlyph = () =>
  glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.7 2.7L16 9.6" />
    </>,
  );
const UnreadGlyph = () =>
  glyph(
    <>
      <path d="M20 12a8 8 0 1 1-8-8" />
      <circle cx="18.5" cy="5.5" r="2.5" fill="currentColor" />
    </>,
  );
const BlockGlyph = () =>
  glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>,
  );
const LeaveGlyph = () =>
  glyph(
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 8l-4 4 4 4M5 12h11" />
    </>,
  );
