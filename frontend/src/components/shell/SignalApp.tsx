"use client";

/**
 * The application shell.
 *
 * Holds the three panes and the rail, decides what each shows, and owns
 * the keyboard shortcuts. Data lives in the stores; this component is
 * layout and wiring.
 *
 * Responsive rule, matching Signal: above 768px the list and the thread
 * sit side by side. Below it only one is visible, and opening a thread
 * slides the list away.
 */

import { useCallback, useEffect, useState } from "react";

import { ChatPane } from "@/components/chat/ChatPane";
import { ConversationInfo } from "@/components/conversations/ConversationInfo";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { NavRail, type RailTab } from "@/components/shell/NavRail";
import { NewChatModal } from "@/components/shell/NewChatModal";
import { SettingsPane } from "@/components/shell/SettingsPane";
import { PhoneIcon, StoriesIcon } from "@/components/ui/Icons";
import { useToasts } from "@/components/ui/Toasts";
import { useChat } from "@/store/chat";
import type { UserPrivate } from "@/lib/types";

export function SignalApp({ user }: { user: UserPrivate }) {
  const {
    conversations,
    listLoading,
    listError,
    filter,
    search,
    activeId,
    detail,
    threads,
    loadConversations,
    setFilter,
    setSearch,
    openConversation,
    closeConversation,
    loadOlder,
    sendMessage,
    react,
  } = useChat();

  const push = useToasts((state) => state.push);

  const [tab, setTab] = useState<RailTab>("chats");
  const [infoOpen, setInfoOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const thread = activeId ? threads[activeId] : undefined;
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const handleSelect = useCallback(
    (id: string) => {
      setInfoOpen(false);
      void openConversation(id);
    },
    [openConversation],
  );

  const comingSoon = useCallback(
    (feature: string) => push(`${feature} are not part of this build yet.`),
    [push],
  );

  // Keyboard shortcuts. Signal Desktop binds the same two.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setComposeOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setTab("chats");
        document.getElementById("conversation-search")?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (composeOpen) setComposeOpen(false);
        else if (infoOpen) setInfoOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composeOpen, infoOpen]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface">
      {/* On a phone the rail gives up its 68px to the open thread, the way
          Signal hands the whole screen to a conversation. The back button
          in the header returns to the list, where the rail is visible. */}
      <div className={`${activeId && tab === "chats" ? "hidden md:flex" : "flex"}`}>
        <NavRail
          active={tab}
          unreadTotal={unreadTotal}
          user={user}
          onSelect={(next) => {
            setTab(next);
            if (next !== "chats") setInfoOpen(false);
          }}
        />
      </div>

      {tab === "chats" && (
        <>
          {/* The list hides on a phone once a thread is open. */}
          <div className={`${activeId ? "hidden md:flex" : "flex"} min-h-0 w-full md:w-auto`}>
            <ConversationList
              conversations={conversations}
              loading={listLoading}
              error={listError}
              activeId={activeId}
              user={user}
              filter={filter}
              search={search}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onSelect={handleSelect}
              onCompose={() => setComposeOpen(true)}
            />
          </div>

          <div className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1`}>
            <ChatPane
              conversation={detail}
              messages={thread?.messages ?? []}
              loading={thread?.loading ?? false}
              hasMore={thread?.hasMore ?? false}
              currentUserId={user.id}
              onBack={closeConversation}
              onOpenInfo={() => setInfoOpen((open) => !open)}
              onComingSoon={comingSoon}
              onLoadOlder={() => activeId && void loadOlder(activeId)}
              onSend={(body, replyToId) =>
                activeId && void sendMessage(activeId, body, replyToId)
              }
              onReact={(message, emoji) => void react(message.id, emoji)}
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

      {tab === "calls" && (
        <ComingSoon
          title="Calls"
          description="Voice and video calling is a placeholder in this build, as the assignment permits. Messaging, groups and receipts are fully implemented."
          icon={<PhoneIcon size={28} />}
        />
      )}

      {tab === "stories" && (
        <ComingSoon
          title="Stories"
          description="Stories are a placeholder in this build. The conversation and group features are the focus."
          icon={<StoriesIcon size={28} />}
        />
      )}

      {tab === "settings" && <SettingsPane user={user} />}

      {composeOpen && (
        <NewChatModal
          currentUserId={user.id}
          onClose={() => setComposeOpen(false)}
          onOpened={(id) => {
            setComposeOpen(false);
            setTab("chats");
            void loadConversations();
            handleSelect(id);
          }}
        />
      )}
    </div>
  );
}
