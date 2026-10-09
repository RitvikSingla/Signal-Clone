"use client";

/**
 * The chrome every left-hand pane shares.
 *
 * Chats, Calls, Stories and Settings all use the same frame in Signal: a
 * fixed-width column with a bold title, a couple of icon buttons on the
 * right, usually a search field, and a centred empty state. Sub-views (New
 * chat, Archive, Start new call) swap the title for a back arrow and a
 * centred heading. Extracting it once keeps those screens identical where
 * they should be identical.
 */

import type { ReactNode } from "react";

import { ShowTabsButton } from "@/components/shell/NavRail";
import { ChevronLeftIcon, FilterIcon, SearchIcon } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { useUi } from "@/store/ui";

export function SidePane({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-surface-raised md:w-list">
      {children}
    </aside>
  );
}

export function PaneHeader({
  title,
  children,
  onBack,
}: {
  title: string;
  children?: ReactNode;
  /** Turns the header into a sub-view header: back arrow, centred title. */
  onBack?: () => void;
}) {
  const tabsHidden = useUi((state) => state.tabsHidden);
  const toggleTabs = useUi((state) => state.toggleTabs);

  if (onBack) {
    return (
      <header className="flex h-12 shrink-0 items-center gap-1 px-2.5 pt-1">
        <PaneIconButton label="Back" onClick={onBack}>
          <ChevronLeftIcon size={18} />
        </PaneIconButton>
        <h1 className="flex-1 truncate pr-8 text-center text-[14px] font-semibold text-ink">
          {title}
        </h1>
      </header>
    );
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 px-3 pt-1">
      {tabsHidden && (
        <div className="mr-1">
          <ShowTabsButton onClick={toggleTabs} />
        </div>
      )}
      <h1 className="flex-1 truncate pl-1 text-[17px] font-bold tracking-tight text-ink">
        {title}
      </h1>
      {children}
    </header>
  );
}

export function PaneIconButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
          active ? "bg-surface-sunken text-ink" : "text-ink hover:bg-surface-hover"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function PaneSearch({
  id,
  value,
  placeholder = "Search",
  onChange,
  filter,
  autoFocus = false,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Omit to render the field alone, as the Stories pane does. */
  filter?: { active: boolean; label: string; onToggle: () => void };
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-2 pt-1">
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <SearchIcon
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2"
        />
        <input
          id={id}
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[30px] w-full rounded-md bg-surface-sunken pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:ring-2 focus:ring-ultramarine"
        />
      </label>
      {filter && (
        <Tooltip label={filter.label} side="bottom">
          <button
            type="button"
            onClick={filter.onToggle}
            aria-pressed={filter.active}
            aria-label={filter.label}
            className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
              filter.active
                ? "bg-ultramarine text-white"
                : "text-ink hover:bg-surface-hover"
            }`}
          >
            <FilterIcon size={16} />
          </button>
        </Tooltip>
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
      <p className="text-[14px] font-semibold text-ink">{heading}</p>
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
      <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-2">{children}</p>
      {footnote && (
        <p className="absolute bottom-6 text-[12px] text-ink-3">{footnote}</p>
      )}
    </section>
  );
}

/** A row in a pane list: icon or avatar, a label, an optional second line. */
export function PaneRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  selected = false,
}: {
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
        selected ? "bg-surface-selected" : "hover:bg-surface-hover"
      }`}
    >
      <span className="flex shrink-0 items-center justify-center">{leading}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{title}</span>
        {subtitle && <span className="block truncate text-[12px] text-ink-2">{subtitle}</span>}
      </span>
      {trailing}
    </button>
  );
}
