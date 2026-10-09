"use client";

/**
 * The middle pane: header, search, and the scrolling list.
 *
 * Matching Signal Desktop: the title sits alone on the left with the compose
 * and overflow buttons on the right, and the unread filter is an icon beside
 * the search field rather than a row of chips. The overflow menu carries
 * View Archive, Add chat folder and the Notification profile submenu, as in
 * the recording. Typing in the search field turns the list into Signal's
 * sectioned results: Chats, Contacts, then Messages.
 */

import { useEffect, useMemo, useState } from "react";

import { ConversationRow } from "@/components/conversations/ConversationRow";
import {
  PaneEmpty,
  PaneHeader,
  PaneIconButton,
  PaneSearch,
  SidePane,
} from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import {
  ArchiveIcon,
  CloseIcon,
  ComposeIcon,
  FolderIcon,
  MoonIcon,
  MoreIcon,
  SettingsIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { messageApi } from "@/lib/endpoints";
import { listTimestamp } from "@/lib/format";
import type { Contact, ConversationSummary, MessageSearchHit, UserPrivate } from "@/lib/types";

type ConversationListProps = {
  conversations: ConversationSummary[];
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  user: UserPrivate;
  filter: "all" | "unread";
  search: string;
  typing: Record<string, { userId: string }[]>;
  isRequest: (conversation: ConversationSummary) => boolean;
  onFilterChange: (filter: "all" | "unread") => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
  onOpenContact: (userId: string) => void;
  /** Open a search hit: the thread, scrolled to that message. */
  onOpenMessage: (conversationId: string, messageId: string) => void;
  /** Set while searching inside one chat (the header's search button). */
  scope: ConversationSummary | null;
  onClearScope: () => void;
  onViewArchive: () => void;
  onOpenSettings: (section: "chats" | "notifications") => void;
};

export function ConversationList({
  conversations,
  contacts,
  loading,
  error,
  activeId,
  user,
  filter,
  search,
  typing,
  isRequest,
  onFilterChange,
  onSearchChange,
  onSelect,
  onCompose,
  onOpenContact,
  onOpenMessage,
  scope,
  onClearScope,
  onViewArchive,
  onOpenSettings,
}: ConversationListProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const needle = search.trim().toLowerCase();

  const visible = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (!needle) return true;
      return c.title.toLowerCase().includes(needle);
    });
  }, [conversations, filter, needle]);

  // Contacts with no conversation yet, so search can start one.
  const contactHits = useMemo(() => {
    if (!needle) return [];
    const withThread = new Set(
      conversations.filter((c) => c.type === "direct").map((c) => c.peer?.id),
    );
    return contacts.filter(
      (c) =>
        !c.is_blocked &&
        !withThread.has(c.user.id) &&
        (c.user.display_name.toLowerCase().includes(needle) ||
          (c.user.username ?? "").toLowerCase().includes(needle) ||
          c.user.phone_number.includes(needle)),
    );
  }, [contacts, conversations, needle]);

  const { hits: messageHits, searching } = useMessageSearch(needle, scope?.id ?? null);

  return (
    <SidePane>
      <PaneHeader title="Chats">
        <PaneIconButton label="New chat" onClick={onCompose}>
          <ComposeIcon size={17} />
        </PaneIconButton>
        <div className="relative">
          <PaneIconButton
            label="More options"
            active={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreIcon size={17} />
          </PaneIconButton>
          {menuOpen && (
            <Menu
              align="left"
              onClose={() => setMenuOpen(false)}
              items={[
                { label: "View Archive", icon: <ArchiveIcon />, onSelect: onViewArchive },
                {
                  label: "Add chat folder",
                  icon: <FolderIcon />,
                  onSelect: () => onOpenSettings("chats"),
                },
                {
                  label: "Notification profile",
                  icon: <MoonIcon />,
                  submenu: [
                    { type: "header", label: "Notification Profile" },
                    {
                      label: "Settings",
                      icon: <SettingsIcon size={16} />,
                      onSelect: () => onOpenSettings("notifications"),
                    },
                  ],
                },
              ]}
            />
          )}
        </div>
      </PaneHeader>

      {scope ? (
        <ScopedSearch
          scope={scope}
          value={search}
          onChange={onSearchChange}
          onClear={onClearScope}
        />
      ) : (
        <PaneSearch
          id="conversation-search"
          value={search}
          onChange={onSearchChange}
          filter={{
            active: filter === "unread",
            label: filter === "unread" ? "Show all chats" : "Filter by unread",
            onToggle: () => onFilterChange(filter === "unread" ? "all" : "unread"),
          }}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {loading && <ListSkeleton />}

        {!loading && error && <p className="px-4 py-6 text-[13px] text-danger">{error}</p>}

        {!loading && !error && scope && needle && (
          <>
            {searching && messageHits.length === 0 ? (
              <ResultSkeleton />
            ) : messageHits.length > 0 ? (
              <>
                <SectionLabel>Messages</SectionLabel>
                {messageHits.map((hit) => (
                  <MessageHitRow
                    key={hit.message_id}
                    hit={hit}
                    needle={needle}
                    user={user}
                    conversations={conversations}
                    onOpen={onOpenMessage}
                  />
                ))}
              </>
            ) : (
              <PaneEmpty
                heading="No results"
                detail={`No results for “${search.trim()}” in this chat`}
              />
            )}
          </>
        )}

        {!loading && !error && scope && !needle && (
          <PaneEmpty
            heading="Search chat"
            detail={`Find messages in your chat with ${scope.title}.`}
          />
        )}

        {!loading && !error && !scope && needle && (
          <>
            {visible.length > 0 && <SectionLabel>Chats</SectionLabel>}
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === activeId}
                currentUserId={user.id}
                isRequest={isRequest(conversation)}
                typing={(typing[conversation.id] ?? []).length > 0}
                onSelect={onSelect}
              />
            ))}

            {contactHits.length > 0 && <SectionLabel>Contacts</SectionLabel>}
            {contactHits.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => onOpenContact(contact.user.id)}
                className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <Avatar
                  name={contact.user.display_name}
                  colorKey={contact.user.avatar_color}
                  url={contact.user.avatar_url}
                  size={36}
                />
                <span className="truncate text-[13.5px] font-semibold text-ink">
                  {contact.user.display_name}
                </span>
              </button>
            ))}

            {messageHits.length > 0 && <SectionLabel>Messages</SectionLabel>}
            {messageHits.map((hit) => (
              <MessageHitRow
                key={hit.message_id}
                hit={hit}
                needle={needle}
                user={user}
                conversations={conversations}
                onOpen={onOpenMessage}
              />
            ))}
            {searching && messageHits.length === 0 && <ResultSkeleton rows={2} />}

            {visible.length === 0 && contactHits.length === 0 && messageHits.length === 0 && (
              <PaneEmpty heading="No results" detail={`No results for “${search.trim()}”`} />
            )}
          </>
        )}

        {!loading && !error && !needle && !scope && visible.length === 0 && (
          <PaneEmpty
            heading={filter === "unread" ? "No unread chats" : "No chats"}
            detail={filter === "unread" ? "Everything is read." : "Recent chats will appear here."}
          />
        )}

        {!loading &&
          !needle &&
          !scope &&
          visible.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === activeId}
              currentUserId={user.id}
              isRequest={isRequest(conversation)}
              typing={(typing[conversation.id] ?? []).length > 0}
              onSelect={onSelect}
            />
          ))}
      </div>
    </SidePane>
  );
}

