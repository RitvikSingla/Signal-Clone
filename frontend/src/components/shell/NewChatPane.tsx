"use client";

/**
 * New chat, as Signal Desktop does it: the left pane itself turns into the
 * composer rather than a dialog opening over it. A back arrow and "New chat"
 * up top, a "Name, username, or number" field, three shortcuts (New group,
 * Find by username, Find by phone number), then the Contacts list ending in
 * Note to Self.
 *
 * The shortcuts are sub-views of the same pane. New group is two steps, as
 * in the recording: "Choose members" (chips above the list, round ticks,
 * Skip or Next at the bottom right), then "Name this group" (photo, a
 * required name, the disappearing-messages timer, the member list, Create).
 * Your groups are listed under the contacts.
 */

import { useEffect, useMemo, useState } from "react";

import { TimerSelect } from "@/components/chat/TimerSelect";

import { PaneHeader, PaneSearch, SidePane } from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import { PhotoPicker } from "@/components/ui/PhotoPicker";
import { AtIcon, CloseIcon, GroupIcon, HashIcon, VerifiedIcon } from "@/components/ui/Icons";
import { useToasts } from "@/components/ui/Toasts";
import { useChat } from "@/store/chat";
import { ApiError } from "@/lib/api";
import { conversationApi, userApi } from "@/lib/endpoints";
import type { Contact, ConversationSummary, UserPrivate, UserPublic } from "@/lib/types";

type View = "main" | "group-pick" | "group-name" | "username" | "phone";

type NewChatPaneProps = {
  user: UserPrivate;
  contacts: Contact[];
  groups: ConversationSummary[];
  onClose: () => void;
  onOpened: (conversationId: string) => void;
};

