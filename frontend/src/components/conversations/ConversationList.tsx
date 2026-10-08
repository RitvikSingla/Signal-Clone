"use client";

/**
 * The middle pane: header, search, and the scrolling list.
 *
 * Matching Signal Desktop: the title sits alone on the left with the compose
 * and overflow buttons on the right, and the unread filter is an icon beside
 * the search field rather than a row of chips.
 */

import { useMemo, useState } from "react";

import { ConversationRow } from "@/components/conversations/ConversationRow";
import { ComposeIcon, FilterIcon, MoreIcon, SearchIcon } from "@/components/ui/Icons";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import type { ConversationSummary, UserPrivate } from "@/lib/types";

type ConversationListProps = {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  user: UserPrivate;
  filter: "all" | "unread";
  search: string;
  overflowItems: MenuItem[];
  onFilterChange: (filter: "all" | "unread") => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
};

export function ConversationList({
  conversations,
  loading,
  error,
  activeId,
  user,
  filter,
  search,
  overflowItems,
  onFilterChange,
  onSearchChange,
  onSelect,
  onCompose,
}: ConversationListProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (!needle) return true;
      return (
        c.title.toLowerCase().includes(needle) ||
        (c.last_message?.body ?? "").toLowerCase().includes(needle)
      );
    });
  }, [conversations, filter, search]);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface-raised md:w-list">
      <header className="flex items-center gap-1 px-4 pb-1 pt-3">
        <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink">Chats</h1>
        <IconButton label="New chat" onClick={onCompose}>
          <ComposeIcon />
        </IconButton>
        <div className="relative">
          <IconButton label="More options" onClick={() => setMenuOpen((open) => !open)}>
            <MoreIcon />
          </IconButton>
          {menuOpen && (
            <Menu items={overflowItems} align="right" onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </header>

      <div className="flex items-center gap-2 px-4 py-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            id="conversation-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-full bg-surface-sunken pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
          />
        </label>
        <button
          type="button"
          onClick={() => onFilterChange(filter === "unread" ? "all" : "unread")}
          aria-pressed={filter === "unread"}
          title={filter === "unread" ? "Showing unread only" : "Filter by unread"}
          aria-label="Filter by unread"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            filter === "unread"
              ? "bg-ultramarine text-white"
              : "text-ink-2 hover:bg-surface-hover hover:text-ink"
          }`}
        >
          <FilterIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && <ListSkeleton />}

        {!loading && error && (
          <p className="px-4 py-6 text-[13px] text-danger">{error}</p>
        )}

        {!loading && !error && visible.length === 0 && (
          <EmptyList search={search} filter={filter} />
        )}

        {!loading &&
          visible.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === activeId}
              currentUserId={user.id}
              onSelect={onSelect}
            />
          ))}
      </div>
    </aside>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
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

/** Signal's wording, centred in the pane rather than tucked at the top. */
function EmptyList({ search, filter }: { search: string; filter: "all" | "unread" }) {
  const heading = search
    ? "No results"
    : filter === "unread"
      ? "No unread chats"
      : "No chats";
  const detail = search
    ? `Nothing matches “${search.trim()}”`
    : filter === "unread"
      ? "Everything is read."
      : "Recent chats will appear here.";

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-[15px] font-semibold text-ink">{heading}</p>
      <p className="mt-1 text-[13px] text-ink-2">{detail}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3" style={{ height: 72 }}>
          <div className="size-12 shrink-0 rounded-full bg-surface-sunken" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-surface-sunken" />
            <div className="h-2.5 w-2/3 rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
