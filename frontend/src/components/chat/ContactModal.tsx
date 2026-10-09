"use client";

/**
 * Signal's contact modal: what opens when you click a group member's
 * avatar or name in the thread, or a member in group settings.
 *
 *   - the photo and name (the name opens "About"), then round Message,
 *     Video and Voice buttons
 *   - Nickname, Block / Unblock, View safety number, Add to another group,
 *     and for admins Make admin / Remove as admin and Remove from group
 *
 * "About" lists the name, whether they are a Signal Connection (which opens
 * its own explainer), their about text, number, your note and the groups
 * you share. The Nickname dialog stores a first name, last name and note
 * that only you see.
 */

import { useMemo, useState, type ReactNode } from "react";

import { BlockIcon, SafetyNumberDialog } from "@/components/chat/ContactDetails";
import { Avatar } from "@/components/ui/Avatar";
import {
  ChatIcon,
  ChevronRightIcon,
  GroupIcon,
  LockIcon,
  PencilIcon,
  PersonIcon,
  PhoneIcon,
  SearchIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import { DialogButton, Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { conversationApi } from "@/lib/endpoints";
import { isAdmin } from "@/lib/groups";
import { nicknameOf } from "@/lib/nicknames";
import type { ConversationDetail, UserPublic } from "@/lib/types";
import { useChat } from "@/store/chat";

type Props = {
  person: UserPublic;
  /** The group this was opened from, for the admin rows; null elsewhere. */
  group: ConversationDetail | null;
  currentUserId: string;
  onClose: () => void;
  onMessage: (userId: string) => void;
  onCall: (userId: string, kind: "video" | "voice") => void;
};

type View =
  | "main"
  | "about"
  | "connection"
  | "nickname"
  | "add-group"
  | "safety"
  | "block"
  | "admin"
  | "remove";

export function ContactModal({ person, group, currentUserId, onClose, onMessage, onCall }: Props) {
  const push = useToasts((state) => state.push);
  const contact = useChat((state) => state.contacts.find((c) => c.user.id === person.id));
  const conversations = useChat((state) => state.conversations);
  const groupMembers = useChat((state) => state.groupMembers);
  const setDetail = useChat((state) => state.setDetail);
  const blockPeer = useChat((state) => state.blockPeer);
  const unblockPeer = useChat((state) => state.unblockPeer);
  const [view, setView] = useState<View>("main");

  const nickname = nicknameOf(contact);
  const name = nickname ?? person.display_name;
  const blocked = Boolean(contact?.is_blocked);
  const isMe = person.id === currentUserId;
  const member = group?.members.find((m) => m.user.id === person.id && m.is_active);
  const iAmAdmin = Boolean(group && isAdmin(group, currentUserId));
  const canManage = Boolean(group && member && iAmAdmin && !group.ended_at && !isMe);

  const commonGroups = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.type === "group" &&
          (groupMembers[c.id]?.includes(person.id) ||
            (group?.id === c.id && Boolean(member))) &&
          (groupMembers[c.id]?.includes(currentUserId) ?? true),
      ),
    [conversations, groupMembers, person.id, group?.id, member, currentUserId],
  );

  async function run(action: () => Promise<unknown>, done: string, failure: string) {
    try {
      await action();
      push(done);
      return true;
    } catch (error) {
      push(error instanceof ApiError ? error.message : failure);
      return false;
    }
  }

  const back = () => setView("main");

  if (view === "safety") {
    return <SafetyNumberDialog peerId={person.id} name={name} onClose={back} />;
  }
  if (view === "nickname") {
    return <NicknameDialog person={person} onClose={back} />;
  }
  if (view === "add-group") {
    return <AddToGroupDialog person={person} name={name} onClose={back} />;
  }
  if (view === "connection") {
    return <ConnectionExplainer onClose={() => setView("about")} />;
  }
  if (view === "about") {
    return (
      <Modal onClose={back} label={`About ${name}`} width={360} closeButton>
        <div className="flex flex-col items-center pt-2">
          <Avatar
            name={person.display_name}
            colorKey={person.avatar_color}
            url={person.avatar_url}
            size={120}
          />
        </div>
        <h2 className="mt-4 text-[17px] font-semibold text-ink">About</h2>
        <ul className="mt-2 flex flex-col gap-3 pb-1 text-[13.5px] text-ink">
          <AboutRow icon={<PersonIcon size={17} />}>
            {name}
            {nickname && (
              <span className="block text-[12px] text-ink-2">
                Profile name: {person.display_name}
              </span>
            )}
          </AboutRow>
          {contact && !blocked && (
            <AboutRow icon={<ConnectionGlyph />}>
              <button
                type="button"
                onClick={() => setView("connection")}
                className="flex items-center gap-0.5 hover:underline"
              >
                Signal Connection <ChevronRightIcon size={13} />
              </button>
            </AboutRow>
          )}
          {blocked && <AboutRow icon={<BlockIcon />}>Blocked</AboutRow>}
          {person.about && <AboutRow icon={<SmileGlyph />}>{person.about}</AboutRow>}
          {person.phone_number && <AboutRow icon={<PhoneIcon size={16} />}>{person.phone_number}</AboutRow>}
          {contact?.note && <AboutRow icon={<NoteGlyph />}>{contact.note}</AboutRow>}
          <AboutRow icon={<GroupIcon size={17} />}>
            {commonGroups.length === 0
              ? "No groups in common"
              : `Member of ${joinNames(commonGroups.map((g) => g.title))}`}
          </AboutRow>
        </ul>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} label={name} width={320} closeButton>
      <div className="flex flex-col items-center pt-3 text-center">
        <Avatar
          name={person.display_name}
          colorKey={person.avatar_color}
          url={person.avatar_url}
          size={80}
        />
        <button
          type="button"
          onClick={() => setView("about")}
          className="mt-3 flex items-center gap-1 text-[20px] font-semibold text-ink hover:opacity-85"
        >
          {isMe ? "You" : name}
          <ChevronRightIcon size={17} />
        </button>
        {member?.role === "admin" && <p className="text-[12px] text-ink-2">Admin</p>}
      </div>

      {!isMe && (
        <div className="mt-4 flex justify-center gap-6">
          <RoundButton
            label="Message"
            onClick={() => {
              onClose();
              onMessage(person.id);
            }}
          >
            <ChatIcon size={17} />
          </RoundButton>
          <RoundButton
            label="Video"
            disabled={blocked}
            onClick={() => {
              onClose();
              onCall(person.id, "video");
            }}
          >
            <VideoIcon size={17} />
          </RoundButton>
          <RoundButton
            label="Voice"
            disabled={blocked}
            onClick={() => {
              onClose();
              onCall(person.id, "voice");
            }}
          >
            <PhoneIcon size={16} />
          </RoundButton>
        </div>
      )}

      {!isMe && (
        <div className="relative mt-4 flex flex-col">
          <ModalRow icon={<PencilIcon size={16} />} onClick={() => setView("nickname")}>
            Nickname
          </ModalRow>
          {blocked ? (
            <ModalRow
              icon={<BlockIcon />}
              onClick={() =>
                void run(() => unblockPeer(person.id), `${name} unblocked`, "Could not unblock.")
              }
            >
              Unblock
            </ModalRow>
          ) : (
            <ModalRow icon={<BlockIcon />} onClick={() => setView("block")}>
              Block
            </ModalRow>
          )}
          <ModalRow icon={<ShieldGlyph />} onClick={() => setView("safety")}>
            View safety number
          </ModalRow>
          <ModalRow icon={<PlusCircleGlyph />} onClick={() => setView("add-group")}>
            Add to another group
          </ModalRow>
          {canManage && member && (
            <>
              <ModalRow icon={<KeyGlyph />} onClick={() => setView("admin")}>
                {member.role === "admin" ? "Remove as admin" : "Make admin"}
              </ModalRow>
              <ModalRow icon={<LeaveGlyph />} onClick={() => setView("remove")}>
                Remove from group
              </ModalRow>
            </>
          )}

          {view === "block" && (
            <InlineConfirm
              title={`Block ${name}?`}
              body="Blocked people won’t be able to call you or send you messages."
              confirmLabel="Block"
              danger
              onCancel={back}
              onConfirm={async () => {
                if (
                  await run(
                    () => blockPeer("", person.id, false),
                    `${name} blocked`,
                    "Could not block.",
                  )
                )
                  back();
              }}
            />
          )}
          {view === "admin" && group && member && (
            <InlineConfirm
              body={
                member.role === "admin"
                  ? `Remove ${name} as group admin?`
                  : `${name} will be able to edit this group and its members.`
              }
              confirmLabel={member.role === "admin" ? "Remove as admin" : "Make admin"}
              onCancel={back}
              onConfirm={async () => {
                const role = member.role === "admin" ? "member" : "admin";
                if (
                  await run(
                    async () =>
                      setDetail(await conversationApi.changeRole(group.id, person.id, role)),
                    role === "admin" ? `${name} is now an admin` : `${name} is no longer an admin`,
                    "Could not change the role.",
                  )
                )
                  back();
              }}
            />
          )}
          {view === "remove" && group && (
            <InlineConfirm
              body={`Remove ${name} from the group “${group.title}”?`}
              confirmLabel="Remove"
              danger
              onCancel={back}
              onConfirm={async () => {
                if (
                  await run(
                    async () => setDetail(await conversationApi.removeMember(group.id, person.id)),
                    `${name} removed from the group`,
                    "Could not remove them.",
                  )
                )
                  onClose();
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function NicknameDialog({ person, onClose }: { person: UserPublic; onClose: () => void }) {
  const push = useToasts((state) => state.push);
  const contact = useChat((state) => state.contacts.find((c) => c.user.id === person.id));
  const setNickname = useChat((state) => state.setNickname);
  const initial = {
    given: contact?.nickname ?? "",
    family: contact?.nickname_family ?? "",
    note: contact?.note ?? "",
  };
  const [given, setGiven] = useState(initial.given);
  const [family, setFamily] = useState(initial.family);
  const [note, setNote] = useState(initial.note);
  const [busy, setBusy] = useState(false);
  const had = Boolean(initial.given || initial.family || initial.note);
  const changed = given !== initial.given || family !== initial.family || note !== initial.note;
  // Signal needs a first name whenever a last name is given.
  const valid = !(family.trim() && !given.trim());

  async function save(value: { given: string; family: string; note: string }) {
    setBusy(true);
    try {
      await setNickname(person.id, value);
      onClose();
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not save the nickname.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full bg-transparent px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-2";

  return (
    <Modal onClose={onClose} label="Nickname" width={360} closeButton>
      <h2 className="text-center text-[15px] font-semibold text-ink">Nickname</h2>
      <p className="mt-1.5 px-2 text-center text-[12.5px] leading-snug text-ink">
        Nicknames &amp; notes are stored with Signal and end-to-end encrypted. They are only visible
        to you.
      </p>
      <div className="mt-4 flex justify-center">
        <Avatar
          name={person.display_name}
          colorKey={person.avatar_color}
          url={person.avatar_url}
          size={72}
        />
      </div>
      <div className="mt-4 divide-y divide-border rounded-xl bg-surface-chip/70">
        <input
          aria-label="First name"
          placeholder="First name"
          value={given}
          maxLength={64}
          autoFocus
          onChange={(event) => setGiven(event.target.value)}
          className={field}
        />
        <input
          aria-label="Last name"
          placeholder="Last name"
          value={family}
          maxLength={64}
          onChange={(event) => setFamily(event.target.value)}
          className={field}
        />
        <textarea
          aria-label="Note"
          placeholder="Note"
          value={note}
          maxLength={240}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className={`${field} resize-none`}
        />
      </div>
      <div className="mt-5 flex items-center gap-2.5">
        {had && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ given: "", family: "", note: "" })}
            className="mr-auto rounded-full px-3 py-1.5 text-[13px] font-semibold text-danger hover:bg-surface-hover"
          >
            Delete
          </button>
        )}
        <div className={`flex gap-2.5 ${had ? "" : "ml-auto"}`}>
          <DialogButton variant="secondary" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            disabled={busy || !changed || !valid}
            onClick={() => void save({ given, family, note })}
          >
            Save
          </DialogButton>
        </div>
      </div>
    </Modal>
  );
}

function AddToGroupDialog({
  person,
  name,
  onClose,
}: {
  person: UserPublic;
  name: string;
  onClose: () => void;
}) {
  const push = useToasts((state) => state.push);
  const conversations = useChat((state) => state.conversations);
  const groupMembers = useChat((state) => state.groupMembers);
  const loadGroupMembers = useChat((state) => state.loadGroupMembers);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);

  const groups = conversations.filter(
    (c) =>
      c.type === "group" &&
      !c.ended_at &&
      c.can_send !== false &&
      c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (target) {
    return (
      <Modal onClose={() => setTarget(null)} label="Add to group" width={330}>
        <p className="text-center text-[13.5px] leading-snug text-ink">
          Add “{name}” to the group “{target.title}”?
        </p>
        <div className="mt-5 flex gap-2.5">
          <DialogButton variant="secondary" onClick={() => setTarget(null)}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            autoFocus
            onClick={async () => {
              try {
                await conversationApi.addMembers(target.id, [person.id]);
                await loadGroupMembers();
                push(`${name} added to ${target.title}`);
                onClose();
              } catch (error) {
                push(error instanceof ApiError ? error.message : "Could not add them.");
                setTarget(null);
              }
            }}
          >
            Add
          </DialogButton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} label="Add to a group" width={380} closeButton>
      <h2 className="text-[15px] font-semibold text-ink">Add to a group</h2>
      <label className="mt-3 flex items-center gap-2 rounded-lg bg-surface-chip px-2.5 py-1.5">
        <SearchIcon size={14} className="text-ink-2" />
        <input
          aria-label="Search groups"
          placeholder="Search"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-2"
        />
      </label>
      <div className="mt-2 flex min-h-[220px] flex-col">
        {groups.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-2">No groups found</p>
        )}
        {groups.map((g) => {
          const already = groupMembers[g.id]?.includes(person.id) ?? false;
          return (
            <button
              key={g.id}
              type="button"
              disabled={already}
              onClick={() => setTarget({ id: g.id, title: g.title })}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-hover disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Avatar
                name={g.title}
                colorKey={g.avatar_color}
                url={g.avatar_url}
                size={32}
                group
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {g.title}
                </span>
                {already && <span className="block text-[12px] text-ink-2">Already a member</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function ConnectionExplainer({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Signal Connections" width={360}>
      <div className="flex justify-center pt-1 text-ink">
        <ConnectionGlyph size={40} />
      </div>
      <h2 className="mt-3 text-center text-[15px] font-semibold text-ink">Signal Connections</h2>
      <p className="mt-2 text-[13px] leading-snug text-ink">
        Signal Connections are people you&rsquo;ve chosen to trust, either by:
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-[13px] text-ink">
        <li className="flex items-center gap-2.5">
          <ChatIcon size={16} className="text-ink-2" /> Starting a chat
        </li>
        <li className="flex items-center gap-2.5">
          <PersonIcon size={16} className="text-ink-2" /> Accepting a message request
        </li>
        <li className="flex items-center gap-2.5">
          <LockIcon size={14} className="text-ink-2" /> Having them in your system contacts
        </li>
      </ul>
      <p className="mt-3 text-[13px] leading-snug text-ink">
        Your connections can see your name and photo, and can see posts to &ldquo;My Story&rdquo;
        unless you hide it from them.
      </p>
      <div className="mt-5 flex">
        <DialogButton variant="primary" onClick={onClose}>
          OK
        </DialogButton>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/** Signal's confirmation card, laid over the modal's rows. */
function InlineConfirm({
  title,
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title?: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      role="alertdialog"
      aria-label={title ?? confirmLabel}
      className="animate-pop-in absolute inset-x-0 top-0 z-10 rounded-2xl bg-surface-chip p-3.5 text-center shadow-xl"
    >
      {title && <p className="text-[13.5px] font-semibold text-ink">{title}</p>}
      <p className={`text-[13px] leading-snug text-ink ${title ? "mt-1" : ""}`}>{body}</p>
      <div className="mt-3 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onCancel}>
          Cancel
        </DialogButton>
        <DialogButton
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          autoFocus
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {confirmLabel}
        </DialogButton>
      </div>
    </div>
  );
}

function ModalRow({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-surface-hover"
    >
      <span className="flex w-5 justify-center text-ink">{icon}</span>
      {children}
    </button>
  );
}

function RoundButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 text-[11.5px] text-ink disabled:opacity-40"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-chip transition hover:brightness-110">
        {children}
      </span>
      {label}
    </button>
  );
}

function AboutRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex w-5 shrink-0 justify-center pt-px text-ink">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </li>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function svg(size: number, children: ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function ShieldGlyph() {
  return svg(
    16,
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>,
  );
}

function PlusCircleGlyph() {
  return svg(
    16,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>,
  );
}

function KeyGlyph() {
  return svg(
    16,
    <>
      <circle cx="7.5" cy="16.5" r="3.5" />
      <path d="m10 14 9.5-9.5M16 8l2.5 2.5M14 10l2 2" />
    </>,
  );
}

function LeaveGlyph() {
  return svg(
    16,
    <>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="m16 8 4 4-4 4M20 12H10" />
    </>,
  );
}

function ConnectionGlyph({ size = 17 }: { size?: number }) {
  return svg(
    size,
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 11.2-4.5" />
      <path d="m15 18 2 2 4.5-4.5" />
    </>,
  );
}

function SmileGlyph() {
  return svg(
    16,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <circle cx="9" cy="10" r=".6" fill="currentColor" />
      <circle cx="15" cy="10" r=".6" fill="currentColor" />
    </>,
  );
}

function NoteGlyph() {
  return svg(
    16,
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h5" />
    </>,
  );
}
