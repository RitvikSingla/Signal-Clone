"use client";

/**
 * The application shell.
 *
 * Holds the menu bar, the rail and the panes, decides what each shows, and
 * owns the keyboard shortcuts. Data lives in the stores; this component is
 * layout and wiring.
 *
 * Responsive rule, matching Signal: above 768px the list and the thread
 * sit side by side. Below it only one is visible, and opening a thread
 * slides the list away.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatPane } from "@/components/chat/ChatPane";
import { ConversationInfo } from "@/components/conversations/ConversationInfo";
import { ArchiveList, ConversationList } from "@/components/conversations/ConversationList";
import { AppDialogs } from "@/components/shell/AppDialogs";
import { CallsPane } from "@/components/shell/CallsPane";
import { MenuBar, toggleFullScreen } from "@/components/shell/MenuBar";
import { NavRail, type RailTab } from "@/components/shell/NavRail";
import { NewChatPane } from "@/components/shell/NewChatPane";
import { SettingsPane, type SectionId } from "@/components/shell/SettingsPane";
import { ONBOARDING_STORY_ID, StoriesPane } from "@/components/shell/StoriesPane";
import { useToasts } from "@/components/ui/Toasts";
import { useSocket } from "@/hooks/useSocket";
import { ApiError } from "@/lib/api";
import { conversationApi } from "@/lib/endpoints";
import type { ConversationSummary, Message, UserPrivate } from "@/lib/types";
import { useChat } from "@/store/chat";
import { useSession } from "@/store/session";
import { nextZoom, useUi } from "@/store/ui";

type ChatsView = "list" | "archive" | "new-chat";

export function SignalApp({ user }: { user: UserPrivate }) {
  const {
    conversations,
    archived,
    contacts,
    groupMembers,
    listLoading,
    listError,
    filter,
    search,
    activeId,
    detail,
    threads,
    typing,
    loadConversations,
    loadContacts,
    loadGroupMembers,
    loadArchived,
    setFilter,
    setSearch,
    openConversation,
    closeConversation,
    markConversationRead,
    loadOlder,
    sendMessage,
    react,
    clearReaction,
    deleteMessage,
    togglePin,
    setArchived,
    acceptRequest,
    blockPeer,
    pins,
    editMessage,
    hideMessages,
    forwardMessages,
    pinMessage,
    unpinMessage,
  } = useChat();

  // One socket for the session. Presence, typing and live delivery all
  // arrive through it; the store is what the UI reads.
  const { status: socketStatus, sendTyping } = useSocket(true);

  const push = useToasts((state) => state.push);
  const signOut = useSession((state) => state.signOut);

  const tabsHidden = useUi((state) => state.tabsHidden);
  const toggleTabs = useUi((state) => state.toggleTabs);
  const zoom = useUi((state) => state.zoom);
  const setZoom = useUi((state) => state.setZoom);
  const openDialog = useUi((state) => state.openDialog);
  const acceptedRequests = useUi((state) => state.acceptedRequests);
  const markAccepted = useUi((state) => state.markAccepted);
  const viewedStories = useUi((state) => state.viewedStories);

  const [tab, setTab] = useState<RailTab>("chats");
  const [chatsView, setChatsView] = useState<ChatsView>("list");
  const [settingsSection, setSettingsSection] = useState<SectionId>("profile");
  const [infoOpen, setInfoOpen] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  useEffect(() => {
    void loadConversations().then(() => void loadGroupMembers());
    void loadContacts().then(() => setContactsLoaded(true));
  }, [loadConversations, loadContacts, loadGroupMembers]);

  // The View menu's zoom, applied to the whole document as Electron would.
  useEffect(() => {
    document.documentElement.style.zoom = zoom === 1 ? "" : String(zoom);
  }, [zoom]);

  const contactIds = useMemo(() => new Set(contacts.map((c) => c.user.id)), [contacts]);

  /**
   * A direct thread is a message request while the other person is not in
   * your address book, they have written, and you have not: Signal's rule.
   */
  const isRequest = useCallback(
    (conversation: ConversationSummary): boolean => {
      if (!contactsLoaded || conversation.type !== "direct" || !conversation.peer) return false;
      const peerId = conversation.peer.id;
      if (contactIds.has(peerId)) return false;
      if (acceptedRequests[`${user.id}:${conversation.id}`]) return false;
      const thread = threads[conversation.id];
      if (thread && thread.messages.length > 0) {
        return (
          thread.messages.some((m) => m.sender?.id === peerId) &&
          !thread.messages.some((m) => m.sender?.id === user.id)
        );
      }
      return conversation.last_message?.sender_id === peerId;
    },
    [contactsLoaded, contactIds, acceptedRequests, threads, user.id],
  );

  const thread = activeId ? threads[activeId] : undefined;
  const unreadTotal = conversations
    .filter((c) => !isRequest(c))
    .reduce((sum, c) => sum + c.unread_count, 0);
  const typingPeople = activeId ? (typing[activeId] ?? []) : [];
  const activeIsRequest = detail ? isRequest(detail) : false;

  const commonGroups = useMemo(() => {
    const peerId = detail?.peer?.id;
    if (!peerId) return [];
    return conversations
      .filter((c) => c.type === "group" && groupMembers[c.id]?.includes(peerId))
      .map((c) => c.title);
  }, [detail?.peer?.id, conversations, groupMembers]);

  // Typing frames are throttled rather than sent per keystroke: one start
  // frame, then nothing until the sender pauses or sends.
  const typingState = useRef<{ id: string | null; stopAt: ReturnType<typeof setTimeout> | null }>({
    id: null,
    stopAt: null,
  });

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeId) return;
      const state = typingState.current;

      if (!isTyping) {
        if (state.stopAt) clearTimeout(state.stopAt);
        if (state.id) sendTyping(state.id, false);
        typingState.current = { id: null, stopAt: null };
        return;
      }

      if (state.id !== activeId) {
        sendTyping(activeId, true);
      }
      if (state.stopAt) clearTimeout(state.stopAt);
      typingState.current = {
        id: activeId,
        stopAt: setTimeout(() => {
          sendTyping(activeId, false);
          typingState.current = { id: null, stopAt: null };
        }, 3000),
      };
    },
    [activeId, sendTyping],
  );

  // Switching threads should not leave the previous one showing dots.
  useEffect(() => {
    return () => {
      const state = typingState.current;
      if (state.stopAt) clearTimeout(state.stopAt);
      if (state.id) sendTyping(state.id, false);
      typingState.current = { id: null, stopAt: null };
    };
  }, [activeId, sendTyping]);

  const handleSelect = useCallback(
    (id: string) => {
      setInfoOpen(false);
      const summary =
        conversations.find((c) => c.id === id) ?? archived.find((c) => c.id === id);
      void openConversation(id, { markRead: summary ? !isRequest(summary) : true });
    },
    [openConversation, conversations, archived, isRequest],
  );

  const comingSoon = useCallback(
    (feature: string) => push(`${feature} are a placeholder in this build.`),
    [push],
  );

  function openSettings(section: SectionId = "profile") {
    setSettingsSection(section);
    setTab("settings");
    setInfoOpen(false);
  }

  function openChat(id: string) {
    setTab("chats");
    setChatsView("list");
    void loadConversations();
    handleSelect(id);
  }

  async function startChatWith(userId: string) {
    try {
      const conversation = await conversationApi.createDirect(userId);
      setSearch("");
      openChat(conversation.id);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not open that chat.");
    }
  }

  async function handleAccept() {
    if (!detail?.peer) return;
    try {
      await acceptRequest(detail.peer.id);
      markAccepted(user.id, detail.id);
      // Only now does the sender learn their messages were read.
      await markConversationRead(detail.id);
    } catch {
      push("Could not accept the request. Try again.");
    }
  }

  async function handleBlock() {
    if (!detail?.peer) return;
    const name = detail.title;
    try {
      await blockPeer(detail.id, detail.peer.id);
      push(`${name} blocked`);
    } catch {
      push(`Could not block ${name}.`);
    }
  }

  async function handleReport(alsoBlock: boolean) {
    if (!detail?.peer) return;
    if (alsoBlock) {
      await handleBlock();
      push("Reported as spam and blocked");
      return;
    }
    push("Reported as spam");
  }

  function handleReact(message: Message, emoji: string) {
    const mine = message.reactions.find((r) => r.user_id === user.id);
    if (mine?.emoji === emoji) void clearReaction(message.id);
    else void react(message.id, emoji);
  }

  // Keyboard shortcuts, as listed in Help > Show Keyboard Shortcuts.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && !event.shiftKey && key === "n") {
        event.preventDefault();
        setTab("chats");
        setChatsView("new-chat");
        return;
      }
      if (meta && !event.shiftKey && key === "f") {
        event.preventDefault();
        setTab("chats");
        setChatsView("list");
        requestAnimationFrame(() => document.getElementById("conversation-search")?.focus());
        return;
      }
      if (meta && key === ",") {
        event.preventDefault();
        openSettings();
        return;
      }
      if (meta && (key === "/" || key === "?")) {
        event.preventDefault();
        openDialog("shortcuts");
        return;
      }
      if (meta && (key === "=" || key === "+")) {
        event.preventDefault();
        setZoom(nextZoom(useUi.getState().zoom, 1));
        return;
      }
      if (meta && key === "-") {
        event.preventDefault();
        setZoom(nextZoom(useUi.getState().zoom, -1));
        return;
      }
      if (meta && key === "0") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if (event.key === "F11") {
        event.preventDefault();
        toggleFullScreen();
        return;
      }
      if (meta && event.shiftKey && key === "t") {
        event.preventDefault();
        document.getElementById("composer-field")?.focus();
        return;
      }
      if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        const list = useChat.getState().conversations;
        if (!list.length) return;
        event.preventDefault();
        const index = list.findIndex((c) => c.id === useChat.getState().activeId);
        const step = event.key === "ArrowDown" ? 1 : -1;
        const target = list[(index + step + list.length) % list.length];
        setTab("chats");
        handleSelect(target.id);
        return;
      }
      if (event.key === "Escape" && infoOpen) setInfoOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [infoOpen, handleSelect, openDialog, setZoom]);

  const storiesUnseen = !viewedStories.includes(ONBOARDING_STORY_ID);
  const showRail = !tabsHidden;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface">
      <MenuBar onOpenSettings={() => openSettings()} onSignOut={() => void signOut()} />

      <div className="flex min-h-0 w-full flex-1">
        {/* On a phone the rail gives up its width to the open thread, the way
            Signal hands the whole screen to a conversation. */}
        {showRail && (
          <div className={`${activeId && tab === "chats" ? "hidden md:flex" : "flex"}`}>
            <NavRail
              active={tab}
              unreadTotal={unreadTotal}
              storiesUnseen={storiesUnseen}
              onToggleTabs={toggleTabs}
              onSelect={(next) => {
                setTab(next);
                if (next === "chats") setChatsView("list");
                if (next !== "chats") setInfoOpen(false);
              }}
            />
          </div>
        )}

        {tab === "chats" && (
          <>
            {/* The list hides on a phone once a thread is open. */}
            <div className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 w-full md:w-auto`}>
              {chatsView === "new-chat" ? (
                <NewChatPane
                  user={user}
                  contacts={contacts}
                  onClose={() => setChatsView("list")}
                  onOpened={(id) => openChat(id)}
                />
              ) : chatsView === "archive" ? (
                <ArchiveList
                  archived={archived}
                  activeId={activeId}
                  user={user}
                  isRequest={isRequest}
                  onBack={() => setChatsView("list")}
                  onSelect={handleSelect}
                />
              ) : (
                <ConversationList
                  conversations={conversations}
                  contacts={contacts}
                  loading={listLoading}
                  error={listError}
                  activeId={activeId}
                  user={user}
                  filter={filter}
                  search={search}
                  typing={typing}
                  isRequest={isRequest}
                  onFilterChange={setFilter}
                  onSearchChange={setSearch}
                  onSelect={handleSelect}
                  onCompose={() => setChatsView("new-chat")}
                  onOpenContact={(userId) => void startChatWith(userId)}
                  onViewArchive={() => {
                    void loadArchived();
                    setChatsView("archive");
                  }}
                  onOpenSettings={(section) => openSettings(section)}
                />
              )}
            </div>

            <div className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1`}>
              <ChatPane
                key={detail?.id ?? "empty"}
                conversation={detail}
                conversations={conversations}
                pins={activeId ? (pins[activeId] ?? []) : []}
                messages={thread?.messages ?? []}
                loading={thread?.loading ?? false}
                hasMore={thread?.hasMore ?? false}
                currentUserId={user.id}
                typingPeople={activeIsRequest ? [] : typingPeople}
                isRequest={activeIsRequest}
                // Accepting a request does not verify a name; only someone
                // already in your address book reads as verified.
                verified={
                  detail?.peer
                    ? contactIds.has(detail.peer.id) &&
                      !acceptedRequests[`${user.id}:${detail.id}`]
                    : true
                }
                commonGroups={commonGroups}
                acceptedAt={detail ? (acceptedRequests[`${user.id}:${detail.id}`] ?? null) : null}
                onTyping={handleTyping}
                onBack={closeConversation}
                onOpenInfo={() => setInfoOpen((open) => !open)}
                onComingSoon={comingSoon}
                onLoadOlder={() => activeId && void loadOlder(activeId)}
                onSend={(body, replyToId, attachments) =>
                  activeId && void sendMessage(activeId, body, replyToId, attachments)
                }
                onEdit={(message, body) =>
                  void editMessage(message.id, body).catch((error: unknown) =>
                    push(error instanceof ApiError ? error.message : "Could not edit the message."),
                  )
                }
                onReact={handleReact}
                onPin={(message, seconds) =>
                  void pinMessage(message.id, seconds).catch(() => push("Could not pin the message."))
                }
                onUnpin={(messageId) =>
                  void unpinMessage(messageId).catch(() => push("Could not unpin the message."))
                }
                onDeleteForEveryone={(ids) =>
                  void Promise.all(ids.map((id) => deleteMessage(id))).catch(() =>
                    push("Could not delete for everyone."),
                  )
                }
                onDeleteForMe={(ids) =>
                  activeId &&
                  void hideMessages(activeId, ids).catch(() => push("Could not delete the message."))
                }
                onForward={async (messageIds, conversationIds) => {
                  try {
                    await forwardMessages(messageIds, conversationIds);
                    push(
                      messageIds.length > 1
                        ? `${messageIds.length} messages forwarded`
                        : "Message forwarded",
                    );
                  } catch (error) {
                    push(error instanceof ApiError ? error.message : "Could not forward.");
                  }
                }}
                onCopy={(message) => {
                  void navigator.clipboard?.writeText(message.body ?? "");
                  push("Copied to clipboard");
                }}
                onAccept={() => void handleAccept()}
                onBlock={() => void handleBlock()}
                onReport={(alsoBlock) => void handleReport(alsoBlock)}
                onTogglePin={() => detail && void togglePin(detail.id)}
                onArchive={() => {
                  if (!detail) return;
                  const name = detail.title;
                  void setArchived(detail.id, true).then(() => push(`${name} archived`));
                }}
                onDisappearing={(seconds) => {
                  if (!detail) return;
                  void conversationApi
                    .update(detail.id, { disappearing_seconds: seconds })
                    .then((updated) => useChat.setState({ detail: updated }))
                    .catch(() => push("Could not change disappearing messages."));
                }}
                onSafetyTips={() => openDialog("safety-tips")}
                onWhatsNew={() => openDialog("whats-new")}
              />
            </div>

            {infoOpen && detail && (
              <div className="hidden lg:flex">
                <ConversationInfo
                  conversation={detail}
                  currentUserId={user.id}
                  onClose={() => setInfoOpen(false)}
                />
              </div>
            )}
          </>
        )}

        {/* Calls, Stories and Settings are each a pane pair of their own, the
            way the real app lays them out, rather than one blank placeholder. */}
        {tab === "calls" && <CallsPane contacts={contacts} onComingSoon={comingSoon} />}

        {tab === "stories" && <StoriesPane user={user} onComingSoon={comingSoon} />}

        {tab === "settings" && (
          <SettingsPane
            user={user}
            section={settingsSection}
            onSectionChange={setSettingsSection}
          />
        )}
      </div>

      {socketStatus !== "open" && (
        <div className="pointer-events-none fixed inset-x-0 top-8 z-50 flex justify-center">
          <span className="rounded-full bg-surface-chip px-3 py-1 text-[12px] text-ink shadow-lg">
            {socketStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        </div>
      )}

      <AppDialogs socketStatus={socketStatus} />
    </div>
  );
}
