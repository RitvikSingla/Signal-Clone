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
  ComposeIcon,
  FolderIcon,
  MoonIcon,
  MoreIcon,
  SettingsIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { messageApi } from "@/lib/endpoints";
import { listTimestamp } from "@/lib/format";
import type {
  Contact,
  ConversationSummary,
  MessageSearchHit,
  UserPrivate,
} from "@/lib/types";

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

  const messageHits = useMessageSearch(needle);

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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {loading && <ListSkeleton />}

        {!loading && error && (
          <p className="px-4 py-6 text-[13px] text-danger">{error}</p>
        )}

        {!loading && !error && needle && (
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
              <button
                key={hit.message_id}
                type="button"
                onClick={() => onSelect(hit.conversation_id)}
                className="mx-2 flex w-[calc(100%-1rem)] flex-col rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {hit.conversation_title}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-ink-2">
                    {listTimestamp(hit.created_at)}
                  </span>
                </span>
                <span className="truncate text-[12.5px] text-ink-2">
                  {hit.sender_name ? `${hit.sender_name.split(" ")[0]}: ` : ""}
                  <Highlight text={hit.body ?? ""} needle={needle} />
                </span>
              </button>
            ))}

            {visible.length === 0 && contactHits.length === 0 && messageHits.length === 0 && (
              <PaneEmpty heading="No results" detail={`No results for “${search.trim()}”`} />
            )}
          </>
        )}

        {!loading && !error && !needle && visible.length === 0 && (
          <PaneEmpty
            heading={filter === "unread" ? "No unread chats" : "No chats"}
            detail={
              filter === "unread" ? "Everything is read." : "Recent chats will appear here."
            }
          />
        )}

        {!loading &&
          !needle &&
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
              These chats are archived and will only appear in the Chats list if new
              messages are received.
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
  return (
    <div className="px-5 pb-1 pt-3 text-[13px] font-semibold text-ink">{children}</div>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  const index = text.toLowerCase().indexOf(needle);
  if (!needle || index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-ink">
        {text.slice(index, index + needle.length)}
      </strong>
      {text.slice(index + needle.length)}
    </>
  );
}

/** Full-text search over message bodies, debounced. */
function useMessageSearch(needle: string): MessageSearchHit[] {
  const [hits, setHits] = useState<MessageSearchHit[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (needle.length < 2) {
        setHits([]);
        return;
      }
      messageApi
        .search(needle)
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [needle]);

  return needle.length < 2 ? [] : hits;
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
