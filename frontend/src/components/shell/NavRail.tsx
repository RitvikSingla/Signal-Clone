"use client";

/**
 * The icon rail down the left edge of Signal Desktop.
 *
 * Matching the real app: a hamburger at the very top that hides or shows
 * the tabs, then Chats, Calls and Stories, with the settings gear pinned to
 * the bottom. The active tab is a grey rounded square with its glyph drawn
 * solid. Hovering any button shows its name in a pill to the right, and
 * Stories carries a red dot while there is a story you have not watched.
 */

import { Tooltip } from "@/components/ui/Tooltip";
import {
  ChatIcon,
  MenuIcon,
  PhoneIcon,
  SettingsIcon,
  StoriesIcon,
} from "@/components/ui/Icons";

export type RailTab = "chats" | "calls" | "stories" | "settings";

type NavRailProps = {
  active: RailTab;
  unreadTotal: number;
  storiesUnseen: boolean;
  onToggleTabs: () => void;
  onSelect: (tab: RailTab) => void;
};

export function NavRail({
  active,
  unreadTotal,
  storiesUnseen,
  onToggleTabs,
  onSelect,
}: NavRailProps) {
  return (
    <nav
      className="flex h-full w-[52px] shrink-0 flex-col items-center justify-between bg-surface-rail pb-3 pt-2"
      aria-label="Primary"
    >
      <div className="flex flex-col items-center gap-1.5">
        <RailButton label="Hide tabs" active={false} onClick={onToggleTabs}>
          <MenuIcon size={18} />
        </RailButton>

        <div className="mt-1 flex flex-col items-center gap-1.5">
          <RailButton
            label="Chats"
            active={active === "chats"}
            badge={unreadTotal}
            onClick={() => onSelect("chats")}
          >
            <ChatIcon size={20} filled={active === "chats"} />
          </RailButton>
          <RailButton
            label="Calls"
            active={active === "calls"}
            onClick={() => onSelect("calls")}
          >
            <PhoneIcon size={19} filled={active === "calls"} />
          </RailButton>
          <RailButton
            label="Stories"
            active={active === "stories"}
            dot={storiesUnseen}
            onClick={() => onSelect("stories")}
          >
            <StoriesIcon size={20} filled={active === "stories"} />
          </RailButton>
        </div>
      </div>

      <RailButton
        label="Settings"
        active={active === "settings"}
        onClick={() => onSelect("settings")}
      >
        <SettingsIcon size={20} />
      </RailButton>
    </nav>
  );
}

/** The toggle again, drawn in a pane header while the rail is hidden. */
export function ShowTabsButton({ onClick }: { onClick: () => void }) {
  return (
    <RailButton label="Show tabs" active={false} onClick={onClick}>
      <MenuIcon size={18} />
    </RailButton>
  );
}

function RailButton({
  children,
  label,
  active,
  badge = 0,
  dot = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`relative flex size-9 items-center justify-center rounded-[10px] transition-colors ${
          active
            ? "bg-surface-sunken text-ink"
            : "text-ink-2 hover:bg-surface-hover hover:text-ink"
        }`}
      >
        {children}
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-ultramarine px-1 text-center text-[10px] font-semibold leading-[17px] text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {dot && badge === 0 && (
          <span
            className="absolute right-0.5 top-0.5 size-[9px] rounded-full border-2 border-surface-rail bg-[#e8404a]"
            aria-label="Unviewed stories"
          />
        )}
      </button>
    </Tooltip>
  );
}
