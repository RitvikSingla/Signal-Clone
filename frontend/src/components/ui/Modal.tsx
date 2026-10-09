"use client";

/**
 * Signal's dialogs.
 *
 * A small rounded card over a dimmed window, title and body centred, and
 * pill buttons underneath: a grey Cancel and a coloured primary action. The
 * "Accept request?" dialog in the recording is the reference.
 */

import { useEffect, type ReactNode } from "react";

import { CloseIcon } from "@/components/ui/Icons";

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
  /** Card width; dialogs are narrow, sheets like Safety tips are wider. */
  width?: number;
  label?: string;
  /** Draws an X in the corner, for informational sheets. */
  closeButton?: boolean;
};

export function Modal({ onClose, children, width = 360, label, closeButton = false }: ModalProps) {
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="animate-pop-in relative max-h-[86vh] w-full overflow-y-auto rounded-2xl bg-surface-modal px-5 pb-4 pt-5 shadow-2xl"
        style={{ maxWidth: width }}
      >
        {closeButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <CloseIcon size={16} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

type ConfirmProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal onClose={onClose} label={title} width={340}>
      <h2 className="text-center text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-2 text-center text-[13px] leading-[1.45] text-ink">{children}</div>
      <div className="mt-5 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onClose}>
          {cancelLabel}
        </DialogButton>
        <DialogButton
          variant={tone}
          autoFocus
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </DialogButton>
      </div>
    </Modal>
  );
}

export function DialogButton({
  children,
  variant,
  onClick,
  autoFocus,
  disabled,
}: {
  children: ReactNode;
  variant: "primary" | "secondary" | "danger";
  onClick: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const tone =
    variant === "primary"
      ? "bg-ultramarine text-white hover:bg-ultramarine-hover"
      : variant === "danger"
        ? "bg-danger text-white hover:opacity-90"
        : "bg-surface-chip text-ink hover:brightness-110";
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 flex-1 rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}
