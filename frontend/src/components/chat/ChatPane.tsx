"use client";

/**
 * The right-hand pane: header, thread, composer. Also the empty state
 * shown before a conversation is picked.
 */

import { useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { LockIcon } from "@/components/ui/Icons";
import type { ConversationDetail, Message } from "@/lib/types";

type ChatPaneProps = {
  conversation: ConversationDetail | null;
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  onBack: () => void;
  onOpenInfo: () => void;
  onComingSoon: (feature: string) => void;
  onLoadOlder: () => void;
  onSend: (body: string, replyToId: string | null) => void;
  onReact: (message: Message, emoji: string) => void;
};

export function ChatPane({
  conversation,
  messages,
  loading,
  hasMore,
  currentUserId,
  onBack,
  onOpenInfo,
  onComingSoon,
  onLoadOlder,
  onSend,
  onReact,
}: ChatPaneProps) {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  if (!conversation) return <EmptyPane />;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onOpenInfo={onOpenInfo}
        onComingSoon={onComingSoon}
      />

      {loading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-ink-3">
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
          onLoadOlder={onLoadOlder}
          onReply={setReplyingTo}
          onReact={onReact}
        />
      )}

      <Composer
        key={conversation.id}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSend={onSend}
        onTyping={() => {
          /* Typing indicators arrive with the socket in the next phase. */
        }}
      />
    </section>
  );
}

function EmptyPane() {
  return (
    <section className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-surface px-6 text-center md:flex">
      <div className="flex size-16 items-center justify-center rounded-full bg-ultramarine-soft text-ultramarine">
        <LockIcon size={28} />
      </div>
      <div className="max-w-sm">
        <h2 className="text-[17px] font-semibold text-ink">Signal</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          Select a chat to start messaging. Your conversations are end-to-end
          encrypted.
        </p>
      </div>
    </section>
  );
}
