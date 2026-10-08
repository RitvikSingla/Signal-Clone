"use client";

/**
 * The middle pane: header, search, filter and the scrolling list.
 */

import { useMemo } from "react";

import { ConversationRow } from "@/components/conversations/ConversationRow";
import { Avatar } from "@/components/ui/Avatar";
import { ComposeIcon, SearchIcon } from "@/components/ui/Icons";
import type { ConversationSummary, UserPrivate } from "@/lib/types";

type ConversationListProps = {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  user: UserPrivate;
  filter: "all" | "unread";
  search: string;
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
  onFilterChange,
  onSearchChange,
  onSelect,
  onCompose,
}: ConversationListProps) {
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

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface-raised md:w-list">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Avatar
          name={user.display_name}
          colorKey={user.avatar_color}
          url={user.avatar_url}
          size={28}
        />
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Chats</h1>
        <button
          type="button"
          onClick={onCompose}
          className="ml-auto flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
          aria-label="New chat"
          title="New chat"
        >
          <ComposeIcon />
        </button>
      </header>

      <div className="px-3 pb-2">
        <label className="relative block">
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
      </div>

      <div className="flex gap-2 px-3 pb-2">
        <FilterChip
          label="All"
          active={filter === "all"}
          onClick={() => onFilterChange("all")}
        />
        <FilterChip
          label="Unread"
          count={unreadTotal}
          active={filter === "unread"}
          onClick={() => onFilterChange("unread")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && <ListSkeleton />}

        {!loading && error && (
          <p className="px-4 py-6 text-[13px] text-danger">{error}</p>
        )}

        {!loading && !error && visible.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">
            {search
              ? `No conversations matching “${search}”`
              : filter === "unread"
                ? "Nothing unread"
                : "No conversations yet"}
          </p>
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

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
        active
          ? "bg-ultramarine text-white"
          : "bg-surface-sunken text-ink-2 hover:text-ink"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className={active ? "text-white/80" : "text-ink-3"}>{count}</span>
      )}
    </button>
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
