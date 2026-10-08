"use client";

/**
 * The right-hand pane: header, thread, composer. Also the empty state
 * shown before a conversation is picked.
 */

import { useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { SignalMark } from "@/components/ui/Icons";
import type { ConversationDetail, Message } from "@/lib/types";

type ChatPaneProps = {
  conversation: ConversationDetail | null;
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  currentUserId: string;
  typingPeople: { userId: string; displayName: string }[];
  onTyping: (isTyping: boolean) => void;
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
  typingPeople,
  onTyping,
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
          typingPeople={typingPeople}
          onLoadOlder={onLoadOlder}
          onReply={setReplyingTo}
          onReact={onReact}
        />
      )}

      <Composer
        key={conversation.id}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSend={(body, replyToId) => {
          onTyping(false);
          onSend(body, replyToId);
        }}
        onTyping={onTyping}
      />
    </section>
  );
}

/**
 * Signal's welcome pane: the mark, a greeting, the what's-new link, and the
 * nonprofit line anchored to the bottom of the pane.
 */
function EmptyPane() {
  return (
    <section className="relative hidden min-w-0 flex-1 flex-col items-center justify-center bg-surface px-6 text-center md:flex">
      <SignalMark size={104} className="text-ink" />
      <h2 className="mt-6 text-[19px] font-bold tracking-tight text-ink">
        Welcome to Signal
      </h2>
      <p className="mt-1 text-[14px] text-ink-2">
        See{" "}
        <a
          href="https://signal.org/blog/"
          target="_blank"
          rel="noreferrer"
          className="text-ultramarine hover:underline"
        >
          what&rsquo;s new
        </a>{" "}
        in this update
      </p>
      <p className="absolute bottom-6 text-[13px] text-ink-2">
        Signal is a 501c3 nonprofit
      </p>
    </section>
  );
}
