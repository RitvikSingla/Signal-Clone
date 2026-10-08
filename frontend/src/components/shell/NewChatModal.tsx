"use client";

/**
 * New chat and new group.
 *
 * Signal's flow is two steps for a group: pick people, then name it. One
 * step for a direct thread: pick a person and the conversation opens.
 */

import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, GroupIcon, SearchIcon } from "@/components/ui/Icons";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { conversationApi, userApi } from "@/lib/endpoints";
import type { Contact, UserPublic } from "@/lib/types";

type NewChatModalProps = {
  currentUserId: string;
  onClose: () => void;
  onOpened: (conversationId: string) => void;
};

type Mode = "pick" | "name-group";

export function NewChatModal({ currentUserId, onClose, onOpened }: NewChatModalProps) {
  const push = useToasts((state) => state.push);

  const [mode, setMode] = useState<Mode>("pick");
  const [groupMode, setGroupMode] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [results, setResults] = useState<UserPublic[]>([]);
  const [selected, setSelected] = useState<UserPublic[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    userApi
      .contacts()
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  // Directory lookup, so someone not yet in the address book is reachable.
  // Debounced, and every state change happens inside the timer callback so
  // typing never triggers a cascading render.
  useEffect(() => {
    const needle = query.trim();
    const timer = setTimeout(() => {
      if (needle.length < 2) {
        setResults([]);
        return;
      }
      userApi
        .search(needle)
        .then(setResults)
        .catch(() => setResults([]));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const people = useMemo(() => {
    const fromContacts = contacts.map((c) => c.user);
    const merged = new Map<string, UserPublic>();
    for (const person of [...fromContacts, ...results]) {
      if (person.id !== currentUserId) merged.set(person.id, person);
    }
    const needle = query.trim().toLowerCase();
    return [...merged.values()].filter(
      (person) =>
        !needle ||
        person.display_name.toLowerCase().includes(needle) ||
        person.phone_number.includes(needle) ||
        (person.username ?? "").toLowerCase().includes(needle),
    );
  }, [contacts, results, query, currentUserId]);

  function togglePerson(person: UserPublic) {
    if (!groupMode) {
      void startDirect(person);
      return;
    }
    setSelected((current) =>
      current.some((p) => p.id === person.id)
        ? current.filter((p) => p.id !== person.id)
        : [...current, person],
    );
  }

  async function startDirect(person: UserPublic) {
    setBusy(true);
    try {
      const conversation = await conversationApi.createDirect(person.id);
      onOpened(conversation.id);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not open that chat.");
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    setBusy(true);
    try {
      const conversation = await conversationApi.createGroup({
        name: groupName.trim(),
        member_ids: selected.map((p) => p.id),
      });
      push(`Group “${conversation.title}” created.`);
      onOpened(conversation.id);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={groupMode ? "New group" : "New chat"}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="flex-1 text-[16px] font-semibold text-ink">
            {mode === "name-group" ? "Name this group" : groupMode ? "New group" : "New chat"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {mode === "pick" ? (
          <>
            <div className="px-4 py-3">
              <label className="relative block">
                <span className="sr-only">Search people</span>
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  id="people-search"
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, username or number"
                  className="h-9 w-full rounded-full bg-surface-sunken pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
                />
              </label>
            </div>

            {!groupMode && (
              <button
                type="button"
                onClick={() => setGroupMode(true)}
                className="flex items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-ultramarine text-white">
                  <GroupIcon size={18} />
                </span>
                <span className="text-[14px] font-medium text-ink">New group</span>
              </button>
            )}

            {groupMode && selected.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3">
                {selected.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => togglePerson(person)}
                    className="flex items-center gap-1.5 rounded-full bg-ultramarine-soft py-1 pl-1 pr-2.5 text-[12px] text-ultramarine"
                  >
                    <Avatar
                      name={person.display_name}
                      colorKey={person.avatar_color}
                      size={20}
                    />
                    {person.display_name.split(" ")[0]}
                    <CloseIcon size={12} />
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {people.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px] text-ink-3">
                  {query.trim().length > 0
                    ? "Nobody matches that"
                    : "No contacts yet"}
                </p>
              )}
              {people.map((person) => {
                const picked = selected.some((p) => p.id === person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    disabled={busy}
                    onClick={() => togglePerson(person)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
                  >
                    <Avatar
                      name={person.display_name}
                      colorKey={person.avatar_color}
                      url={person.avatar_url}
                      size={38}
                      online={person.is_online}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-ink">
                        {person.display_name}
                      </div>
                      <div className="truncate text-[12px] text-ink-3">
                        {person.username ? `@${person.username}` : person.phone_number}
                      </div>
                    </div>
                    {groupMode && (
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          picked
                            ? "border-ultramarine bg-ultramarine text-white"
                            : "border-border-strong"
                        }`}
                      >
                        {picked && <span className="text-[11px]">✓</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {groupMode && (
              <footer className="flex gap-2 border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setGroupMode(false);
                    setSelected([]);
                  }}
                  className="h-9 flex-1 rounded-full border border-border text-[13px] text-ink-2 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={() => setMode("name-group")}
                  className="h-9 flex-1 rounded-full bg-ultramarine text-[13px] font-medium text-white disabled:opacity-50"
                >
                  Next ({selected.length})
                </button>
              </footer>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            <label htmlFor="group-name" className="text-[13px] font-medium text-ink">
              Group name
            </label>
            <input
              id="group-name"
              autoFocus
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Weekend Trek"
              className="h-10 rounded-lg border border-border bg-surface-sunken px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
            />
            <p className="text-[12px] text-ink-3">
              {selected.length} {selected.length === 1 ? "person" : "people"} plus you.
              You will be the admin.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("pick")}
                className="h-9 flex-1 rounded-full border border-border text-[13px] text-ink-2 hover:text-ink"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || groupName.trim().length === 0}
                onClick={() => void createGroup()}
                className="h-9 flex-1 rounded-full bg-ultramarine text-[13px] font-medium text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create group"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
