"use client";

/**
 * The pinned-message banner under the chat header: who wrote the pinned
 * message and its text, with a pin glyph at the right. Clicking it jumps to
 * the message; with several pins it then advances to the next, and the
 * small bars on the left show which of them is on display. The pin glyph
 * opens a menu to unpin.
 */

import { useState } from "react";

import { PinIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import type { Message } from "@/lib/types";

export function PinnedBar({
  pins,
  currentUserId,
  onJump,
  onUnpin,
}: {
  pins: Message[];
  currentUserId: string;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  if (pins.length === 0) return null;
  const shown = pins[index % pins.length];
  const author =
    shown.sender?.id === currentUserId ? "You" : (shown.sender?.display_name ?? "Unknown");
  const preview = shown.body
    ? shown.body
    : shown.attachments.length
      ? shown.attachments[0].content_type.startsWith("image/")
        ? "📷 Photo"
        : `📎 ${shown.attachments[0].file_name}`
      : "";

  return (
    <div className="flex shrink-0 items-center gap-2 bg-surface px-4 pb-1.5 md:px-5">
      {pins.length > 1 && (
        <span className="flex flex-col gap-[3px] self-stretch py-1" aria-hidden>
          {pins.map((pin, position) => (
            <span
              key={pin.id}
              className={`w-[2px] flex-1 rounded-full ${
                position === index % pins.length ? "bg-ink" : "bg-ink-3/50"
              }`}
            />
          ))}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          onJump(shown.id);
          if (pins.length > 1) setIndex((i) => (i + 1) % pins.length);
        }}
        className="min-w-0 flex-1 text-left"
        aria-label={`Pinned message from ${author}: ${preview}`}
      >
        <span className="block truncate text-[12px] font-semibold text-ink">{author}</span>
        <span className="block truncate text-[12.5px] text-ink">{preview}</span>
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Pinned message options"
          className="flex size-8 items-center justify-center rounded-md text-ink hover:bg-surface-hover"
        >
          <PinIcon size={16} strokeWidth={1.7} />
        </button>
        {menuOpen && (
          <Menu
            align="right"
            onClose={() => setMenuOpen(false)}
            items={[
              { label: "Go to message", onSelect: () => onJump(shown.id) },
              { label: "Unpin message", onSelect: () => onUnpin(shown.id) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
