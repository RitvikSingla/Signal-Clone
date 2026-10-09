"use client";

/**
 * "Mute this chat for…": 1 hour, 8 hours, 1 day, 1 week, Until…, Always,
 * or Unmute when already muted. Shared by the header menu, the details
 * page's Mute button and the Notifications page.
 */

import { useState } from "react";

import type { MenuItem } from "@/components/ui/Menu";
import { DialogButton, Modal } from "@/components/ui/Modal";

const ALWAYS = "9999-12-31T00:00:00Z";

export function muteItems(
  muted: boolean,
  onMute: (until: string | null) => void,
  onUntil: () => void,
): MenuItem[] {
  if (muted) return [{ label: "Unmute", onSelect: () => onMute(null) }];
  const after = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  return [
    { type: "header", label: "Mute this chat for…" },
    { label: "1 hour", onSelect: () => onMute(after(1)) },
    { label: "8 hours", onSelect: () => onMute(after(8)) },
    { label: "1 day", onSelect: () => onMute(after(24)) },
    { label: "1 week", onSelect: () => onMute(after(168)) },
    { label: "Until…", onSelect: onUntil },
    { label: "Always", onSelect: () => onMute(ALWAYS) },
  ];
}

export function MuteUntilDialog({
  onClose,
  onMute,
}: {
  onClose: () => void;
  onMute: (until: string) => void;
}) {
  // Computed once, in the initialiser, so render stays pure.
  const [{ initial, min }] = useState(() => {
    const toLocal = (date: Date) =>
      new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    const tomorrow = new Date(Date.now() + 86_400_000);
    tomorrow.setMinutes(0, 0, 0);
    return { initial: toLocal(tomorrow), min: toLocal(new Date()) };
  });
  const [value, setValue] = useState(initial);

  return (
    <Modal onClose={onClose} label="Mute until" width={320}>
      <h2 className="text-center text-[14px] font-semibold text-ink">Mute until</h2>
      <input
        type="datetime-local"
        value={value}
        min={min}
        onChange={(event) => setValue(event.target.value)}
        className="mt-4 h-9 w-full rounded-md bg-surface-chip px-3 text-[13px] text-ink outline-none"
      />
      <div className="mt-5 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onClose}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          disabled={!value}
          onClick={() => {
            onMute(new Date(value).toISOString());
            onClose();
          }}
        >
          Mute
        </DialogButton>
      </div>
    </Modal>
  );
}