/** The Archive sub-view, reached from View Archive in the overflow menu. */
export function ArchiveList({
  archived,
  activeId,
  user,
  isRequest,
  onBack,
  onSelect,
}: {
  archived: ConversationSummary[];
  activeId: string | null;
  user: UserPrivate;
  isRequest: (conversation: ConversationSummary) => boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <SidePane>
      <PaneHeader title="Archive" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {archived.length === 0 ? (
          <PaneEmpty heading="No archived chats" detail="Archived chats will appear here." />
        ) : (
          <>
            <p className="px-5 pb-3 pt-1 text-[12px] leading-snug text-ink-2">
              These chats are archived and will only appear in the Chats list if new messages are
              received.
            </p>
            {archived.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === activeId}
                currentUserId={user.id}
                isRequest={isRequest(conversation)}
                typing={false}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </div>
    </SidePane>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pb-1 pt-3 text-[13px] font-semibold text-ink">{children}</div>;
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  const index = text.toLowerCase().indexOf(needle);
  if (!needle || index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-ink">{text.slice(index, index + needle.length)}</strong>
      {text.slice(index + needle.length)}
    </>
  );
}

/** Full-text search over message bodies, debounced; optionally one chat. */
function useMessageSearch(
  needle: string,
  conversationId: string | null,
): { hits: MessageSearchHit[]; searching: boolean } {
  const [state, setState] = useState<{ key: string; hits: MessageSearchHit[] }>({
    key: "",
    hits: [],
  });
  const key = `${conversationId ?? "*"}:${needle}`;
  const minLength = conversationId ? 1 : 2;

  useEffect(() => {
    if (needle.length < minLength) return;
    let live = true;
    const timer = setTimeout(() => {
      messageApi
        .search(needle, conversationId)
        .then((hits) => live && setState({ key, hits }))
        .catch(() => live && setState({ key, hits: [] }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [needle, conversationId, key, minLength]);

  if (needle.length < minLength) return { hits: [], searching: false };
  return { hits: state.key === key ? state.hits : [], searching: state.key !== key };
}

/** "You to Aarav" / "Aarav to You", the way Signal titles a message hit. */
function MessageHitRow({
  hit,
  needle,
  user,
  conversations,
  onOpen,
}: {
  hit: MessageSearchHit;
  needle: string;
  user: UserPrivate;
  conversations: ConversationSummary[];
  onOpen: (conversationId: string, messageId: string) => void;
}) {
  const conversation = conversations.find((c) => c.id === hit.conversation_id);
  const mine = hit.sender_id === user.id;
  const senderName = mine ? user.display_name : (hit.sender_name ?? "Unknown");
  const senderColor = mine
    ? user.avatar_color
    : (conversation?.peer?.avatar_color ?? conversation?.avatar_color ?? "A200");
  const title =
    conversation?.type === "group"
      ? `${mine ? "You" : senderName} in ${hit.conversation_title}`
      : mine
        ? `You to ${hit.conversation_title}`
        : `${senderName} to You`;

  return (
    <button
      type="button"
      onClick={() => onOpen(hit.conversation_id, hit.message_id)}
      className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
    >
      <Avatar
        name={senderName}
        colorKey={senderColor}
        url={mine ? user.avatar_url : null}
        size={36}
      />
      <span className="min-w-0 flex-1">
        <span className="flex w-full items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold text-ink">{title}</span>
          <span className="ml-auto shrink-0 text-[11px] text-ink-2">
            {listTimestamp(hit.created_at)}
          </span>
        </span>
        <span className="block truncate text-[12.5px] text-ink-2">
          <Highlight text={hit.body ?? ""} needle={needle} />
        </span>
      </span>
    </button>
  );
}

/** The search field while scoped to one chat: a chip with the contact. */
function ScopedSearch({
  scope,
  value,
  onChange,
  onClear,
}: {
  scope: ConversationSummary;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="px-3 pb-2 pt-1">
      <div className="flex h-[30px] items-center gap-1.5 rounded-md bg-surface-sunken pl-1.5 pr-1 focus-within:ring-2 focus-within:ring-ultramarine">
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-chip py-0.5 pl-0.5 pr-1">
          <Avatar
            name={scope.title}
            colorKey={scope.avatar_color}
            url={scope.avatar_url}
            size={18}
          />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Stop searching in ${scope.title}`}
            className="flex size-4 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          >
            <CloseIcon size={11} strokeWidth={2.4} />
          </button>
        </span>
        <input
          id="conversation-search"
          type="search"
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClear();
          }}
          placeholder="Search chat"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-2"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="flex size-6 shrink-0 items-center justify-center rounded text-ink-2 hover:text-ink"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Grey placeholder rows while results load, as in the recording. */
function ResultSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse px-2 pt-1" aria-label="Searching">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2.5 py-2">
          <div className="size-9 shrink-0 rounded-full bg-surface-sunken" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-2/5 rounded bg-surface-sunken" />
            <div className="h-2.5 w-4/5 rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse px-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2.5" style={{ height: 64 }}>
          <div className="size-[42px] shrink-0 rounded-full bg-surface-sunken" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-surface-sunken" />
            <div className="h-2.5 w-2/3 rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