export function NewChatPane({ user, contacts, groups, onClose, onOpened }: NewChatPaneProps) {
  const push = useToasts((state) => state.push);

  const [view, setView] = useState<View>("main");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [selected, setSelected] = useState<UserPublic[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [groupTimer, setGroupTimer] = useState(0);
  const [busy, setBusy] = useState(false);

  // Directory lookup, so someone not yet in the address book is reachable.
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
    const merged = new Map<string, UserPublic>();
    for (const contact of contacts) {
      if (!contact.is_blocked) merged.set(contact.user.id, contact.user);
    }
    if (query.trim().length >= 2) {
      for (const person of results) merged.set(person.id, person);
    }
    merged.delete(user.id);
    const needle = query.trim().toLowerCase();
    return [...merged.values()]
      .filter(
        (person) =>
          !needle ||
          person.display_name.toLowerCase().includes(needle) ||
          person.phone_number.includes(needle) ||
          (person.username ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [contacts, results, query, user.id]);

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

  const addContact = useChat((state) => state.addContact);
  const contactIds = useMemo(
    () => new Set(contacts.filter((c) => !c.is_blocked).map((c) => c.user.id)),
    [contacts],
  );

  async function addToContacts(person: UserPublic) {
    try {
      await addContact(person.id);
      push(`${person.display_name} added to your contacts`);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not add the contact.");
    }
  }

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups.filter((g) => !needle || g.title.toLowerCase().includes(needle));
  }, [groups, query]);

  async function createGroup() {
    setBusy(true);
    try {
      const conversation = await conversationApi.createGroup({
        name: groupName.trim(),
        member_ids: selected.map((p) => p.id),
        avatar_url: groupPhoto,
        disappearing_seconds: groupTimer,
      });
      onOpened(conversation.id);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not create the group.");
    } finally {
      setBusy(false);
    }
  }

  function togglePerson(person: UserPublic) {
    setSelected((current) =>
      current.some((p) => p.id === person.id)
        ? current.filter((p) => p.id !== person.id)
        : [...current, person],
    );
  }

  if (view === "username" || view === "phone") {
    return (
      <FindBy
        kind={view}
        onBack={() => setView("main")}
        onFound={(person) => void startDirect(person)}
      />
    );
  }

  if (view === "group-name") {
    return (
      <SidePane>
        <PaneHeader title="Name this group" onBack={() => setView("group-pick")} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3">
          <div className="flex justify-center">
            <PhotoPicker
              upload
              value={groupPhoto}
              size={80}
              label={groupPhoto ? "Change group photo" : "Add group photo"}
              fallback={
                <span className="flex size-full items-center justify-center rounded-full bg-[#e3e3fe] text-[#3838f5]">
                  <GroupIcon size={36} strokeWidth={1.5} />
                </span>
              }
              onUploaded={setGroupPhoto}
              onRemove={() => setGroupPhoto(null)}
            />
          </div>
          <input
            autoFocus
            value={groupName}
            maxLength={32}
            onChange={(event) => setGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && groupName.trim()) void createGroup();
            }}
            placeholder="Group name (required)"
            aria-label="Group name"
            className="mt-5 h-9 w-full rounded-md border border-ultramarine/70 bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:border-ultramarine focus:ring-1 focus:ring-ultramarine"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Disappearing messages</span>
            <TimerSelect value={groupTimer} onChange={setGroupTimer} align="right" />
          </div>
          <p className="mt-5 text-[13px] font-semibold text-ink">Members</p>
          <div className="mt-1.5">
            {selected.length === 0 && (
              <p className="py-2 text-[12.5px] text-ink-2">Just you for now. Add people later.</p>
            )}
            {selected.map((person) => (
              <div key={person.id} className="flex items-center gap-3 py-1.5">
                <Avatar
                  name={person.display_name}
                  colorKey={person.avatar_color}
                  url={person.avatar_url}
                  size={30}
                />
                <span className="truncate text-[13px] font-semibold text-ink">
                  {person.display_name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end p-3">
          <button
            type="button"
            disabled={busy || !groupName.trim()}
            onClick={() => void createGroup()}
            className="h-8 rounded-md bg-ultramarine px-5 text-[13px] font-semibold text-white transition hover:bg-ultramarine-hover disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </SidePane>
    );
  }

  const picking = view === "group-pick";

  return (
    <SidePane>
      <PaneHeader
        title={picking ? "Choose members" : "New chat"}
        onBack={() => {
          if (picking) {
            setView("main");
            setSelected([]);
          } else onClose();
        }}
      />

      <PaneSearch
        id="people-search"
        value={query}
        placeholder="Name, username, or number"
        onChange={setQuery}
        autoFocus
      />

      {picking && selected.length > 0 && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto px-3 pb-2">
          {selected.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => togglePerson(person)}
              className="flex items-center gap-1.5 rounded-full bg-surface-sunken py-0.5 pl-0.5 pr-2 text-[12px] text-ink"
            >
              <Avatar name={person.display_name} colorKey={person.avatar_color} size={20} />
              {person.display_name.split(" ")[0]}
              <CloseIcon size={11} />
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {!picking && !query && (
          <>
            <ShortcutRow
              icon={<GroupIcon size={18} />}
              label="New group"
              onClick={() => setView("group-pick")}
            />
            <ShortcutRow
              icon={<AtIcon size={18} />}
              label="Find by username"
              onClick={() => setView("username")}
            />
            <ShortcutRow
              icon={<HashIcon size={18} />}
              label="Find by phone number"
              onClick={() => setView("phone")}
            />
          </>
        )}

        <p className="px-5 pb-1 pt-3 text-[13px] font-semibold text-ink">
          {query && !picking ? "Results" : "Contacts"}
        </p>

        {people.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-ink-2">
            {query.trim() ? `No contacts found for “${query.trim()}”` : "No contacts yet"}
          </p>
        )}

        {people.map((person) => {
          const picked = selected.some((p) => p.id === person.id);
          return (
            <button
              key={person.id}
              type="button"
              disabled={busy}
              onClick={() => (picking ? togglePerson(person) : void startDirect(person))}
              className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              <Avatar
                name={person.display_name}
                colorKey={person.avatar_color}
                url={person.avatar_url}
                size={32}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {person.display_name}
                </span>
                {!contactIds.has(person.id) && (
                  <span className="block truncate text-[11.5px] text-ink-2">
                    {person.username ? `@${person.username}` : person.phone_number}
                  </span>
                )}
              </span>
              {!picking && !contactIds.has(person.id) && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Add to contacts"
                  aria-label={`Add ${person.display_name} to contacts`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void addToContacts(person);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      void addToContacts(person);
                    }
                  }}
                  className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface-chip px-2.5 text-[12px] font-semibold text-link hover:brightness-110"
                >
                  + Add
                </span>
              )}
              {picking && (
                <span
                  className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                    picked ? "border-ultramarine bg-ultramarine text-white" : "border-ink-3"
                  }`}
                >
                  {picked && (
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                      <path
                        d="m2.5 6.2 2.2 2.2 4.8-4.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
              )}
            </button>
          );
        })}

        {!picking && !query && (
          <button
            type="button"
            onClick={() => push("Note to Self is not available in this build.")}
            className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
          >
            <Avatar
              name={user.display_name}
              colorKey={user.avatar_color}
              url={user.avatar_url}
              size={32}
            />
            <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
              Note to Self
              <VerifiedIcon size={13} />
            </span>
          </button>
        )}

        {!picking && visibleGroups.length > 0 && (
          <>
            <p className="px-5 pb-1 pt-3 text-[13px] font-semibold text-ink">Groups</p>
            {visibleGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => onOpened(group.id)}
                className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
              >
                <Avatar
                  name={group.title}
                  colorKey={group.avatar_color}
                  url={group.avatar_url}
                  size={32}
                  group
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {group.title}
                  </span>
                  <span className="block text-[12px] text-ink-2">
                    {group.member_count} {group.member_count === 1 ? "member" : "members"}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {picking && (
        <div className="flex justify-end p-3">
          <button
            type="button"
            onClick={() => setView("group-name")}
            className="h-8 rounded-md bg-ultramarine px-4 text-[13px] font-semibold text-white transition hover:bg-ultramarine-hover"
          >
            {selected.length ? "Next" : "Skip"}
          </button>
        </div>
      )}
    </SidePane>
  );
}

function ShortcutRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink">
        {icon}
      </span>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
    </button>
  );
}

/** Find by username / phone: one field, one lookup, then the chat opens. */
function FindBy({
  kind,
  onBack,
  onFound,
}: {
  kind: "username" | "phone";
  onBack: () => void;
  onFound: (person: UserPublic) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookUp() {
    const raw = value.trim().replace(/^@/, "");
    if (!raw) return;
    setBusy(true);
    setError(null);
    try {
      const hits = await userApi.search(raw);
      const match = hits.find((person) =>
        kind === "username"
          ? (person.username ?? "").toLowerCase() === raw.toLowerCase()
          : person.phone_number.replace(/\D/g, "").endsWith(raw.replace(/\D/g, "")),
      );
      if (match) onFound(match);
      else
        setError(
          kind === "username"
            ? `@${raw} is not a Signal user. Make sure you’ve entered the complete username.`
            : `${raw} is not a Signal user.`,
        );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePane>
      <PaneHeader
        title={kind === "username" ? "Find by username" : "Find by phone number"}
        onBack={onBack}
      />
      <div className="px-4 pt-2">
        <label className="relative block">
          {kind === "username" && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-2">
              @
            </span>
          )}
          <input
            autoFocus
            value={value}
            inputMode={kind === "phone" ? "tel" : "text"}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void lookUp();
            }}
            placeholder={kind === "username" ? "Username" : "Phone number"}
            className={`h-9 w-full rounded-lg bg-surface-sunken pr-3 text-[14px] text-ink outline-none placeholder:text-ink-2 focus:ring-2 focus:ring-ultramarine ${
              kind === "username" ? "pl-7" : "pl-3"
            }`}
          />
        </label>
        <p className={`mt-2 text-[12px] leading-snug ${error ? "text-danger" : "text-ink-2"}`}>
          {error ??
            (kind === "username"
              ? "Enter the complete username of the person you want to message."
              : "Enter the full number, including the country code.")}
        </p>
      </div>
      <div className="mt-auto flex justify-end p-4">
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void lookUp()}
          className="h-9 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white transition hover:bg-ultramarine-hover disabled:opacity-50"
        >
          {busy ? "Searching…" : "Next"}
        </button>
      </div>
    </SidePane>
  );
}
