"use client";

/**
 * The icon rail down the left edge of Signal Desktop.
 *
 * Matching the real app: a hamburger at the very top, then Chats, Calls and
 * Stories, with the settings gear pinned to the bottom and nothing else
 * there. The active tab is a grey rounded square, not a coloured pill.
 */

import { useState } from "react";

import {
  ChatIcon,
  MenuIcon,
  PhoneIcon,
  SettingsIcon,
  StoriesIcon,
} from "@/components/ui/Icons";
import { Menu, type MenuItem } from "@/components/ui/Menu";

export type RailTab = "chats" | "calls" | "stories" | "settings";

type NavRailProps = {
  active: RailTab;
  unreadTotal: number;
  menuItems: MenuItem[];
  onSelect: (tab: RailTab) => void;
};

export function NavRail({ active, unreadTotal, menuItems, onSelect }: NavRailProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      className="flex h-full w-rail shrink-0 flex-col items-center justify-between bg-surface-rail py-2.5"
      aria-label="Primary"
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <RailButton
            label="Menu"
            active={false}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon />
          </RailButton>
          {menuOpen && <Menu items={menuItems} onClose={() => setMenuOpen(false)} />}
        </div>

        <div className="mt-1 flex flex-col items-center gap-1">
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
      </div>

      <RailButton
        label="Settings"
        active={active === "settings"}
        onClick={() => onSelect("settings")}
      >
        <SettingsIcon />
      </RailButton>
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
      className={`relative flex size-10 items-center justify-center rounded-[12px] transition-colors ${
        active
          ? "bg-surface-sunken text-ink"
          : "text-ink-2 hover:bg-surface-hover hover:text-ink"
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-ultramarine px-1 text-center text-[10px] font-semibold leading-[17px] text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
