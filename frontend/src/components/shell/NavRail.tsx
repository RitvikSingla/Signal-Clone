"use client";

/**
 * The 68px icon rail down the left edge of Signal Desktop.
 *
 * Chats, Calls and Stories at the top; the account avatar and settings
 * pinned to the bottom. Calls and Stories are placeholders, which the brief
 * explicitly permits, so they open a Coming Soon panel rather than nothing.
 */

import { Avatar } from "@/components/ui/Avatar";
import {
  ChatIcon,
  PhoneIcon,
  SettingsIcon,
  StoriesIcon,
} from "@/components/ui/Icons";
import type { UserPrivate } from "@/lib/types";

export type RailTab = "chats" | "calls" | "stories" | "settings";

type NavRailProps = {
  active: RailTab;
  unreadTotal: number;
  user: UserPrivate;
  onSelect: (tab: RailTab) => void;
};

export function NavRail({ active, unreadTotal, user, onSelect }: NavRailProps) {
  return (
    <nav
      className="flex h-full w-rail shrink-0 flex-col items-center justify-between border-r border-border bg-surface-rail py-3"
      aria-label="Primary"
    >
      <div className="flex flex-col items-center gap-1">
        <RailButton
          label="Chats"
          active={active === "chats"}
          badge={unreadTotal}
          onClick={() => onSelect("chats")}
        >
          <ChatIcon />
        </RailButton>
        <RailButton
          label="Calls"
          active={active === "calls"}
          onClick={() => onSelect("calls")}
        >
          <PhoneIcon />
        </RailButton>
        <RailButton
          label="Stories"
          active={active === "stories"}
          onClick={() => onSelect("stories")}
        >
          <StoriesIcon />
        </RailButton>
      </div>

      <div className="flex flex-col items-center gap-2">
        <RailButton
          label="Settings"
          active={active === "settings"}
          onClick={() => onSelect("settings")}
        >
          <SettingsIcon />
        </RailButton>
        <button
          type="button"
          onClick={() => onSelect("settings")}
          className="rounded-full transition-opacity hover:opacity-80"
          title={user.display_name}
          aria-label="Your profile"
        >
          <Avatar
            name={user.display_name}
            colorKey={user.avatar_color}
            url={user.avatar_url}
            size={30}
          />
        </button>
      </div>
    </nav>
  );
}

function RailButton({
  children,
  label,
  active,
  badge = 0,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex size-11 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-ultramarine-soft text-ultramarine"
          : "text-ink-2 hover:bg-surface-hover hover:text-ink"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute right-1 top-1 min-w-[17px] rounded-full bg-ultramarine px-1 text-center text-[10px] font-semibold leading-[17px] text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
