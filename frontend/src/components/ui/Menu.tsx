"use client";

/**
 * Dropdown menu.
 *
 * Signal hangs these off the overflow buttons, the composer's plus, the
 * Stories add button and the application menu bar. They share one look: a
 * dark rounded panel, an optional icon per row, a right-aligned shortcut,
 * separators, and submenus that open to the side on hover (Notification
 * profile in the Chats menu is the one in the recording).
 *
 * Closes on outside click and on Escape, which is the behaviour people
 * expect without being told.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChevronRightIcon } from "@/components/ui/Icons";

export type MenuAction = {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  /** Items shown in a panel beside this one while it is hovered. */
  submenu?: MenuItem[];
};

export type MenuItem =
  | MenuAction
  | { type: "separator" }
  | { type: "header"; label: string };

type MenuProps = {
  items: MenuItem[];
  onClose: () => void;
  /** Which corner the panel grows from, relative to its trigger. */
  align?: "left" | "right";
  /** Open upward, for triggers that sit at the bottom of the window. */
  placement?: "below" | "above";
  className?: string;
};

export function Menu({
  items,
  onClose,
  align = "left",
  placement = "below",
  className = "",
}: MenuProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Deferred so the click that opened the menu does not immediately close it.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      className={`absolute z-40 ${placement === "below" ? "top-full mt-1" : "bottom-full mb-1"} ${
        align === "right" ? "right-0" : "left-0"
      } ${className}`}
    >
      {/* A right-aligned menu sits near the window edge, so its submenus
          open leftward instead of off-screen. */}
      <MenuPanel items={items} onClose={onClose} subSide={align === "right" ? "left" : "right"} />
    </div>
  );
}

/** The panel itself, without positioning. The menu bar reuses it. */
export function MenuPanel({
  items,
  onClose,
  subSide = "right",
}: {
  items: MenuItem[];
  onClose: () => void;
  subSide?: "left" | "right";
}) {
  const [openSub, setOpenSub] = useState<number | null>(null);
  const hasIcons = items.some((item) => "label" in item && !("type" in item) && item.icon);

  return (
    <div
      role="menu"
      className="animate-pop-in min-w-[184px] rounded-lg bg-surface-overlay py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
    >
      {items.map((item, index) => {
        if ("type" in item && item.type === "separator") {
          return <div key={`sep-${index}`} className="my-1 h-px bg-border-strong/50" />;
        }
        if ("type" in item && item.type === "header") {
          return (
            <div
              key={`head-${item.label}`}
              className="px-3.5 pb-1 pt-1.5 text-[13px] font-semibold text-ink"
            >
              {item.label}
            </div>
          );
        }

        const action = item as MenuAction;
        const hasSub = Boolean(action.submenu?.length);

        return (
          <div
            key={action.label}
            className="relative"
            onMouseEnter={() => setOpenSub(hasSub ? index : null)}
            onMouseLeave={() => hasSub && setOpenSub(null)}
          >
            <button
              type="button"
              role="menuitem"
              disabled={action.disabled}
              aria-haspopup={hasSub ? "menu" : undefined}
              aria-expanded={hasSub ? openSub === index : undefined}
              // Leave focus where it was, so Edit > Copy acts on the field.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (hasSub) {
                  setOpenSub(openSub === index ? null : index);
                  return;
                }
                action.onSelect?.();
                onClose();
              }}
              className={`mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-2.5 py-[6px] text-left text-[13px] transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40 ${
                action.danger ? "text-danger" : "text-ink"
              } ${openSub === index ? "bg-surface-hover" : ""}`}
            >
              {hasIcons && (
                <span className="flex size-4 shrink-0 items-center justify-center text-ink">
                  {action.icon}
                </span>
              )}
              <span className="flex-1 whitespace-nowrap">{action.label}</span>
              {action.shortcut && (
                <span className="ml-6 whitespace-nowrap text-[12px] text-ink-2">
                  {action.shortcut}
                </span>
              )}
              {hasSub && <ChevronRightIcon size={14} className="ml-3 text-ink-2" />}
            </button>

            {hasSub && openSub === index && (
              <div
                className={`absolute top-0 z-50 ${
                  subSide === "right" ? "left-full pl-1" : "right-full pr-1"
                }`}
              >
                <MenuPanel items={action.submenu ?? []} onClose={onClose} subSide={subSide} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
