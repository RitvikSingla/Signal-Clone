"use client";

/**
 * The disappearing-messages picker: a small "Off ⌄" button that opens
 * Signal's list (Off, 4 weeks … 30 seconds, Custom time…), with a check by
 * the current value. Custom time asks for a number and a unit.
 */

import { useState } from "react";

import { ChevronDownIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { DialogButton, Modal } from "@/components/ui/Modal";
import { TIMER_OPTIONS, timerLabel } from "@/lib/groups";

export function TimerSelect({
  value,
  onChange,
  disabled = false,
  align = "right",
}: {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-label={`Disappearing messages: ${timerLabel(value)}`}
        className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-50"
      >
        {timerLabel(value)}
        <ChevronDownIcon size={13} />
      </button>
      {open && (
        <Menu
          align={align}
          onClose={() => setOpen(false)}
          items={[
            ...TIMER_OPTIONS.map((option) => ({
              label: option.seconds === value ? `✓  ${option.label}` : option.label,
              onSelect: () => onChange(option.seconds),
            })),
            { label: "Custom time…", onSelect: () => setCustom(true) },
          ]}
        />
      )}
      {custom && (
        <CustomTimerDialog
          onClose={() => setCustom(false)}
          onSave={(seconds) => {
            onChange(seconds);
            setCustom(false);
          }}
        />
      )}
    </div>
  );
}

const UNITS: { label: string; seconds: number; max: number }[] = [
  { label: "Seconds", seconds: 1, max: 59 },
  { label: "Minutes", seconds: 60, max: 59 },
  { label: "Hours", seconds: 3600, max: 23 },
  { label: "Days", seconds: 86_400, max: 6 },
  { label: "Weeks", seconds: 604_800, max: 4 },
];

export function CustomTimerDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (seconds: number) => void;
}) {
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState(2);
  const max = UNITS[unit].max;

  return (
    <Modal onClose={onClose} label="Custom disappearing message time" width={320}>
      <h2 className="text-center text-[14px] font-semibold text-ink">Custom time</h2>
      <div className="mt-4 flex gap-2">
        <select
          aria-label="Amount"
          value={Math.min(amount, max)}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="h-9 flex-1 rounded-md bg-surface-chip px-2 text-[13px] text-ink outline-none"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Unit"
          value={unit}
          onChange={(event) => setUnit(Number(event.target.value))}
          className="h-9 flex-1 rounded-md bg-surface-chip px-2 text-[13px] text-ink outline-none"
        >
          {UNITS.map((u, i) => (
            <option key={u.label} value={i}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onClose}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          onClick={() => onSave(Math.min(amount, max) * UNITS[unit].seconds)}
        >
          Set
        </DialogButton>
      </div>
    </Modal>
  );
}
