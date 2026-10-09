"use client";

/** Signal's toggle: a pill with a white knob, ultramarine when on. */
export function Switch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex h-[18px] w-8 shrink-0 items-center rounded-full px-[2px] transition-colors disabled:opacity-50 ${
        on ? "justify-end bg-ultramarine" : "justify-start bg-border-strong"
      }`}
    >
      <span className="size-[14px] rounded-full bg-white shadow" />
    </button>
  );
}
