"use client";

/**
 * The hover label Signal shows beside rail buttons ("Calls", "Stories",
 * "Hide tabs", "Settings"): a small grey pill to the right, after a short
 * delay, with no arrow.
 */

import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
  side = "right",
}: {
  label: string;
  children: ReactNode;
  side?: "right" | "bottom" | "top";
}) {
  const position =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : side === "bottom"
        ? "left-1/2 top-full mt-1.5 -translate-x-1/2"
        : "bottom-full left-1/2 mb-1.5 -translate-x-1/2";

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-surface-chip px-2.5 py-1 text-[12px] font-medium text-ink opacity-0 shadow-lg transition-opacity delay-0 group-hover/tip:opacity-100 group-hover/tip:delay-500 ${position}`}
      >
        {label}
      </span>
    </span>
  );
}
