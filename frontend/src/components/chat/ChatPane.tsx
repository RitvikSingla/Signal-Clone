"use client";

/**
 * The right-hand pane: header, pinned banner, thread, and either the
 * composer or, while a message request is pending, the request bar. It also
 * owns the per-thread interaction state behind the message menu: replying,
 * editing, selecting, the Pin / Delete / Forward dialogs, the Info screen
 * that replaces the thread, and the media lightbox. And it is the drop zone
 * for files dragged onto the conversation.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useNow } from "@/hooks/useNow";

import { Lightbox, download, isImage, isVideo } from "@/components/chat/Attachments";
import { CallLobby } from "@/components/chat/CallLobby";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer, type ComposerHandle } from "@/components/chat/Composer";
import { ConversationHero } from "@/components/chat/ConversationHero";
import { ContactDetails } from "@/components/chat/ContactDetails";
import { ContactModal } from "@/components/chat/ContactModal";
import { GroupDetails } from "@/components/chat/GroupDetails";
import { MuteUntilDialog } from "@/components/chat/MuteMenu";
import { CustomTimerDialog } from "@/components/chat/TimerSelect";
import { MessageBubble, type BubbleActions } from "@/components/chat/MessageBubble";
import { DeleteDialog, ForwardDialog, PinDialog } from "@/components/chat/MessageDialogs";
import { MessageInfoView } from "@/components/chat/MessageInfoView";
import { MessageList } from "@/components/chat/MessageList";
import { AcceptedNotice, MessageRequestBar } from "@/components/chat/MessageRequest";
import { PinnedBar } from "@/components/chat/PinnedBar";
import { CloseIcon, ForwardIcon, SignalMark, TrashIcon } from "@/components/ui/Icons";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { conversationApi, mediaUrl } from "@/lib/endpoints";
import { requestMedia } from "@/lib/media";
import type {
  Attachment,
  Contact,
  ConversationDetail,
  ConversationSummary,
  Message,
} from "@/lib/types";
import { nicknameMap } from "@/lib/nicknames";
import { useChat } from "@/store/chat";
import { useUi } from "@/store/ui";

type ChatPaneProps = {
  conversation: ConversationDetail | null;
  conversations: ConversationSummary[];
  messages: Message[];
  pins: Message[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  typingPeople: { userId: string; displayName: string }[];
  isRequest: boolean;
  verified: boolean;
  commonGroups: string[];
  acceptedAt: string | null;
  onTyping: (isTyping: boolean) => void;
  onBack: () => void;
  onComingSoon: (feature: string) => void;
  onLoadOlder: () => void;
  onSend: (body: string, replyToId: string | null, attachments: Attachment[]) => void;
  onEdit: (message: Message, body: string) => void;
  onReact: (message: Message, emoji: string) => void;
  onCopy: (message: Message) => void;
  onPin: (message: Message, seconds: number | null) => void;
  onUnpin: (messageId: string) => void;
  onDeleteForEveryone: (messageIds: string[]) => void;
  onDeleteForMe: (messageIds: string[]) => void;
  onForward: (messageIds: string[], conversationIds: string[]) => Promise<void>;
  onAccept: () => void;
  onBlock: () => void;
  onReport: (alsoBlock: boolean) => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDisappearing: (seconds: number) => void;
  onSafetyTips: () => void;
  onWhatsNew: () => void;
  /** Header search: scope the chat list's search to this conversation. */
  onSearchInChat: () => void;
  contacts: Contact[];
  onMute: (until: string | null) => void;
  onMarkUnread: () => void;
  onBlockChat: () => void;
  onDeleteChat: () => Promise<void>;
  onLeftGroup: () => void;
  onMessageUser: (userId: string) => void;
  /** Open a direct chat with this person and start a call there. */
  onCallUser: (userId: string, kind: "video" | "voice") => void;
  /** A call asked for from a contact modal, to start once this chat is open. */
  pendingCall: { userId: string; kind: "video" | "voice" } | null;
  onPendingCallHandled: () => void;
  /** Groups shared with the person in a direct chat. */
  commonGroupList: ConversationSummary[];
  onOpenChat: (conversationId: string) => void;
  /** Set by a search hit: scroll to this message (paging back if needed). */
  jumpRequest: { messageId: string; nonce: number } | null;
  onLoadUntil: (messageId: string) => Promise<boolean>;
  /** The first message that was unread on opening, and how many were. */
  unreadFromId: string | null;
  unreadCount: number;
};

