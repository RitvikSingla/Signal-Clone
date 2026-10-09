"use client";

/**
 * Dialogs Signal Desktop opens as small separate windows (Allow Access, the
 * Sticker Pack Creator): a title bar with the app icon, the title, and the
 * minimise / maximise / close buttons, over the main window.
 */

import { useEffect, useState, type ReactNode } from "react";

import { usePermissionPrompt, PROMPT_TEXT } from "@/lib/media";

export function WindowFrame({
  title,
  width,
  height,
  onClose,
  children,
  label,
}: {
  title: string;
  width: number;
  height?: number;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  const [maximised, setMaximised] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
    >
      <div
        className="animate-pop-in flex flex-col overflow-hidden rounded-lg border border-white/10 bg-surface-raised shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        style={
          maximised
            ? { width: "100%", height: "100%" }
            : { width, maxWidth: "100%", height, maxHeight: "100%" }
        }
      >
        <div className="flex h-8 shrink-0 items-center gap-2 pl-3 text-[12px] text-ink">
          <SignalDot />
          <span className="flex-1 truncate">{title}</span>
          <WindowButton label="Minimise" onClick={onClose}>
            <path d="M3 8h10" />
          </WindowButton>
          <WindowButton label={maximised ? "Restore" : "Maximise"} onClick={() => setMaximised((m) => !m)}>
            <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
          </WindowButton>
          <WindowButton label="Close" onClick={onClose} danger>
            <path d="m4 4 8 8M12 4l-8 8" />
          </WindowButton>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function WindowButton({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-8 w-10 items-center justify-center text-ink-2 transition-colors ${
        danger ? "hover:bg-[#c42b1c] hover:text-white" : "hover:bg-surface-hover hover:text-ink"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function SignalDot() {
  return (
    <svg width="14" height="14" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#2c6bed" />
      <path
        d="M50 22c-16 0-29 11-29 24.5 0 7 3.6 13.3 9.4 17.8l-3.8 13.5a1.3 1.3 0 0 0 1.8 1.6l16-7c1.8.3 3.7.4 5.6.4 16 0 29-11 29-24.5S66 22 50 22Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Signal's own "Allow Access" step, shown before the browser prompt. */
export function PermissionPrompt() {
  const pending = usePermissionPrompt((state) => state.pending);
  const answer = usePermissionPrompt((state) => state.answer);
  if (!pending) return null;

  return (
    <WindowFrame title="Allow Access" width={380} onClose={() => answer(false)}>
      <div className="px-4 pb-4 pt-2">
        <p className="text-[13px] leading-snug text-ink">{PROMPT_TEXT[pending.purpose]}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="h-8 rounded-md bg-surface-chip px-4 text-[13px] font-medium text-ink hover:brightness-110"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className="h-8 rounded-md bg-ultramarine px-4 text-[13px] font-medium text-white ring-2 ring-white/70 hover:bg-ultramarine-hover"
          >
            Allow Access
          </button>
        </div>
      </div>
    </WindowFrame>
  );
}
