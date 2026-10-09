"use client";

/**
 * The Calls tab.
 *
 * Calling itself is a placeholder, which the brief permits, but the screen
 * around it is the real one: the same pane frame, Create a Call Link (which
 * does create a link, kept on this device and listed under it), the Start
 * new call picker behind the phone-plus button, and Signal's own wording
 * for the empty states, including the inline icon in "Click [icon] to start
 * a new voice or video call."
 */

import { useMemo, useState } from "react";

import {
  ContentEmpty,
  PaneEmpty,
  PaneHeader,
  PaneIconButton,
  PaneSearch,
  SidePane,
} from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import { CopyIcon, LinkIcon, MoreIcon, NewCallIcon, PhoneIcon, VideoIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { DialogButton, Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";
import type { Contact } from "@/lib/types";
import { useUi, type CallLink } from "@/store/ui";

export function CallsPane({
  contacts,
  onComingSoon,
}: {
  contacts: Contact[];
  onComingSoon: (what: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [missedOnly, setMissedOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState<CallLink | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  const callLinks = useUi((state) => state.callLinks);
  const addCallLink = useUi((state) => state.addCallLink);

  const needle = search.trim().toLowerCase();
  const visibleLinks = useMemo(
    () => callLinks.filter((link) => !needle || link.name.toLowerCase().includes(needle)),
    [callLinks, needle],
  );

  function newLink(): CallLink {
    const alphabet = "bcdfghkmnpqrstxz";
    const chunk = () =>
      Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => alphabet[b % alphabet.length]).join("");
    const key = Array.from({ length: 8 }, chunk).join("-");
    return {
      id: crypto.randomUUID(),
      name: "Signal call",
      url: `https://signal.link/call/#key=${key}`,
      created_at: new Date().toISOString(),
    };
  }

  if (picking) {
    return (
      <>
        <StartCallPicker
          contacts={contacts}
          onBack={() => setPicking(false)}
          onCall={(kind) => onComingSoon(kind === "video" ? "Video calls" : "Voice calls")}
        />
        <CallsEmpty />
      </>
    );
  }

  const linkDetail = callLinks.find((link) => link.id === selectedLink);

  return (
    <>
      <SidePane>
        <PaneHeader title="Calls">
          <PaneIconButton label="New call" onClick={() => setPicking(true)}>
            <NewCallIcon size={17} />
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
                align="right"
                onClose={() => setMenuOpen(false)}
                items={[
                  {
                    label: missedOnly ? "Show all calls" : "Filter by missed",
                    onSelect: () => setMissedOnly((on) => !on),
                  },
                  { label: "Clear call history", onSelect: () => onComingSoon("Call history controls") },
                ]}
              />
            )}
          </div>
        </PaneHeader>

        <PaneSearch
          id="calls-search"
          value={search}
          onChange={setSearch}
          filter={{
            active: missedOnly,
            label: "Filter by missed",
            onToggle: () => setMissedOnly((on) => !on),
          }}
        />

        <button
          type="button"
          onClick={() => setCreating(newLink())}
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink">
            <LinkIcon size={17} />
          </span>
          <span className="text-[13px] font-semibold text-ink">Create a Call Link</span>
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!missedOnly &&
            visibleLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setSelectedLink(link.id)}
                className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  selectedLink === link.id ? "bg-surface-selected" : "hover:bg-surface-hover"
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dde7fc] text-[#1251d3]">
                  <LinkIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{link.name}</span>
                  <span className="block truncate text-[12px] text-ink-2">Call link</span>
                </span>
              </button>
            ))}

          {(missedOnly || visibleLinks.length === 0) && (
            <PaneEmpty
              heading={missedOnly ? "No missed calls" : needle ? "No results" : "No calls"}
              detail={needle ? `No results for “${search.trim()}”` : "Recent calls will appear here."}
            />
          )}
        </div>
      </SidePane>

      {linkDetail ? (
        <CallLinkDetail link={linkDetail} onJoin={() => onComingSoon("Calls")} />
      ) : (
        <CallsEmpty />
      )}

      {creating && (
        <CreateLinkDialog
          link={creating}
          onClose={() => setCreating(null)}
          onDone={(link) => {
            addCallLink(link);
            setSelectedLink(link.id);
            setCreating(null);
          }}
        />
      )}
    </>
  );
}

