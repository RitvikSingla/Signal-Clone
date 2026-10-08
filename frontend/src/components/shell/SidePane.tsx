"use client";

/**
 * The chrome every left-hand pane shares.
 *
 * Chats, Calls, Stories and Settings all use the same frame in Signal: a
 * fixed-width column with a bold title, a couple of icon buttons on the
 * right, usually a search field, and a centred empty state. Extracting it
 * once keeps those four screens identical where they should be identical.
 */

import type { ReactNode } from "react";

import { FilterIcon, SearchIcon } from "@/components/ui/Icons";

export function SidePane({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface-raised md:w-list">
      {children}
    </aside>
  );
}

export function PaneHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-1 px-4 pb-1 pt-3">
      <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink">{title}</h1>
      {children}
    </header>
  );
}

export function PaneIconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
    >
      {children}
    </button>
  );
}

export function PaneSearch({
  id,
  value,
  placeholder = "Search",
  onChange,
  filter,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Omit to render the field alone, as the Stories pane does. */
  filter?: { active: boolean; label: string; onToggle: () => void };
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-full bg-surface-sunken pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
        />
      </label>
      {filter && (
        <button
          type="button"
          onClick={filter.onToggle}
          aria-pressed={filter.active}
          title={filter.label}
          aria-label={filter.label}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            filter.active
              ? "bg-ultramarine text-white"
              : "text-ink-2 hover:bg-surface-hover hover:text-ink"
          }`}
        >
          <FilterIcon />
        </button>
      )}
    </div>
  );
}

export function PaneEmpty({
  heading,
  detail,
}: {
  heading: string;
  detail: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">{heading}</p>
      <p className="mt-1 text-[13px] text-ink-2">{detail}</p>
    </div>
  );
}

/** The right-hand pane when nothing is selected. */
export function ContentEmpty({
  icon,
  children,
  footnote,
}: {
  icon: ReactNode;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <section className="relative hidden min-w-0 flex-1 flex-col items-center justify-center bg-surface px-6 text-center md:flex">
      <div className="text-ink-2">{icon}</div>
      <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ink-2">{children}</p>
      {footnote && (
        <p className="absolute bottom-6 text-[12px] text-ink-3">{footnote}</p>
      )}
    </section>
  );
}
