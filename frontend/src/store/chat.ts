"use client";

/**
 * Conversation and thread state.
 *
 * One store for the list and the open thread, because the two are coupled:
 * sending a message reorders the list, and opening a thread clears its
 * badge. Keeping them apart would mean synchronising two sources of truth.
 *
 * Messages are held per conversation so switching threads and switching
 * back does not refetch what is already loaded.
 */

import { create } from "zustand";

import { ApiError } from "@/lib/api";
import { conversationApi, messageApi } from "@/lib/endpoints";
import type {
  ConversationDetail,
  ConversationSummary,
  Message,
} from "@/lib/types";

type ThreadState = {
  messages: Message[];
  hasMore: boolean;
  nextBefore: string | null;
  loading: boolean;
};

type ListFilter = "all" | "unread";

type ChatState = {
  conversations: ConversationSummary[];
  listLoading: boolean;
  listError: string | null;
  filter: ListFilter;
  search: string;

  activeId: string | null;
  detail: ConversationDetail | null;
  threads: Record<string, ThreadState>;

  loadConversations: () => Promise<void>;
  setFilter: (filter: ListFilter) => void;
  setSearch: (search: string) => void;

  openConversation: (id: string) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (id: string) => Promise<void>;

  sendMessage: (id: string, body: string, replyToId?: string | null) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  togglePin: (id: string) => Promise<void>;

  /** Applied when a message arrives from somewhere other than this tab. */
  upsertMessage: (message: Message) => void;
};

const emptyThread: ThreadState = {
  messages: [],
  hasMore: false,
  nextBefore: null,
  loading: false,
};

function sortConversations(rows: ConversationSummary[]): ConversationSummary[] {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.last_activity_at.localeCompare(a.last_activity_at);
  });
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  listLoading: true,
  listError: null,
  filter: "all",
  search: "",

  activeId: null,
  detail: null,
  threads: {},

  loadConversations: async () => {
    set({ listLoading: true, listError: null });
    try {
      const rows = await conversationApi.list();
      set({ conversations: sortConversations(rows), listLoading: false });
    } catch (error) {
      set({
        listLoading: false,
        listError:
          error instanceof ApiError ? error.message : "Could not load conversations.",
      });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),

  openConversation: async (id) => {
    set({ activeId: id, detail: null });

    const existing = get().threads[id];
    if (!existing) {
      set((state) => ({
        threads: { ...state.threads, [id]: { ...emptyThread, loading: true } },
      }));
    }

    const [detail, page] = await Promise.all([
      conversationApi.get(id),
      messageApi.list(id, { limit: 40 }),
    ]);

    // Guard against a slow response for a thread the user has since left.
    if (get().activeId !== id) return;

    set((state) => ({
      detail,
      threads: {
        ...state.threads,
        [id]: {
          messages: page.messages,
          hasMore: page.has_more,
          nextBefore: page.next_before,
          loading: false,
        },
      },
    }));

    // Opening a thread clears its badge, both locally and on the server.
    const last = page.messages.at(-1);
    if (last) {
      await conversationApi.markRead(id, last.id);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unread_count: 0 } : c,
        ),
      }));
    }
  },

  closeConversation: () => set({ activeId: null, detail: null }),

  loadOlder: async (id) => {
    const thread = get().threads[id];
    if (!thread || !thread.hasMore || thread.loading || !thread.nextBefore) return;

    set((state) => ({
      threads: { ...state.threads, [id]: { ...thread, loading: true } },
    }));

    const page = await messageApi.list(id, { before: thread.nextBefore, limit: 40 });

    set((state) => {
      const current = state.threads[id] ?? emptyThread;
      return {
        threads: {
          ...state.threads,
          [id]: {
            messages: [...page.messages, ...current.messages],
            hasMore: page.has_more,
            nextBefore: page.next_before,
            loading: false,
          },
        },
      };
    });
  },

  sendMessage: async (id, body, replyToId = null) => {
    const text = body.trim();
    if (!text) return;

    const clientId = crypto.randomUUID();
    const me = get().detail?.members.find(() => true);

    // Optimistic bubble, keyed by client_id so the server response replaces
    // it rather than appending a duplicate.
    const optimistic: Message = {
      id: `pending-${clientId}`,
      conversation_id: id,
      sender: me ? me.user : null,
      type: "text",
      body: text,
      envelope_hash: "",
      status: "sending",
      client_id: clientId,
      reply_to: null,
      reactions: [],
      attachments: [],
      edited_at: null,
      deleted_at: null,
      expires_at: null,
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const thread = state.threads[id] ?? emptyThread;
      return {
        threads: {
          ...state.threads,
          [id]: { ...thread, messages: [...thread.messages, optimistic] },
        },
      };
    });

    try {
      const saved = await messageApi.send(id, {
        client_id: clientId,
        body: text,
        reply_to_id: replyToId,
      });
      get().upsertMessage(saved);
    } catch {
      // Leave the bubble in place but mark it so the user can retry rather
      // than losing what they typed.
      set((state) => {
        const thread = state.threads[id] ?? emptyThread;
        return {
          threads: {
            ...state.threads,
            [id]: {
              ...thread,
              messages: thread.messages.map((m) =>
                m.client_id === clientId ? { ...m, status: "sending" as const } : m,
              ),
            },
          },
        };
      });
    }
  },

  react: async (messageId, emoji) => {
    const updated = await messageApi.react(messageId, emoji);
    get().upsertMessage(updated);
  },

  deleteMessage: async (messageId) => {
    const updated = await messageApi.remove(messageId);
    get().upsertMessage(updated);
  },

  togglePin: async (id) => {
    const current = get().conversations.find((c) => c.id === id);
    if (!current) return;
    const updated = await conversationApi.setPrefs(id, { is_pinned: !current.is_pinned });
    set((state) => ({
      conversations: sortConversations(
        state.conversations.map((c) => (c.id === id ? updated : c)),
      ),
    }));
  },

  upsertMessage: (message) => {
    set((state) => {
      const thread = state.threads[message.conversation_id] ?? emptyThread;

      const index = thread.messages.findIndex(
        (m) => m.id === message.id || m.client_id === message.client_id,
      );
      const messages =
        index >= 0
          ? thread.messages.map((m, i) => (i === index ? message : m))
          : [...thread.messages, message];

      const conversations = sortConversations(
        state.conversations.map((c) =>
          c.id === message.conversation_id
            ? {
                ...c,
                last_activity_at: message.created_at,
                last_message: {
                  id: message.id,
                  sender_id: message.sender?.id ?? null,
                  sender_name: message.sender?.display_name ?? null,
                  type: message.type,
                  body: message.body,
                  status: message.status,
                  is_deleted: message.deleted_at !== null,
                  created_at: message.created_at,
                },
              }
            : c,
        ),
      );

      return {
        conversations,
        threads: { ...state.threads, [message.conversation_id]: { ...thread, messages } },
      };
    });
  },
}));
