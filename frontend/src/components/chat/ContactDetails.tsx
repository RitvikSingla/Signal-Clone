"use client";

/**
 * Chat settings for a one-to-one chat, laid out like the group page: the
 * person's photo, name, about and handle, Video / Call / Mute / Search,
 * disappearing messages, chat color and notifications, then Add to
 * contacts (or Remove from contacts), View safety number, the groups you
 * share, and Block / Report spam / Delete chat.
 */

import { useEffect, useState } from "react";

import {
  BellSlash,
  Card,
  ChatColorPage,
  IconButton,
  NotificationsPage,
  RoundAction,
  Row,
} from "@/components/chat/GroupDetails";
import { muteItems, MuteUntilDialog } from "@/components/chat/MuteMenu";
import { TimerSelect } from "@/components/chat/TimerSelect";
import { Avatar } from "@/components/ui/Avatar";
import {
  ChevronLeftIcon,
  LockIcon,
  PersonIcon,
  PhoneIcon,
  SearchIcon,
  TimerIcon,
  TrashIcon,
  VideoIcon,
  WarningIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { ConfirmDialog, DialogButton, Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { conversationApi, userApi } from "@/lib/endpoints";
import { presenceLabel } from "@/lib/format";
import { DEFAULT_CHAT_COLOR } from "@/lib/groups";
import type { ConversationDetail, ConversationSummary } from "@/lib/types";
import { useChat } from "@/store/chat";
import { useUi } from "@/store/ui";

type Props = {
  conversation: ConversationDetail;
  commonGroups: ConversationSummary[];
  onBack: () => void;
  onCall: (kind: "video" | "voice") => void;
  onSearch: () => void;
  onMute: (until: string | null) => void;
  onOpenChat: (conversationId: string) => void;
  onDeleteChat: () => Promise<void>;
};

export function ContactDetails(props: Props) {
  const { conversation } = props;
  const [page, setPage] = useState<"main" | "chat-color" | "notifications" | "while-muted">("main");

  if (page === "chat-color") {
    return <ChatColorPage conversationId={conversation.id} onBack={() => setPage("main")} />;
  }
  if (page === "notifications" || page === "while-muted") {
    return (
      <NotificationsPage
        conversation={conversation}
        sub={page === "while-muted"}
        onOpenWhileMuted={() => setPage("while-muted")}
        onBack={() => setPage(page === "while-muted" ? "notifications" : "main")}
        onMute={props.onMute}
      />
    );
  }
  return <MainPage {...props} onOpen={setPage} />;
}

function MainPage({
  conversation,
  commonGroups,
  onBack,
  onCall,
  onSearch,
  onMute,
  onOpenChat,
  onDeleteChat,
  onOpen,
}: Props & { onOpen: (page: "chat-color" | "notifications") => void }) {
  const push = useToasts((state) => state.push);
  const peer = conversation.peer;
  const contact = useChat((state) => state.contacts.find((c) => c.user.id === peer?.id));
  const addContact = useChat((state) => state.addContact);
  const removeContact = useChat((state) => state.removeContact);
  const unblockPeer = useChat((state) => state.unblockPeer);
  const blockPeer = useChat((state) => state.blockPeer);
  const setDetail = useChat((state) => state.setDetail);
  const chatColor = useUi((state) => state.chatColors[conversation.id]) ?? DEFAULT_CHAT_COLOR;

  const [muteOpen, setMuteOpen] = useState(false);
  const [untilOpen, setUntilOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "remove" | "block" | "report" | "delete" | "safety">(
    null,
  );

  if (!peer) return null;
  const blocked = Boolean(contact?.is_blocked);
  const isContact = Boolean(contact) && !blocked;

  async function run(action: () => Promise<void>, done: string, failure: string) {
    try {
      await action();
      push(done);
    } catch (error) {
      push(error instanceof ApiError ? error.message : failure);
    }
  }

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
              name={peer.display_name}
              colorKey={peer.avatar_color}
              url={peer.avatar_url}
              size={72}
            />
            <h2 className="mt-3 text-[20px] font-semibold text-ink">{peer.display_name}</h2>
            {peer.about && <p className="mt-0.5 max-w-md text-[13px] text-ink">{peer.about}</p>}
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              {peer.username ? `@${peer.username} · ` : ""}
              {peer.phone_number}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-2">
              {presenceLabel(peer.is_online, peer.last_seen_at)}
            </p>

            <div className="mt-4 flex gap-5">
              <RoundAction label="Video" onClick={() => onCall("video")} disabled={blocked}>
                <VideoIcon size={17} />
              </RoundAction>
              <RoundAction label="Audio" onClick={() => onCall("voice")} disabled={blocked}>
                <PhoneIcon size={15} />
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
              subtitle="When enabled, messages sent and received in this chat will disappear after they've been seen."
              trailing={
                <TimerSelect
                  value={conversation.disappearing_seconds}
                  onChange={(seconds) =>
                    void conversationApi
                      .update(conversation.id, { disappearing_seconds: seconds })
                      .then(setDetail)
                      .catch(() => push("Could not change the timer."))
                  }
                />
              }
            />
            <Row
              icon={<PaletteGlyph />}
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

          <Card className="mt-4">
            {isContact ? (
              <Row
                icon={<PersonIcon size={16} />}
                title="Remove from contacts"
                onClick={() => setDialog("remove")}
              />
            ) : (
              !blocked && (
                <Row
                  icon={<PersonPlusIcon />}
                  title="Add to contacts"
                  subtitle="Save this person to your contacts."
                  onClick={() =>
                    void run(
                      () => addContact(peer.id),
                      `${peer.display_name} added to your contacts`,
                      "Could not add the contact.",
                    )
                  }
                />
              )
            )}
            <Row
              icon={<LockIcon size={15} />}
              title="View safety number"
              onClick={() => setDialog("safety")}
            />
          </Card>

          <div className="mt-6 px-1">
            <h3 className="text-[13px] font-semibold text-ink">
              {commonGroups.length === 0
                ? "No groups in common"
                : `${commonGroups.length} ${commonGroups.length === 1 ? "group" : "groups"} in common`}
            </h3>
          </div>
          {commonGroups.length > 0 && (
            <Card className="mt-2">
              {commonGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onOpenChat(group.id)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover"
                >
                  <Avatar
                    name={group.title}
                    colorKey={group.avatar_color}
                    url={group.avatar_url}
                    size={30}
                    group
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {group.title}
                    </span>
                    <span className="block text-[12px] text-ink-2">
                      {group.member_count} {group.member_count === 1 ? "member" : "members"}
                    </span>
                  </span>
                </button>
              ))}
            </Card>
          )}

          <Card className="mt-4">
            {blocked ? (
              <Row
                icon={<BlockIcon />}
                title="Unblock"
                onClick={() =>
                  void run(
                    () => unblockPeer(peer.id),
                    `${peer.display_name} unblocked`,
                    "Could not unblock.",
                  )
                }
              />
            ) : (
              <Row danger icon={<BlockIcon />} title="Block" onClick={() => setDialog("block")} />
            )}
            <Row
              danger
              icon={<WarningIcon size={16} />}
              title="Report spam"
              onClick={() => setDialog("report")}
            />
            <Row
              danger
              icon={<TrashIcon size={16} />}
              title="Delete chat"
              onClick={() => setDialog("delete")}
            />
          </Card>
        </div>
      </div>

      {untilOpen && (
        <MuteUntilDialog onClose={() => setUntilOpen(false)} onMute={(until) => onMute(until)} />
      )}

      {dialog === "remove" && (
        <ConfirmDialog
          title={`Remove ${peer.display_name}?`}
          confirmLabel="Remove"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void run(
              () => removeContact(peer.id),
              `${peer.display_name} removed from your contacts`,
              "Could not remove the contact.",
            )
          }
        >
          {peer.display_name} will be removed from your contacts. Your chat stays where it is.
        </ConfirmDialog>
      )}
      {dialog === "block" && (
        <ConfirmDialog
          title={`Block ${peer.display_name}?`}
          confirmLabel="Block"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void run(
              () => blockPeer(conversation.id, peer.id, false),
              `${peer.display_name} blocked`,
              "Could not block.",
            )
          }
        >
          Blocked people won&rsquo;t be able to call you or send you messages.
        </ConfirmDialog>
      )}
      {dialog === "report" && (
        <Modal onClose={() => setDialog(null)} label="Report spam?" width={330}>
          <h2 className="text-center text-[14px] font-semibold text-ink">Report spam?</h2>
          <p className="mt-2 text-center text-[13px] leading-[1.45] text-ink">
            Signal will be notified that this person may be sending spam. Signal can&rsquo;t see the
            content of any chats.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <DialogButton
              variant="danger"
              onClick={() => {
                push("Reported as spam");
                setDialog("block");
              }}
            >
              Report and block
            </DialogButton>
            <DialogButton
              variant="danger"
              onClick={() => {
                push("Reported as spam");
                setDialog(null);
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
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete chat?"
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setDialog(null)}
          onConfirm={() => void onDeleteChat()}
        >
          This chat will be deleted from this device. {peer.display_name} keeps their copy.
        </ConfirmDialog>
      )}
      {dialog === "safety" && (
        <SafetyNumberDialog
          peerId={peer.id}
          name={peer.display_name}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

export function SafetyNumberDialog({
  peerId,
  name,
  onClose,
}: {
  peerId: string;
  name: string;
  onClose: () => void;
}) {
  const [number, setNumber] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    userApi
      .safetyNumber(peerId)
      .then((result) => live && setNumber(result.safety_number))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [peerId]);

  const groups = number?.replace(/\s+/g, "").match(/.{1,5}/g) ?? [];

  return (
    <Modal onClose={onClose} label="Safety number" width={360} closeButton>
      <h2 className="text-center text-[15px] font-semibold text-ink">Safety number</h2>
      <p className="mt-2 text-center text-[12.5px] leading-snug text-ink-2">
        To check end-to-end encryption with {name}, compare these numbers with the ones on their
        device. In this clone the number is derived from both accounts, not from a real key
        exchange.
      </p>
      <div className="mt-4 rounded-xl bg-surface-chip px-4 py-4">
        {failed ? (
          <p className="text-center text-[13px] text-ink-2">Could not load the safety number.</p>
        ) : !number ? (
          <p className="text-center text-[13px] text-ink-2">Loading…</p>
        ) : (
          <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-center font-mono text-[15px] tracking-wider text-ink">
            {groups.map((group, index) => (
              <span key={index}>{group}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex">
        <DialogButton variant="secondary" onClick={onClose}>
          Close
        </DialogButton>
      </div>
    </Modal>
  );
}

function PersonPlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </svg>
  );
}

export function BlockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  );
}

function PaletteGlyph() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}