type Dialog =
  | null
  | { kind: "pin"; message: Message }
  | { kind: "delete"; ids: string[] }
  | { kind: "forward"; ids: string[] };

export function ChatPane(props: ChatPaneProps) {
  const {
    conversation,
    messages,
    loading,
    hasMore,
    currentUserId,
    typingPeople,
    isRequest,
    verified,
    commonGroups,
    acceptedAt,
  } = props;

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [infoFor, setInfoFor] = useState<Message | null>(null);
  const [selection, setSelection] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [lightbox, setLightbox] = useState<{ message: Message; index: number } | null>(null);
  const [jumpId, setJumpId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [call, setCall] = useState<{ kind: "video" | "voice"; stream: MediaStream } | null>(null);
  const [view, setView] = useState<"thread" | "details">("thread");
  const [memberCard, setMemberCard] = useState<string | null>(null);
  const [menuDialog, setMenuDialog] = useState<
    null | "custom-timer" | "mute-until" | "all-media" | "delete-chat" | "leave" | "block"
  >(null);
  const chatColor = useUi((state) =>
    conversation ? state.chatColors[conversation.id] : undefined,
  );
  const removeMessages = useChat((state) => state.removeMessages);
  const contacts = props.contacts;
  const nicknames = useMemo(() => nicknameMap(contacts), [contacts]);
  const blockedPeer = useChat((state) => {
    const peerId = conversation?.peer?.id;
    return peerId && state.contacts.some((c) => c.user.id === peerId && c.is_blocked)
      ? peerId
      : null;
  });
  const composer = useRef<ComposerHandle | null>(null);
  const now = useNow();
  const { jumpRequest, onLoadUntil } = props;

  // A search hit asks for a message: page back until it is loaded, then
  // scroll to it and flash it.
  useEffect(() => {
    if (!jumpRequest) return;
    let live = true;
    void onLoadUntil(jumpRequest.messageId).then((found) => {
      if (!live || !found) return;
      setJumpId(jumpRequest.messageId);
      setTimeout(() => live && setJumpId(null), 1600);
    });
    return () => {
      live = false;
    };
  }, [jumpRequest, onLoadUntil]);

  // Disappearing messages leave the screen the moment they expire; the
  // server's sweep (and its socket frame) follows within a couple of seconds.
  const conversationId = conversation?.id;
  useEffect(() => {
    if (!conversationId) return;
    const pending = messages
      .filter((m) => m.expires_at)
      .map((m) => ({ id: m.id, at: new Date(m.expires_at as string).getTime() }));
    if (!pending.length) return;
    const next = Math.min(...pending.map((p) => p.at));
    const timer = setTimeout(
      () => {
        const due = pending.filter((p) => p.at <= Date.now() + 250).map((p) => p.id);
        if (due.length) removeMessages(conversationId, due);
      },
      Math.max(0, next - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [messages, conversationId, removeMessages]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of conversation?.members ?? []) {
      if (member.label) map[member.user.id] = member.label;
    }
    return map;
  }, [conversation?.members]);

  // A call asked for from someone's contact modal starts once their chat
  // is the one open.
  const { pendingCall, onPendingCallHandled } = props;
  const peerId = conversation?.type === "direct" ? conversation.peer?.id : undefined;
  useEffect(() => {
    if (!pendingCall || !peerId || pendingCall.userId !== peerId) return;
    onPendingCallHandled();
    void startCall(pendingCall.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCall, peerId]);

  if (!conversation) return <EmptyPane onWhatsNew={props.onWhatsNew} />;

  const isGroup = conversation.type === "group";
  const openInfo = () => setView("details");

  if (view === "details" && !isGroup) {
    return (
      <ContactDetails
        conversation={conversation}
        commonGroups={props.commonGroupList}
        onBack={() => setView("thread")}
        onCall={(kind) => void startCall(kind)}
        onSearch={() => {
          setView("thread");
          props.onSearchInChat();
        }}
        onMute={props.onMute}
        onOpenChat={props.onOpenChat}
        onDeleteChat={props.onDeleteChat}
      />
    );
  }

  if (view === "details" && isGroup) {
    return (
      <GroupDetails
        conversation={conversation}
        currentUserId={currentUserId}
        contacts={props.contacts}
        onBack={() => setView("thread")}
        onCall={(kind) => void startCall(kind)}
        onSearch={() => {
          setView("thread");
          props.onSearchInChat();
        }}
        onMessage={props.onMessageUser}
        onCallUser={props.onCallUser}
        onMute={props.onMute}
        onLeft={() => {
          setView("thread");
          props.onLeftGroup();
        }}
      />
    );
  }

  const highlightId = jumpId;
  const byId = (id: string) => messages.find((m) => m.id === id);

  function jumpTo(messageId: string) {
    if (!byId(messageId)) return;
    setJumpId(messageId);
    // Re-set after a beat so jumping to the same message twice still scrolls.
    setTimeout(() => setJumpId((current) => (current === messageId ? null : current)), 1600);
  }

  async function startCall(kind: "video" | "voice") {
    const stream = await requestMedia(kind === "video" ? "video-call" : "voice-call");
    if (stream) setCall({ kind, stream });
  }

  const actions: BubbleActions = {
    onReply: (message) => {
      setEditing(null);
      setReplyingTo(message);
    },
    onReact: props.onReact,
    onForward: (message) => setDialog({ kind: "forward", ids: [message.id] }),
    onEdit: (message) => {
      setReplyingTo(null);
      setEditing(message);
    },
    onSelect: (message) => setSelection([message.id]),
    onCopy: props.onCopy,
    onPin: (message) => setDialog({ kind: "pin", message }),
    onUnpin: (message) => props.onUnpin(message.id),
    onInfo: setInfoFor,
    onDelete: (message) => setDialog({ kind: "delete", ids: [message.id] }),
    onOpenMedia: (message, index) => setLightbox({ message, index }),
    onDownload: (message) => {
      for (const attachment of message.attachments) void download(attachment, message.created_at);
    },
    onOpenSender: setMemberCard,
  };

  const renderStatic = (message: Message) => (
    <MessageBubble
      message={message}
      mine={message.sender?.id === currentUserId}
      isGroup={conversation.type === "group"}
      currentUserId={currentUserId}
      now={now}
      highlighted={false}
      startsRun
      endsRun
      readOnly
      actions={actions}
    />
  );

  if (infoFor) {
    const live = byId(infoFor.id) ?? infoFor;
    return (
      <MessageInfoView
        message={live}
        mine={live.sender?.id === currentUserId}
        renderBubble={renderStatic}
        onBack={() => setInfoFor(null)}
      />
    );
  }

  const selectedMessages = (selection ?? []).map(byId).filter(Boolean) as Message[];
  const deleteTargets =
    dialog?.kind === "delete" ? (dialog.ids.map(byId).filter(Boolean) as Message[]) : [];
  const canDeleteForEveryone =
    deleteTargets.length > 0 &&
    deleteTargets.every((m) => m.sender?.id === currentUserId && !m.deleted_at);

  const lightboxItems = lightbox
    ? lightbox.message.attachments.filter((a) => isImage(a) || isVideo(a))
    : [];

  return (
    <section
      className="relative flex h-full min-w-0 flex-1 flex-col bg-surface"
      onDragEnter={(event) => {
        if (isRequest || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (dragging) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!dragging) return;
        event.preventDefault();
        setDragging(false);
        const files = [...event.dataTransfer.files];
        if (files.length) composer.current?.addFiles(files);
      }}
    >
      <ChatHeader
        conversation={conversation}
        isRequest={isRequest}
        onSearch={props.onSearchInChat}
        onBack={props.onBack}
        onOpenInfo={openInfo}
        onCall={(kind) => void startCall(kind)}
        onTogglePin={props.onTogglePin}
        onArchive={props.onArchive}
        onDisappearing={props.onDisappearing}
        onCustomTimer={() => setMenuDialog("custom-timer")}
        onMute={props.onMute}
        onMuteUntil={() => setMenuDialog("mute-until")}
        onAllMedia={() => setMenuDialog("all-media")}
        onSelectMessages={() => setSelection([])}
        onMarkUnread={props.onMarkUnread}
        onBlock={() => setMenuDialog("block")}
        onDelete={() => setMenuDialog("delete-chat")}
        onLeave={() => setMenuDialog("leave")}
      />

      <PinnedBar
        pins={props.pins}
        currentUserId={currentUserId}
        onJump={jumpTo}
        onUnpin={props.onUnpin}
      />

      {loading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-2">
          Loading conversation…
        </div>
      ) : (
        <MessageList
          conversationId={conversation.id}
          messages={messages}
          currentUserId={currentUserId}
          isGroup={conversation.type === "group"}
          hasMore={hasMore}
          loading={loading}
          typingPeople={typingPeople}
          highlightId={highlightId}
          labels={labels}
          nicknames={nicknames}
          outgoingColor={chatColor}
          unreadFromId={props.unreadFromId}
          unreadCount={props.unreadCount}
          selection={selection}
          onToggleSelected={(message) =>
            setSelection((current) =>
              current?.includes(message.id)
                ? current.filter((id) => id !== message.id)
                : [...(current ?? []), message.id],
            )
          }
          onJumpTo={jumpTo}
          hero={
            <ConversationHero
              conversation={conversation}
              currentUserId={currentUserId}
              verified={verified}
              commonGroups={commonGroups}
              showSafetyTips={isRequest}
              onOpenInfo={openInfo}
              onSafetyTips={props.onSafetyTips}
            />
          }
          event={
            acceptedAt && !isRequest
              ? {
                  at: acceptedAt,
                  node: (
                    <AcceptedNotice
                      key="accepted"
                      name={conversation.title}
                      onBlock={props.onBlock}
                      onReport={props.onReport}
                    />
                  ),
                }
              : null
          }
          onLoadOlder={props.onLoadOlder}
          actions={actions}
        />
      )}

      {selection ? (
        <SelectionBar
          count={selection.length}
          onCancel={() => setSelection(null)}
          onForward={() =>
            selectedMessages.length &&
            setDialog({
              kind: "forward",
              ids: selectedMessages
                .filter((m) => !m.deleted_at && m.type !== "system")
                .map((m) => m.id),
            })
          }
          onDelete={() => selection.length && setDialog({ kind: "delete", ids: selection })}
        />
      ) : conversation.can_send === false ? (
        <CannotSendBar conversation={conversation} currentUserId={currentUserId} />
      ) : blockedPeer ? (
        <BlockedBar name={conversation.title} userId={blockedPeer} />
      ) : isRequest ? (
        <MessageRequestBar
          name={conversation.title}
          onAccept={props.onAccept}
          onBlock={props.onBlock}
          onReport={props.onReport}
        />
      ) : (
        <Composer
          key={conversation.id}
          handleRef={composer}
          currentUserId={currentUserId}
          replyingTo={replyingTo}
          editing={editing}
          onCancelReply={() => setReplyingTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSaveEdit={props.onEdit}
          onComingSoon={props.onComingSoon}
          onSend={(body, replyToId, attachments) => {
            props.onTyping(false);
            props.onSend(body, replyToId, attachments);
          }}
          onTyping={props.onTyping}
        />
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-ultramarine bg-surface/85">
          <p className="text-[15px] font-semibold text-ink">
            Drop files to add them to your message
          </p>
        </div>
      )}

      {dialog?.kind === "pin" && (
        <PinDialog
          onClose={() => setDialog(null)}
          onPin={(seconds) => props.onPin(dialog.message, seconds)}
        />
      )}

      {dialog?.kind === "delete" && (
        <DeleteDialog
          count={dialog.ids.length}
          canDeleteForEveryone={canDeleteForEveryone}
          onClose={() => setDialog(null)}
          onDeleteForEveryone={() => {
            props.onDeleteForEveryone(dialog.ids);
            setSelection(null);
          }}
          onDeleteForMe={() => {
            props.onDeleteForMe(dialog.ids);
            setSelection(null);
          }}
        />
      )}

      {dialog?.kind === "forward" && (
        <ForwardDialog
          conversations={props.conversations}
          onClose={() => setDialog(null)}
          onForward={async (conversationIds) => {
            await props.onForward(dialog.ids, conversationIds);
            setSelection(null);
          }}
        />
      )}

      {lightbox && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          start={Math.min(lightbox.index, lightboxItems.length - 1)}
          caption={lightbox.message.body}
          sentAt={lightbox.message.created_at}
          onForward={() => {
            const id = lightbox.message.id;
            setLightbox(null);
            setDialog({ kind: "forward", ids: [id] });
          }}
          onClose={() => setLightbox(null)}
        />
      )}

      {menuDialog === "custom-timer" && (
        <CustomTimerDialog
          onClose={() => setMenuDialog(null)}
          onSave={(seconds) => {
            props.onDisappearing(seconds);
            setMenuDialog(null);
          }}
        />
      )}
      {menuDialog === "mute-until" && (
        <MuteUntilDialog
          onClose={() => setMenuDialog(null)}
          onMute={(until) => props.onMute(until)}
        />
      )}
      {menuDialog === "all-media" && (
        <AllMediaDialog
          messages={messages}
          onClose={() => setMenuDialog(null)}
          onOpen={(message, index) => {
            setMenuDialog(null);
            setLightbox({ message, index });
          }}
        />
      )}
      {menuDialog === "delete-chat" && (
        <ConfirmDialog
          title="Delete chat?"
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setMenuDialog(null)}
          onConfirm={() => void props.onDeleteChat()}
        >
          This chat will be deleted from this device. Other people in it keep their messages.
        </ConfirmDialog>
      )}
      {menuDialog === "leave" && (
        <ConfirmDialog
          title="Leave group?"
          confirmLabel="Leave"
          tone="danger"
          onClose={() => setMenuDialog(null)}
          onConfirm={() =>
            void conversationApi
              .leave(conversation.id)
              .then(props.onLeftGroup)
              .catch(() => props.onComingSoon("Leaving groups offline"))
          }
        >
          You will no longer be able to send or receive messages in this group.
        </ConfirmDialog>
      )}
      {menuDialog === "block" && (
        <ConfirmDialog
          title={`Block ${conversation.title}?`}
          confirmLabel="Block"
          tone="danger"
          onClose={() => setMenuDialog(null)}
          onConfirm={props.onBlockChat}
        >
          Blocked people won&rsquo;t be able to call you or send you messages.
        </ConfirmDialog>
      )}

      {memberCard &&
        (() => {
          const person =
            conversation.members.find((m) => m.user.id === memberCard)?.user ??
            messages.find((m) => m.sender?.id === memberCard)?.sender;
          return person ? (
            <ContactModal
              person={person}
              group={isGroup ? conversation : null}
              currentUserId={currentUserId}
              onClose={() => setMemberCard(null)}
              onMessage={props.onMessageUser}
              onCall={props.onCallUser}
            />
          ) : null;
        })()}

      {call && (
        <CallLobby
          conversation={conversation}
          kind={call.kind}
          stream={call.stream}
          onLeave={() => setCall(null)}
        />
      )}
    </section>
  );
}

/** Instead of the composer, after you block someone. */
function BlockedBar({ name, userId }: { name: string; userId: string }) {
  const unblockPeer = useChat((state) => state.unblockPeer);
  return (
    <div className="shrink-0 px-6 pb-4 pt-2 text-center">
      <p className="text-[12.5px] text-ink">
        You blocked <strong className="font-semibold">{name}</strong>. Unblock them to send a
        message.
      </p>
      <button
        type="button"
        onClick={() => void unblockPeer(userId)}
        className="mt-2.5 rounded-full bg-surface-chip px-4 py-1.5 text-[12.5px] font-semibold text-link hover:brightness-110"
      >
        Unblock
      </button>
    </div>
  );
}

/** Stands in for the composer when this person may not send here. */
function CannotSendBar({
  conversation,
  currentUserId,
}: {
  conversation: ConversationDetail;
  currentUserId: string;
}) {
  const member = conversation.members.find((m) => m.user.id === currentUserId);
  const text = conversation.ended_at
    ? "This group has ended. You can no longer send messages to it."
    : member && !member.is_active
      ? "You can't send messages to this group because you're no longer a member."
      : "Only admins can send messages.";
  return <div className="shrink-0 px-6 pb-4 pt-2 text-center text-[12.5px] text-ink-2">{text}</div>;
}

/** "All media": the photos and videos in what is loaded of this thread. */
function AllMediaDialog({
  messages,
  onClose,
  onOpen,
}: {
  messages: Message[];
  onClose: () => void;
  onOpen: (message: Message, index: number) => void;
}) {
  const items = messages.flatMap((message) =>
    message.attachments
      .filter((a) => isImage(a) || isVideo(a))
      .map((attachment, index) => ({ message, attachment, index })),
  );
  return (
    <Modal onClose={onClose} label="All media" width={520} closeButton>
      <h2 className="text-[15px] font-semibold text-ink">All media</h2>
      {items.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-2">No media in this chat yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-1">
          {items.map(({ message, attachment, index }) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => onOpen(message, index)}
              className="aspect-square overflow-hidden rounded-md bg-surface-sunken"
              aria-label={`Open ${attachment.file_name}`}
            >
              {isVideo(attachment) ? (
                <video src={mediaUrl(attachment.url)} muted className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(attachment.thumbnail_url ?? attachment.url)}
                  alt=""
                  className="size-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Replaces the composer while messages are being selected. */
function SelectionBar({
  count,
  onCancel,
  onForward,
  onDelete,
}: {
  count: number;
  onCancel: () => void;
  onForward: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-t border-border bg-surface px-4">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="flex size-8 items-center justify-center rounded-full text-ink hover:bg-surface-hover"
      >
        <CloseIcon size={16} />
      </button>
      <span className="flex-1 text-[13px] font-semibold text-ink">
        {count} {count === 1 ? "message" : "messages"} selected
      </span>
      <button
        type="button"
        disabled={count === 0}
        onClick={onForward}
        className="flex h-8 items-center gap-1.5 rounded-full bg-surface-chip px-3.5 text-[13px] font-semibold text-ink hover:brightness-110 disabled:opacity-40"
      >
        <ForwardIcon size={14} /> Forward
      </button>
      <button
        type="button"
        disabled={count === 0}
        onClick={onDelete}
        className="flex h-8 items-center gap-1.5 rounded-full bg-surface-chip px-3.5 text-[13px] font-semibold text-danger hover:brightness-110 disabled:opacity-40"
      >
        <TrashIcon size={14} /> Delete
      </button>
    </div>
  );
}

/**
 * Signal's welcome pane: the mark, a greeting, the what's-new link, and the
 * nonprofit line anchored to the bottom of the pane.
 */
function EmptyPane({ onWhatsNew }: { onWhatsNew: () => void }) {
  return (
    <section className="relative hidden min-w-0 flex-1 flex-col items-center justify-center bg-surface px-6 text-center md:flex">
      <SignalMark size={84} className="text-ink" />
      <h2 className="mt-5 text-[17px] font-semibold tracking-tight text-ink">Welcome to Signal</h2>
      <p className="mt-0.5 text-[13px] text-ink">
        See{" "}
        <button type="button" onClick={onWhatsNew} className="text-link hover:underline">
          what&rsquo;s new
        </button>{" "}
        in this update
      </p>
      <p className="absolute bottom-6 text-[12px] text-ink-2">Signal is a 501c3 nonprofit</p>
    </section>
  );
}
