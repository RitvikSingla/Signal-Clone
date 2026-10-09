"use client";

/**
 * Group settings, which in Signal Desktop replace the thread rather than
 * sliding a panel in: the group's photo, name and description, Video /
 * Mute / Search, then Disappearing messages, Chat color and Notifications,
 * the member list with Add members, Group link, Member label, Requests &
 * invites, Permissions, and finally Leave group, Block group, Report spam
 * and (for admins) End group. Each row that leads somewhere opens a
 * sub-page with its own back arrow, as in the recording.
 *
 * Who may do what is decided by the server; this screen only hides or
 * disables what the caller's role and the group's permissions rule out.
 */

import { useMemo, useState, type ReactNode } from "react";

import { muteItems, MuteUntilDialog } from "@/components/chat/MuteMenu";
import { TimerSelect } from "@/components/chat/TimerSelect";
import { Avatar } from "@/components/ui/Avatar";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  EmojiIcon,
  GroupIcon,
  LinkIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  TimerIcon,
  VideoIcon,
  WarningIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, DialogButton, Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { conversationApi } from "@/lib/endpoints";
import {
  allowed,
  CHAT_COLORS,
  DEFAULT_CHAT_COLOR,
  groupLinkUrl,
  isAdmin,
} from "@/lib/groups";
import type {
  Contact,
  ConversationDetail,
  GroupPermissions,
  Member,
  Permission,
} from "@/lib/types";
import { useChat } from "@/store/chat";
import { DEFAULT_NOTIFY, useUi } from "@/store/ui";

type Page =
  | "main"
  | "chat-color"
  | "notifications"
  | "while-muted"
  | "group-link"
  | "member-label"
  | "requests"
  | "permissions";

type Props = {
  conversation: ConversationDetail;
  currentUserId: string;
  contacts: Contact[];
  onBack: () => void;
  onCall: (kind: "video" | "voice") => void;
  onSearch: () => void;
  onMessage: (userId: string) => void;
  onMute: (until: string | null) => void;
  onLeft: () => void;
};

