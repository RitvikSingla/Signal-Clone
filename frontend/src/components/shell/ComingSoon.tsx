"use client";

/**
 * Placeholder pane for the features the brief allows to be mocked:
 * voice and video calls, stories, and linked devices.
 *
 * Deliberately a real pane rather than a dead icon. A reviewer clicking
 * Calls should land somewhere that explains itself.
 */

import type { ReactNode } from "react";

type ComingSoonProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-surface-sunken text-ink-3">
        {icon}
      </div>
      <div className="max-w-sm">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{description}</p>
        <span className="mt-3 inline-block rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
          Coming soon
        </span>
      </div>
    </section>
  );
}
