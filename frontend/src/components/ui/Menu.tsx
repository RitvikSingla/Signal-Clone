"use client";

/**
 * Small dropdown menu.
 *
 * Signal hangs one off the hamburger in the rail and another off the
 * overflow button in the Chats header. Closes on outside click and on
 * Escape, which is the behaviour people expect without being told.
 */

import { useEffect, useRef } from "react";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

type MenuProps = {
  items: MenuItem[];
  onClose: () => void;
  /** Which corner the panel grows from, relative to its trigger. */
  align?: "left" | "right";
};

export function Menu({ items, onClose, align = "left" }: MenuProps) {
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
      role="menu"
      className={`absolute top-full z-30 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface-overlay py-1 shadow-xl ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={`block w-full px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-hover ${
            item.danger ? "text-danger" : "text-ink"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