export function GroupDetails(props: Props) {
  const { conversation, currentUserId } = props;
  const [page, setPage] = useState<Page>("main");
  const push = useToasts((state) => state.push);
  const setDetail = useChat((state) => state.setDetail);

  /** Run a settings call and adopt the detail it returns. */
  async function apply(call: () => Promise<ConversationDetail>, failure: string) {
    try {
      setDetail(await call());
      return true;
    } catch (error) {
      push(error instanceof ApiError ? error.message : failure);
      return false;
    }
  }

  const back = () => setPage(page === "while-muted" ? "notifications" : "main");

  if (page === "chat-color") {
    return <ChatColorPage conversationId={conversation.id} onBack={back} />;
  }
  if (page === "notifications" || page === "while-muted") {
    return (
      <NotificationsPage
        conversation={conversation}
        sub={page === "while-muted"}
        onOpenWhileMuted={() => setPage("while-muted")}
        onBack={back}
        onMute={props.onMute}
      />
    );
  }
  if (page === "group-link") {
    return <GroupLinkPage conversation={conversation} apply={apply} onBack={back} />;
  }
  if (page === "member-label") {
    return (
      <MemberLabelPage
        conversation={conversation}
        currentUserId={currentUserId}
        apply={apply}
        onBack={back}
      />
    );
  }
  if (page === "requests") {
    return <RequestsPage conversation={conversation} apply={apply} onBack={back} />;
  }
  if (page === "permissions") {
    return <PermissionsPage conversation={conversation} apply={apply} onBack={back} />;
  }

  return <MainPage {...props} apply={apply} onOpen={setPage} />;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function MainPage({
  conversation,
  currentUserId,
  contacts,
  onBack,
  onCall,
  onSearch,
  onMessage,
  onMute,
  onLeft,
  apply,
  onOpen,
}: Props & {
  apply: (call: () => Promise<ConversationDetail>, failure: string) => Promise<boolean>;
  onOpen: (page: Page) => void;
}) {
  const push = useToasts((state) => state.push);
  const chatColor = useUi((state) => state.chatColors[conversation.id]) ?? DEFAULT_CHAT_COLOR;
  const admin = isAdmin(conversation, currentUserId);
  const canEdit = allowed(conversation, currentUserId, "edit_info");
  const canAdd = allowed(conversation, currentUserId, "add_members");
  const ended = Boolean(conversation.ended_at);
  const left = !conversation.members.some((m) => m.user.id === currentUserId && m.is_active);

  const [editing, setEditing] = useState<null | "name" | "description">(null);
  const [memberQuery, setMemberQuery] = useState<string | null>(null);
  const [muteOpen, setMuteOpen] = useState(false);
  const [untilOpen, setUntilOpen] = useState(false);
  const [dialog, setDialog] = useState<
    null | "add" | "leave" | "block" | "report" | "end" | { member: Member }
  >(null);

  const members = useMemo(() => {
    const needle = memberQuery?.trim().toLowerCase() ?? "";
    return conversation.members
      .filter((m) => m.is_active)
      .filter((m) => !needle || m.user.display_name.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.user.id === currentUserId) return -1;
        if (b.user.id === currentUserId) return 1;
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        return a.user.display_name.localeCompare(b.user.display_name);
      });
  }, [conversation.members, memberQuery, currentUserId]);
  const activeCount = conversation.members.filter((m) => m.is_active).length;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center px-3 pt-1">
        <IconButton label="Back" onClick={onBack}>
          <ChevronLeftIcon size={18} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10">
        <div className="mx-auto max-w-[620px]">
          <div className="flex flex-col items-center pt-2 text-center">
            <Avatar
              name={conversation.title}
              colorKey={conversation.avatar_color}
              url={conversation.avatar_url}
              size={72}
              group
            />
            {editing === "name" ? (
              <InlineEdit
                initial={conversation.title}
                max={32}
                label="Group name"
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  if (
                    await apply(
                      () => conversationApi.update(conversation.id, { name: value }),
                      "Could not rename the group.",
                    )
                  ) {
                    setEditing(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditing("name")}
                className="mt-3 rounded-md px-1 text-[20px] font-semibold text-ink enabled:hover:bg-surface-hover"
              >
                {conversation.title}
              </button>
            )}
            {editing === "description" ? (
              <InlineEdit
                initial={conversation.description ?? ""}
                max={255}
                multiline
                label="Group description"
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  if (
                    await apply(
                      () => conversationApi.update(conversation.id, { description: value }),
                      "Could not save the description.",
                    )
                  ) {
                    setEditing(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditing("description")}
                className="mt-0.5 max-w-md rounded-md px-1 text-[13px] text-ink-2 enabled:hover:bg-surface-hover"
              >
                {conversation.description || (canEdit ? "Add group description…" : "")}
              </button>
            )}
            {ended && (
              <p className="mt-2 rounded-full bg-surface-chip px-3 py-1 text-[12px] text-ink-2">
                This group has ended
              </p>
            )}

            <div className="mt-4 flex gap-5">
              <RoundAction label="Video" onClick={() => onCall("video")} disabled={ended || left}>
                <VideoIcon size={17} />
              </RoundAction>
              <div className="relative">
                <RoundAction
                  label={conversation.is_muted ? "Muted" : "Mute"}
                  onClick={() => setMuteOpen((o) => !o)}
                >
                  <BellSlash muted={conversation.is_muted} />
                </RoundAction>
                {muteOpen && (
                  <Menu
                    align="left"
                    onClose={() => setMuteOpen(false)}
                    items={muteItems(conversation.is_muted, onMute, () => setUntilOpen(true))}
                  />
                )}
              </div>
              <RoundAction label="Search" onClick={onSearch}>
                <SearchIcon size={16} />
              </RoundAction>
            </div>
          </div>

          <Card>
            <Row
              icon={<TimerIcon size={17} strokeWidth={1.7} />}
              title="Disappearing messages"
              subtitle="When enabled, messages sent and received in this group will disappear after they've been seen."
              trailing={
                <TimerSelect
                  value={conversation.disappearing_seconds}
                  disabled={!canEdit}
                  onChange={(seconds) =>
                    void apply(
                      () =>
                        conversationApi.update(conversation.id, { disappearing_seconds: seconds }),
                      "Could not change the timer.",
                    )
                  }
                />
              }
            />
            <Row
              icon={<PaletteIcon />}
              title="Chat color"
              onClick={() => onOpen("chat-color")}
              trailing={<span className="size-4 rounded-full" style={{ background: chatColor }} />}
            />
            <Row
              icon={<BellSlash muted={false} size={17} />}
              title="Notifications"
              onClick={() => onOpen("notifications")}
            />
          </Card>

          <div className="mt-6 flex items-center justify-between px-1">
            <h3 className="text-[13px] font-semibold text-ink">
              {activeCount} {activeCount === 1 ? "member" : "members"}
            </h3>
            {memberQuery === null ? (
              <IconButton label="Search members" onClick={() => setMemberQuery("")}>
                <SearchIcon size={15} />
              </IconButton>
            ) : (
              <label className="relative ml-4 block w-56">
                <span className="sr-only">Search members</span>
                <input
                  autoFocus
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Escape" && setMemberQuery(null)}
                  placeholder="Search members"
                  className="h-7 w-full rounded-md bg-surface-sunken pl-2.5 pr-7 text-[12.5px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
                />
                <button
                  type="button"
                  onClick={() => setMemberQuery(null)}
                  aria-label="Close member search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink"
                >
                  <CloseIcon size={12} />
                </button>
              </label>
            )}
          </div>
          <Card className="mt-2">
            {canAdd && !left && (
              <Row
                icon={<PlusIcon size={16} />}
                title="Add members"
                onClick={() => setDialog("add")}
              />
            )}
            {members.map((member) => {
              const me = member.user.id === currentUserId;
              return (
                <button
                  key={member.user.id}
                  type="button"
                  onClick={() => (me ? onOpen("member-label") : setDialog({ member }))}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <Avatar
                    name={member.user.display_name}
                    colorKey={member.user.avatar_color}
                    url={member.user.avatar_url}
                    size={30}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {me ? "You" : member.user.display_name}
                    </span>
                    {member.label ? (
                      <LabelChip label={member.label} />
                    ) : (
                      me &&
                      allowed(conversation, currentUserId, "member_labels") && (
                        <span className="flex items-center text-[12px] text-ink-2">
                          Add member label <ChevronRightIcon size={11} />
                        </span>
                      )
                    )}
                  </span>
                  {member.role === "admin" && <span className="text-[12px] text-ink-2">Admin</span>}
                </button>
              );
            })}
            {members.length === 0 && (
              <p className="px-4 py-3 text-[12.5px] text-ink-2">No members match.</p>
            )}
          </Card>

          <Card className="mt-4">
            {admin && (
              <Row
                icon={<LinkIcon size={16} />}
                title="Group link"
                onClick={() => onOpen("group-link")}
                trailing={
                  <span className="text-[12px] text-ink-2">
                    {conversation.group_link?.enabled ? "On" : "Off"}
                  </span>
                }
              />
            )}
            <Row icon={<TagIcon />} title="Member label" onClick={() => onOpen("member-label")} />
            {admin && (
              <>
                <Row
                  icon={<GroupIcon size={16} />}
                  title="Requests & invites"
                  onClick={() => onOpen("requests")}
                  trailing={
                    <span className="text-[12px] text-ink-2">
                      {conversation.join_requests?.length ?? 0}
                    </span>
                  }
                />
                <Row icon={<KeyIcon />} title="Permissions" onClick={() => onOpen("permissions")} />
              </>
            )}
          </Card>

          <Card className="mt-4">
            {!left && (
              <Row
                danger
                icon={<LeaveIcon />}
                title="Leave group"
                onClick={() => setDialog("leave")}
              />
            )}
            <Row
              danger
              icon={<BlockIcon />}
              title="Block group"
              onClick={() => setDialog("block")}
            />
            <Row
              danger
              icon={<WarningIcon size={16} />}
              title="Report spam"
              onClick={() => setDialog("report")}
            />
          </Card>

          {admin && !ended && (
            <Card className="mt-4">
              <Row
                danger
                icon={<CloseCircle />}
                title="End group"
                onClick={() => setDialog("end")}
              />
            </Card>
          )}
        </div>
      </div>

      {untilOpen && (
        <MuteUntilDialog onClose={() => setUntilOpen(false)} onMute={(until) => onMute(until)} />
      )}

      {dialog === "add" && (
        <AddMembersDialog
          conversation={conversation}
          contacts={contacts}
          onClose={() => setDialog(null)}
          onAdd={async (ids) => {
            if (
              await apply(
                () => conversationApi.addMembers(conversation.id, ids),
                "Could not add members.",
              )
            ) {
              setDialog(null);
            }
          }}
        />
      )}

      {dialog && typeof dialog === "object" && (
        <MemberDialog
          conversation={conversation}
          member={dialog.member}
          admin={admin}
          onClose={() => setDialog(null)}
          onMessage={() => onMessage(dialog.member.user.id)}
          onRole={async (role) => {
            if (
              await apply(
                () => conversationApi.changeRole(conversation.id, dialog.member.user.id, role),
                "Could not change the role.",
              )
            ) {
              setDialog(null);
            }
          }}
          onRemove={async () => {
            if (
              await apply(
                () => conversationApi.removeMember(conversation.id, dialog.member.user.id),
                "Could not remove them.",
              )
            ) {
              setDialog(null);
            }
          }}
        />
      )}

      {dialog === "leave" && (
        <ConfirmDialog
          title="Leave group?"
          confirmLabel="Leave"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void conversationApi
              .leave(conversation.id)
              .then(() => {
                push("You left the group.");
                onLeft();
              })
              .catch(() => push("Could not leave the group."))
          }
        >
          You will no longer be able to send or receive messages in this group.
        </ConfirmDialog>
      )}

      {dialog === "block" && (
        <ConfirmDialog
          title={`Block and leave “${conversation.title}”?`}
          confirmLabel="Block"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void (async () => {
              try {
                if (!left) await conversationApi.leave(conversation.id);
                await conversationApi.setPrefs(conversation.id, { is_archived: true });
                push(`${conversation.title} blocked`);
                onLeft();
              } catch {
                push("Could not block the group.");
              }
            })()
          }
        >
          You will no longer receive messages or updates from this group, and members will not be
          able to add you to it again.
        </ConfirmDialog>
      )}

      {dialog === "report" && (
        <Modal onClose={() => setDialog(null)} label="Report as spam?" width={330}>
          <h2 className="text-center text-[14px] font-semibold text-ink">Report as spam?</h2>
          <p className="mt-2 text-center text-[13px] leading-[1.45] text-ink">
            Signal will be notified that the person who invited you to this group may be sending
            spam. Signal can&rsquo;t see the content of any chats.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <DialogButton
              variant="danger"
              onClick={() => {
                setDialog("block");
                push("Reported as spam");
              }}
            >
              Report and block
            </DialogButton>
            <DialogButton
              variant="danger"
              onClick={() => {
                setDialog(null);
                push("Reported as spam");
              }}
            >
              Report spam
            </DialogButton>
            <DialogButton variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </DialogButton>
          </div>
        </Modal>
      )}

      {dialog === "end" && (
        <ConfirmDialog
          title={`End “${conversation.title}”?`}
          confirmLabel="End group"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void apply(() => conversationApi.end(conversation.id), "Could not end the group.")
          }
        >
          Members will no longer be able to send messages or start calls in the group. They will be
          notified that you ended the group, and will still have access to message history.
        </ConfirmDialog>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function AddMembersDialog({
  conversation,
  contacts,
  onClose,
  onAdd,
}: {
  conversation: ConversationDetail;
  contacts: Contact[];
  onClose: () => void;
  onAdd: (ids: string[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const memberIds = new Set(conversation.members.filter((m) => m.is_active).map((m) => m.user.id));
  const needle = query.trim().toLowerCase();
  const people = contacts
    .filter((c) => !c.is_blocked)
    .map((c) => c.user)
    .filter((u) => !needle || u.display_name.toLowerCase().includes(needle))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <Modal onClose={onClose} label="Add members" width={340}>
      <div className="-mt-1 flex items-center">
        <h2 className="flex-1 text-[14px] font-semibold text-ink">Add members</h2>
        <IconButton label="Close" onClick={onClose}>
          <CloseIcon size={15} />
        </IconButton>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Name, username, or number"
        aria-label="Search contacts"
        className="mt-3 h-[30px] w-full rounded-md bg-surface-chip px-3 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:ring-2 focus:ring-ultramarine"
      />
      <div className="mt-2 h-[260px] overflow-y-auto">
        {people.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-2">No contacts found</p>
        )}
        {people.map((person) => {
          const already = memberIds.has(person.id);
          const on = already || picked.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              disabled={already}
              onClick={() =>
                setPicked((current) =>
                  current.includes(person.id)
                    ? current.filter((id) => id !== person.id)
                    : [...current, person.id],
                )
              }
              className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left enabled:hover:bg-surface-hover disabled:opacity-60"
            >
              <Avatar
                name={person.display_name}
                colorKey={person.avatar_color}
                url={person.avatar_url}
                size={30}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {person.display_name}
                </span>
                {already && (
                  <span className="block text-[11.5px] text-ink-2">Already a member</span>
                )}
              </span>
              <Check on={on} />
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <DialogButton variant="secondary" onClick={onClose}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          disabled={picked.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            await onAdd(picked);
            setBusy(false);
          }}
        >
          Update
        </DialogButton>
      </div>
    </Modal>
  );
}

function MemberDialog({
  conversation,
  member,
  admin,
  onClose,
  onMessage,
  onRole,
  onRemove,
}: {
  conversation: ConversationDetail;
  member: Member;
  admin: boolean;
  onClose: () => void;
  onMessage: () => void;
  onRole: (role: "admin" | "member") => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <ConfirmDialog
        title={`Remove ${member.user.display_name}?`}
        confirmLabel="Remove"
        tone="danger"
        onClose={() => setConfirm(false)}
        onConfirm={() => void onRemove()}
      >
        Remove {member.user.display_name} from “{conversation.title}”?
      </ConfirmDialog>
    );
  }
  const ended = Boolean(conversation.ended_at);
  return (
    <Modal onClose={onClose} label={member.user.display_name} width={300} closeButton>
      <div className="flex flex-col items-center text-center">
        <Avatar
          name={member.user.display_name}
          colorKey={member.user.avatar_color}
          url={member.user.avatar_url}
          size={64}
        />
        <p className="mt-3 text-[15px] font-semibold text-ink">{member.user.display_name}</p>
        {member.label && <LabelChip label={member.label} />}
        {member.user.about && <p className="mt-1 text-[12.5px] text-ink-2">{member.user.about}</p>}
        {member.role === "admin" && <p className="mt-1 text-[12px] text-ink-2">Admin</p>}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <DialogButton
          variant="secondary"
          onClick={() => {
            onClose();
            onMessage();
          }}
        >
          Message
        </DialogButton>
        {admin && !ended && (
          <>
            <DialogButton
              variant="secondary"
              onClick={() => void onRole(member.role === "admin" ? "member" : "admin")}
            >
              {member.role === "admin" ? "Remove as admin" : "Make admin"}
            </DialogButton>
            <DialogButton variant="danger" onClick={() => setConfirm(true)}>
              Remove from group
            </DialogButton>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-pages
// ---------------------------------------------------------------------------

function SubPage({
  title,
  onBack,
  children,
  footer,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center gap-1 px-3 pt-1">
        <IconButton label="Back" onClick={onBack}>
          <ChevronLeftIcon size={18} />
        </IconButton>
        <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-[620px]">{children}</div>
      </div>
      {footer && (
        <div className="flex shrink-0 justify-end gap-2 px-6 pb-4 [&>button]:w-auto [&>button]:flex-none [&>button]:px-5">
          {footer}
        </div>
      )}
    </section>
  );
}

function ChatColorPage({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const color = useUi((state) => state.chatColors[conversationId]) ?? DEFAULT_CHAT_COLOR;
  const setChatColor = useUi((state) => state.setChatColor);
  const resetAll = useUi((state) => state.resetAllChatColors);
  const push = useToasts((state) => state.push);

  return (
    <SubPage title="Chat Color" onBack={onBack}>
      <div className="mt-2 rounded-xl bg-surface-raised p-4">
        <div className="flex">
          <span className="rounded-[16px] rounded-bl-[4px] bg-bubble-in px-3 py-1.5 text-[13px] text-ink">
            Here&rsquo;s a preview of the chat color.
            <span className="ml-2 text-[10.5px] text-ink-2">Now</span>
          </span>
        </div>
        <div className="mt-6 flex justify-end">
          <span
            className="rounded-[16px] rounded-br-[4px] px-3 py-1.5 text-[13px] text-white"
            style={{ background: color }}
          >
            The color is visible to only you.
            <span className="ml-2 text-[10.5px] text-white/80">Now</span>
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-3 rounded-xl bg-surface-raised p-4">
        {CHAT_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() =>
              setChatColor(conversationId, swatch === DEFAULT_CHAT_COLOR ? null : swatch)
            }
            aria-label="Chat color"
            aria-pressed={swatch === color}
            className={`mx-auto size-9 rounded-full ${swatch === color ? "ring-2 ring-ink ring-offset-2 ring-offset-surface-raised" : ""}`}
            style={{ background: swatch }}
          />
        ))}
      </div>
      <Card className="mt-4">
        <Row title="Reset chat color" onClick={() => setChatColor(conversationId, null)} />
        <Row
          title="Reset all chat colors"
          onClick={() => {
            resetAll();
            push("All chat colors reset");
          }}
        />
      </Card>
    </SubPage>
  );
}

function NotificationsPage({
  conversation,
  sub,
  onOpenWhileMuted,
  onBack,
  onMute,
}: {
  conversation: ConversationDetail;
  sub: boolean;
  onOpenWhileMuted: () => void;
  onBack: () => void;
  onMute: (until: string | null) => void;
}) {
  const prefs = useUi((state) => state.notifyPrefs[conversation.id]) ?? DEFAULT_NOTIFY;
  const setPrefs = useUi((state) => state.setNotifyPrefs);
  const [menuOpen, setMenuOpen] = useState(false);
  const [untilOpen, setUntilOpen] = useState(false);

  if (sub) {
    return (
      <SubPage title="While muted" onBack={onBack}>
        <Card className="mt-2">
          <Row
            icon={<PhoneIcon size={15} />}
            title="Calls"
            subtitle="Ring or notify when a call is started while this chat is muted."
            trailing={
              <Switch
                label="Calls"
                on={prefs.calls}
                onChange={(calls) => setPrefs(conversation.id, { calls })}
              />
            }
          />
          <Row
            icon={<span className="text-[15px] font-semibold">@</span>}
            title="Mentions"
            subtitle="Notify when you are @mentioned while this chat is muted."
            trailing={
              <Switch
                label="Mentions"
                on={prefs.mentions}
                onChange={(mentions) => setPrefs(conversation.id, { mentions })}
              />
            }
          />
          <Row
            icon={<ReplyGlyph />}
            title="Replies"
            subtitle="Notify when someone replies to your message while this chat is muted."
            trailing={
              <Switch
                label="Replies"
                on={prefs.replies}
                onChange={(replies) => setPrefs(conversation.id, { replies })}
              />
            }
          />
        </Card>
      </SubPage>
    );
  }

  const whileMuted =
    [prefs.calls && "Calls", prefs.mentions && "Mentions", prefs.replies && "replies"]
      .filter(Boolean)
      .join(", ") || "Nothing";

  return (
    <SubPage title="Notifications" onBack={onBack}>
      <Card className="mt-2">
        <Row
          icon={<BellSlash muted size={16} />}
          title="Mute notifications"
          subtitle={conversation.is_muted ? "Muted" : "Not muted"}
          trailing={
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-md bg-surface-chip px-3 py-1 text-[12px] font-semibold text-link hover:brightness-110"
              >
                {conversation.is_muted ? "Unmute" : "Mute"}
              </button>
              {menuOpen && (
                <Menu
                  align="right"
                  onClose={() => setMenuOpen(false)}
                  items={muteItems(conversation.is_muted, onMute, () => setUntilOpen(true))}
                />
              )}
            </div>
          }
        />
        <Row
          icon={<BellSlash muted={false} size={16} />}
          title="While muted"
          subtitle="Choose notifications to show while this chat is muted."
          onClick={onOpenWhileMuted}
          trailing={<span className="text-[12px] text-ink-2">{whileMuted}</span>}
        />
      </Card>
      <Card className="mt-4">
        <Row
          icon={<RingGlyph />}
          title="Unread reminders"
          subtitle="Occasionally notify when there are unread messages while this chat is muted."
          trailing={
            <Switch
              label="Unread reminders"
              on={prefs.unreadReminders}
              onChange={(unreadReminders) => setPrefs(conversation.id, { unreadReminders })}
            />
          }
        />
      </Card>
      {untilOpen && (
        <MuteUntilDialog onClose={() => setUntilOpen(false)} onMute={(until) => onMute(until)} />
      )}
    </SubPage>
  );
}

function GroupLinkPage({
  conversation,
  apply,
  onBack,
}: {
  conversation: ConversationDetail;
  apply: (call: () => Promise<ConversationDetail>, failure: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const push = useToasts((state) => state.push);
  const [confirmReset, setConfirmReset] = useState(false);
  const link = conversation.group_link;
  const url = link?.token ? groupLinkUrl(link.token) : "";
  const set = (payload: Parameters<typeof conversationApi.setGroupLink>[1]) =>
    apply(
      () => conversationApi.setGroupLink(conversation.id, payload),
      "Could not update the group link.",
    );

  return (
    <SubPage title="Group link" onBack={onBack}>
      <Card className="mt-2">
        <Row
          title="Group link"
          subtitle={link?.enabled ? url : undefined}
          trailing={
            <Switch
              label="Group link"
              on={Boolean(link?.enabled)}
              onChange={(enabled) => void set({ enabled })}
            />
          }
        />
      </Card>
      {link?.enabled && (
        <>
          <Card className="mt-4">
            <Row
              icon={<CopyIcon size={15} />}
              title="Copy link"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                push("Group link copied");
              }}
            />
            <Row icon={<ResetGlyph />} title="Reset link" onClick={() => setConfirmReset(true)} />
          </Card>
          <Card className="mt-4">
            <Row
              title="Require admin approval"
              subtitle="Require an admin to approve new members joining via the group link"
              trailing={
                <Switch
                  label="Require admin approval"
                  on={Boolean(link.requires_approval)}
                  onChange={(requires_approval) => void set({ requires_approval })}
                />
              }
            />
          </Card>
        </>
      )}
      {confirmReset && (
        <ConfirmDialog
          title="Reset link?"
          confirmLabel="Reset link"
          tone="danger"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => void set({ reset: true }).then((ok) => ok && push("Group link reset"))}
        >
          You won&rsquo;t be able to use the current link to join the group anymore.
        </ConfirmDialog>
      )}
    </SubPage>
  );
}

function MemberLabelPage({
  conversation,
  currentUserId,
  apply,
  onBack,
}: {
  conversation: ConversationDetail;
  currentUserId: string;
  apply: (call: () => Promise<ConversationDetail>, failure: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const me = conversation.members.find((m) => m.user.id === currentUserId);
  const [value, setValue] = useState(me?.label ?? "");
  const canLabel = allowed(conversation, currentUserId, "member_labels");
  const labelled = conversation.members.filter(
    (m) => m.is_active && m.label && m.user.id !== currentUserId,
  );
  const changed = value.trim() !== (me?.label ?? "");

  return (
    <SubPage
      title="Member label"
      onBack={onBack}
      footer={
        <>
          <DialogButton variant="secondary" onClick={onBack}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            disabled={!changed || !canLabel}
            onClick={() =>
              void apply(
                () => conversationApi.setLabel(conversation.id, value.trim() || null),
                "Could not save your label.",
              ).then((ok) => ok && onBack())
            }
          >
            Save
          </DialogButton>
        </>
      }
    >
      <label className="relative mt-2 block">
        <EmojiIcon
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2"
        />
        <input
          autoFocus
          disabled={!canLabel}
          value={value}
          maxLength={24}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Enter your member label"
          aria-label="Member label"
          className="h-9 w-full rounded-md border border-ultramarine/70 bg-transparent pl-8 pr-8 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:border-ultramarine disabled:opacity-60"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear label"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </label>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-2">
        {canLabel
          ? "Set a member label to describe yourself or your role in this group. Member labels are only visible within this group."
          : "Only admins can add member labels in this group."}
      </p>

      <h3 className="mb-1.5 mt-5 text-[12.5px] font-semibold text-ink">Preview</h3>
      <div className="rounded-xl bg-surface-raised p-3">
        <div className="flex items-end gap-2">
          <Avatar
            name={me?.user.display_name ?? "You"}
            colorKey={me?.user.avatar_color ?? "A200"}
            url={me?.user.avatar_url}
            size={26}
          />
          <span className="rounded-[16px] rounded-bl-[4px] bg-bubble-in px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3fb950]">
              {me?.user.display_name}
              {value.trim() && <LabelChip label={value.trim()} />}
            </span>
            <span className="text-[13px] text-ink">
              Hello! <span className="ml-1 text-[10.5px] text-ink-2">Now</span>
            </span>
          </span>
        </div>
      </div>

      <h3 className="mb-1.5 mt-5 text-[12.5px] font-semibold text-ink">
        Group members with labels
      </h3>
      <Card>
        {labelled.length === 0 ? (
          <p className="px-4 py-3 text-[12.5px] text-ink">No other members have labels</p>
        ) : (
          labelled.map((m) => (
            <div key={m.user.id} className="flex items-center gap-3 px-4 py-2">
              <Avatar
                name={m.user.display_name}
                colorKey={m.user.avatar_color}
                url={m.user.avatar_url}
                size={26}
              />
              <span className="flex-1 truncate text-[13px] font-semibold text-ink">
                {m.user.display_name}
              </span>
              <LabelChip label={m.label ?? ""} />
            </div>
          ))
        )}
      </Card>
    </SubPage>
  );
}

function RequestsPage({
  conversation,
  apply,
  onBack,
}: {
  conversation: ConversationDetail;
  apply: (call: () => Promise<ConversationDetail>, failure: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"requests" | "invites">("requests");
  const requests = conversation.join_requests ?? [];

  return (
    <SubPage title="Requests & invites" onBack={onBack}>
      <div className="mt-2 grid grid-cols-2 rounded-lg bg-surface-raised p-1">
        {(["requests", "invites"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`h-7 rounded-md text-[12.5px] font-semibold ${tab === value ? "bg-surface-chip text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {value === "requests" ? `Requests (${requests.length})` : "Invites (0)"}
          </button>
        ))}
      </div>
      {tab === "requests" ? (
        requests.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-ink-2">
            People who ask to join through the group link will appear here.
          </p>
        ) : (
          <Card className="mt-4">
            {requests.map((request) => (
              <div key={request.user.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar
                  name={request.user.display_name}
                  colorKey={request.user.avatar_color}
                  url={request.user.avatar_url}
                  size={30}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                  {request.user.display_name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void apply(
                      () => conversationApi.resolveRequest(conversation.id, request.user.id, false),
                      "Could not deny the request.",
                    )
                  }
                  className="rounded-full bg-surface-chip px-3 py-1 text-[12px] font-semibold text-danger hover:brightness-110"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void apply(
                      () => conversationApi.resolveRequest(conversation.id, request.user.id, true),
                      "Could not approve the request.",
                    )
                  }
                  className="rounded-full bg-ultramarine px-3 py-1 text-[12px] font-semibold text-white hover:bg-ultramarine-hover"
                >
                  Approve
                </button>
              </div>
            ))}
          </Card>
        )
      ) : (
        <p className="mt-8 text-center text-[13px] text-ink-2">No pending invites</p>
      )}
    </SubPage>
  );
}

const PERMISSION_ROWS: { key: keyof GroupPermissions; title: string; subtitle: string }[] = [
  {
    key: "add_members",
    title: "Who can add members",
    subtitle: "Choose who can add members to this group.",
  },
  {
    key: "edit_info",
    title: "Who can edit group info",
    subtitle:
      "Choose who can edit group name, photo, description, disappearing messages timer, and pinned messages.",
  },
  {
    key: "send_messages",
    title: "Who can send messages",
    subtitle: "Choose who can send messages to the group.",
  },
  {
    key: "member_labels",
    title: "Who can add member labels",
    subtitle: "Choose who can add member labels in this group.",
  },
];

function PermissionsPage({
  conversation,
  apply,
  onBack,
}: {
  conversation: ConversationDetail;
  apply: (call: () => Promise<ConversationDetail>, failure: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const [open, setOpen] = useState<keyof GroupPermissions | null>(null);
  const permissions = conversation.permissions;

  return (
    <SubPage title="Permissions" onBack={onBack}>
      <Card className="mt-2">
        {PERMISSION_ROWS.map((row) => {
          const value: Permission = permissions?.[row.key] ?? "all";
          return (
            <Row
              key={row.key}
              title={row.title}
              subtitle={row.subtitle}
              trailing={
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpen(open === row.key ? null : row.key)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12.5px] font-semibold text-ink hover:bg-surface-hover"
                  >
                    {value === "all" ? "All members" : "Only admins"}
                    <ChevronRightIcon size={12} className="rotate-90" />
                  </button>
                  {open === row.key && (
                    <Menu
                      align="right"
                      onClose={() => setOpen(null)}
                      items={(["all", "admins"] as Permission[]).map((option) => ({
                        label: `${option === value ? "✓  " : ""}${option === "all" ? "All members" : "Only Admins"}`,
                        onSelect: () =>
                          void apply(
                            () =>
                              conversationApi.setPermissions(conversation.id, {
                                [row.key]: option,
                              }),
                            "Could not change the permission.",
                          ),
                      }))}
                    />
                  )}
                </div>
              }
            />
          );
        })}
      </Card>
    </SubPage>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Card({ children, className = "mt-5" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-surface-raised py-1 ${className}`}>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  danger = false,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      {icon && (
        <span className={`flex w-5 shrink-0 justify-center ${danger ? "text-danger" : "text-ink"}`}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold ${danger ? "text-danger" : "text-ink"}`}>
          {title}
        </span>
        {subtitle && (
          <span className="block break-all text-[11.5px] leading-snug text-ink-2">{subtitle}</span>
        )}
      </span>
      {trailing}
    </>
  );
  const classes = "flex w-full items-center gap-3 px-4 py-2 text-left";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${classes} transition-colors hover:bg-surface-hover`}
    >
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}

function RoundAction({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 disabled:opacity-40"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-surface-sunken text-ink hover:brightness-125">
        {children}
      </span>
      <span className="text-[11px] font-semibold text-ink">{label}</span>
    </button>
  );
}

function IconButton({
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
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-ink hover:bg-surface-hover"
    >
      {children}
    </button>
  );
}

function InlineEdit({
  initial,
  max,
  label,
  multiline = false,
  onCancel,
  onSave,
}: {
  initial: string;
  max: number;
  label: string;
  multiline?: boolean;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const field = multiline ? (
    <textarea
      autoFocus
      rows={3}
      value={value}
      maxLength={max}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      className="w-full resize-none rounded-md bg-surface-sunken px-3 py-2 text-[13px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
    />
  ) : (
    <input
      autoFocus
      value={value}
      maxLength={max}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && value.trim()) void onSave(value.trim());
        if (event.key === "Escape") onCancel();
      }}
      className="h-9 w-full rounded-md bg-surface-sunken px-3 text-center text-[15px] font-semibold text-ink outline-none focus:ring-2 focus:ring-ultramarine"
    />
  );
  return (
    <div className="mt-3 w-full max-w-sm">
      {field}
      <div className="mt-2 flex justify-center gap-2">
        <DialogButton variant="secondary" onClick={onCancel}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          disabled={!multiline && !value.trim()}
          onClick={() => void onSave(value.trim())}
        >
          Save
        </DialogButton>
      </div>
    </div>
  );
}

export function LabelChip({ label }: { label: string }) {
  return (
    <span className="mt-0.5 inline-flex w-fit items-center rounded bg-[#1f6f3a] px-1.5 text-[10.5px] font-semibold leading-[16px] text-[#b7f5c6]">
      {label}
    </span>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-ultramarine bg-ultramarine" : "border-ink-3"}`}
    >
      {on && (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          <path
            d="m2.5 6.2 2.2 2.2 4.8-4.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

function svg(children: ReactNode, size = 16) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function BellSlash({ muted, size = 16 }: { muted: boolean; size?: number }) {
  return svg(
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9Z" />
      <path d="M13.7 18a2 2 0 0 1-3.4 0" />
      {muted && <path d="m3 3 18 18" />}
    </>,
    size,
  );
}
const PaletteIcon = () =>
  svg(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" />
    </>,
  );
const TagIcon = () =>
  svg(
    <>
      <path d="M3 12V4h8l9 9-8 8Z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </>,
  );
const KeyIcon = () =>
  svg(
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l3 3M15 8l2 2" />
    </>,
  );
const LeaveIcon = () =>
  svg(
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 8l-4 4 4 4M5 12h11" />
    </>,
  );
const BlockIcon = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>,
  );
const CloseCircle = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>,
  );
const ResetGlyph = () =>
  svg(
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4.5h4.5" />
    </>,
  );
const RingGlyph = () => svg(<circle cx="12" cy="12" r="7" />);
const ReplyGlyph = () =>
  svg(
    <>
      <path d="M9 10 4 15l5 5" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </>,
  );
