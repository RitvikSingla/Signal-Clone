"use client";

/**
 * Minimal toast stack.
 *
 * A small store rather than a context, so any component can raise a toast
 * without the whole tree re-rendering when one appears.
 */

import { useEffect } from "react";
import { create } from "zustand";

type Toast = { id: number; text: string };

type ToastState = {
  toasts: Toast[];
  push: (text: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (text) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, text }] }));
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function ToastStack() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      className="pointer-events-auto max-w-sm rounded-full bg-[#2b2b2b] px-4 py-2 text-[13px] text-white shadow-lg"
    >
      {toast.text}
    </button>
  );
}