function CallsEmpty() {
  return (
    <ContentEmpty icon={<PhoneIcon size={34} strokeWidth={1.4} />}>
      Click <NewCallIcon size={15} className="inline -translate-y-px" /> to start a new voice or
      video call.
    </ContentEmpty>
  );
}

function CreateLinkDialog({
  link,
  onClose,
  onDone,
}: {
  link: CallLink;
  onClose: () => void;
  onDone: (link: CallLink) => void;
}) {
  const push = useToasts((state) => state.push);
  const [name, setName] = useState("");
  const final = { ...link, name: name.trim() || "Signal call" };

  return (
    <Modal onClose={onClose} label="Create call link" width={420} closeButton>
      <h2 className="text-center text-[15px] font-semibold text-ink">Create call link</h2>
      <div className="mt-5 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#dde7fc] text-[#1251d3]">
          <LinkIcon size={20} />
        </span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add call name"
          className="h-9 min-w-0 flex-1 rounded-lg bg-surface-chip px-3 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:ring-2 focus:ring-ultramarine"
        />
      </div>
      <div className="mt-4 rounded-lg bg-surface-chip px-3 py-2.5">
        <p className="truncate text-[12.5px] text-ink">{link.url}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(link.url);
          push("Call link copied");
        }}
        className="mt-2 flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px] text-ink hover:bg-surface-hover"
      >
        <CopyIcon size={15} /> Copy link
      </button>
      <div className="mt-4 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onClose}>
          Cancel
        </DialogButton>
        <DialogButton variant="primary" onClick={() => onDone(final)}>
          Done
        </DialogButton>
      </div>
    </Modal>
  );
}

function CallLinkDetail({ link, onJoin }: { link: CallLink; onJoin: () => void }) {
  const push = useToasts((state) => state.push);
  return (
    <section className="hidden min-w-0 flex-1 flex-col items-center bg-surface px-6 pt-16 md:flex">
      <span className="flex size-20 items-center justify-center rounded-full bg-[#dde7fc] text-[#1251d3]">
        <LinkIcon size={34} />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold text-ink">{link.name}</h2>
      <p className="mt-1 max-w-md truncate text-[12.5px] text-ink-2">{link.url}</p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onJoin}
          className="h-8 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white hover:bg-ultramarine-hover"
        >
          Join
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(link.url);
            push("Call link copied");
          }}
          className="h-8 rounded-full bg-surface-chip px-5 text-[13px] font-semibold text-ink hover:brightness-110"
        >
          Copy link
        </button>
      </div>
    </section>
  );
}

function StartCallPicker({
  contacts,
  onBack,
  onCall,
}: {
  contacts: Contact[];
  onBack: () => void;
  onCall: (kind: "video" | "voice") => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const people = contacts
    .filter((c) => !c.is_blocked)
    .map((c) => c.user)
    .filter((u) => !needle || u.display_name.toLowerCase().includes(needle))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <SidePane>
      <PaneHeader title="Start new call" onBack={onBack} />
      <PaneSearch
        id="call-picker-search"
        value={query}
        onChange={setQuery}
        placeholder="Search"
        autoFocus
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-5 pb-1 pt-2 text-[13px] font-semibold text-ink">Contacts</p>
        {people.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-ink-2">No contacts found</p>
        )}
        {people.map((person) => (
          <div
            key={person.id}
            className="mx-2 flex items-center gap-3 rounded-lg px-2.5 py-1.5 hover:bg-surface-hover"
          >
            <Avatar name={person.display_name} colorKey={person.avatar_color} url={person.avatar_url} size={32} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {person.display_name}
            </span>
            <button
              type="button"
              onClick={() => onCall("video")}
              aria-label={`Video call ${person.display_name}`}
              className="flex size-8 items-center justify-center rounded-full bg-surface-sunken text-ink hover:brightness-110"
            >
              <VideoIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => onCall("voice")}
              aria-label={`Voice call ${person.display_name}`}
              className="flex size-8 items-center justify-center rounded-full bg-surface-sunken text-ink hover:brightness-110"
            >
              <PhoneIcon size={15} />
            </button>
          </div>
        ))}
      </div>
    </SidePane>
  );
}
