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
import { conversationApi, messageApi, userApi } from "@/lib/endpoints";
import type {
  Attachment,
  Contact,
  ConversationDetail,
  ConversationSummary,
  Message,
} from "@/lib/types";

type ThreadState = {
  messages: Message[];
  hasMore: boolean;
  nextBefore: string | null;
  loading: boolean;
  /**
   * The first message that was unread when the thread was opened. The
   * "N Unread Messages" divider sits above it until the thread is left.
   */
  unreadFromId?: string | null;
  unreadCount?: number;
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

  /**
   * markRead is false for a pending message request: Signal does not tell
   * the sender anything was read until the request is accepted.
   */
  openConversation: (
    id: string,
    options?: { markRead?: boolean; currentUserId?: string },
  ) => Promise<void>;
  markConversationRead: (id: string) => Promise<void>;
  clearReaction: (messageId: string) => Promise<void>;
  closeConversation: () => void;
  loadOlder: (id: string) => Promise<void>;
  /** Page older history until messageId is loaded. True when found. */
  loadUntil: (id: string, messageId: string) => Promise<boolean>;

  sendMessage: (
    id: string,
    body: string,
    replyToId?: string | null,
    attachments?: Attachment[],
  ) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  /** Delete for me: gone from this person's copy of the thread only. */
  hideMessages: (conversationId: string, messageIds: string[]) => Promise<void>;
  forwardMessages: (messageIds: string[], conversationIds: string[]) => Promise<void>;

  /** Conversation id -> live pinned messages, newest first. */
  pins: Record<string, Message[]>;
  loadPins: (conversationId: string) => Promise<void>;
  pinMessage: (messageId: string, durationSeconds: number | null) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  togglePin: (id: string) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;

  // --- address book, message requests, archive ---------------------------

  contacts: Contact[];
  /** Group id -> member user ids, for "Member of ..." on a contact's hero. */
  groupMembers: Record<string, string[]>;
  archived: ConversationSummary[];
  loadContacts: () => Promise<void>;
  loadGroupMembers: () => Promise<void>;
  loadArchived: () => Promise<void>;
  /** Accepting a request is adding the sender to the address book. */
  acceptRequest: (peerId: string) => Promise<void>;
  /** Blocking files the sender as a blocked contact and archives the chat. */
  blockPeer: (conversationId: string, peerId: string) => Promise<void>;

  /** Applied when a message arrives from somewhere other than this tab. */
  upsertMessage: (message: Message) => void;

  // --- live state, driven by the socket ---------------------------------

  /** Conversation id -> the people currently typing in it. */
  typing: Record<string, { userId: string; displayName: string }[]>;
  /** Ids of messages this tab has seen but not yet acknowledged. */
  pendingDelivery: string[];

  setTyping: (
    conversationId: string,
    userId: string,
    displayName: string,
    isTyping: boolean,
  ) => void;
  applyStatus: (conversationId: string, messageId: string, status: Message["status"]) => void;
  applyPresence: (userId: string, isOnline: boolean, lastSeenAt: string) => void;
  applyConversation: (summary: ConversationSummary) => void;
  /** Disappearing messages that expired: drop them everywhere. */
  removeMessages: (conversationId: string, messageIds: string[]) => void;
  /** Replace the open thread's detail after a settings change. */
  setDetail: (detail: ConversationDetail) => void;
  refreshDetail: (conversationId: string) => Promise<void>;
  takePendingDelivery: () => string[];
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
  typing: {},
  pendingDelivery: [],
  contacts: [],
  groupMembers: {},
  archived: [],
  pins: {},

  loadConversations: async () => {
    set({ listLoading: true, listError: null });
    try {
      const rows = await conversationApi.list();
      set({ conversations: sortConversations(rows), listLoading: false });
    } catch (error) {
      set({
        listLoading: false,
        listError: error instanceof ApiError ? error.message : "Could not load conversations.",
      });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),

  openConversation: async (id, options) => {
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
    void get().loadPins(id);

    // Guard against a slow response for a thread the user has since left.
    if (get().activeId !== id) return;

    // Where the unread divider goes: count back over other people's
    // messages from the end, as many as the badge said were unread.
    const unread = get().conversations.find((c) => c.id === id)?.unread_count ?? 0;
    const me = options?.currentUserId;
    let unreadFromId: string | null = null;
    let left = unread;
    for (let i = page.messages.length - 1; i >= 0 && left > 0; i -= 1) {
      const m = page.messages[i];
      if (m.type === "system" || !m.sender || m.sender.id === me) continue;
      left -= 1;
      unreadFromId = m.id;
    }

    set((state) => ({
      detail,
      threads: {
        ...state.threads,
        [id]: {
          messages: page.messages,
          hasMore: page.has_more,
          nextBefore: page.next_before,
          loading: false,
          unreadFromId,
          unreadCount: unread,
        },
      },
    }));

    // Opening a thread clears its badge, both locally and on the server.
    if (options?.markRead !== false) await get().markConversationRead(id);
  },

  markConversationRead: async (id) => {
    const last = get().threads[id]?.messages.at(-1);
    if (!last || last.id.startsWith("pending-")) return;
    await conversationApi.markRead(id, last.id);
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
    }));
  },

  clearReaction: async (messageId) => {
    const updated = await messageApi.clearReaction(messageId);
    get().upsertMessage(updated);
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

  loadUntil: async (id, messageId) => {
    for (let page = 0; page < 25; page += 1) {
      const thread = get().threads[id];
      if (!thread) return false;
      if (thread.messages.some((m) => m.id === messageId)) return true;
      if (!thread.hasMore) return false;
      await get().loadOlder(id);
    }
    return false;
  },

  sendMessage: async (id, body, replyToId = null, attachments = []) => {
    const text = body.trim();
    if (!text && attachments.length === 0) return;

    const clientId = crypto.randomUUID();
    const me = get().detail?.members.find(() => true);

    // Optimistic bubble, keyed by client_id so the server response replaces
    // it rather than appending a duplicate.
    const optimistic: Message = {
      id: `pending-${clientId}`,
      conversation_id: id,
      sender: me ? me.user : null,
      type: attachments.length
        ? attachments.every((a) => a.content_type.startsWith("image/"))
          ? "image"
          : "file"
        : "text",
      body: text || null,
      envelope_hash: "",
      status: "sending",
      client_id: clientId,
      reply_to: replyQuote(get().threads[id]?.messages ?? [], replyToId),
      reactions: [],
      attachments,
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
        body: text || null,
        reply_to_id: replyToId,
        attachment_ids: attachments.map((a) => a.id),
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

  editMessage: async (messageId, body) => {
    const updated = await messageApi.edit(messageId, body.trim());
    get().upsertMessage(updated);
  },

  hideMessages: async (conversationId, messageIds) => {
    await Promise.all(messageIds.map((mid) => messageApi.hide(mid)));
    set((state) => {
      const thread = state.threads[conversationId];
      if (!thread) return {};
      return {
        threads: {
          ...state.threads,
          [conversationId]: {
            ...thread,
            messages: thread.messages.filter((m) => !messageIds.includes(m.id)),
          },
        },
        pins: {
          ...state.pins,
          [conversationId]: (state.pins[conversationId] ?? []).filter(
            (m) => !messageIds.includes(m.id),
          ),
        },
      };
    });
  },

  forwardMessages: async (messageIds, conversationIds) => {
    const created = await messageApi.forward(messageIds, conversationIds);
    for (const message of created) get().upsertMessage(message);
  },

  loadPins: async (conversationId) => {
    try {
      const rows = await messageApi.pins(conversationId);
      set((state) => ({ pins: { ...state.pins, [conversationId]: rows } }));
    } catch {
      // The banner is optional; the thread still works without it.
    }
  },

  pinMessage: async (messageId, durationSeconds) => {
    const updated = await messageApi.pin(messageId, durationSeconds);
    get().upsertMessage(updated);
    // Pinning may have pushed out the oldest of three, so resync.
    await get().loadPins(updated.conversation_id);
  },

  unpinMessage: async (messageId) => {
    const updated = await messageApi.unpin(messageId);
    get().upsertMessage(updated);
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
      conversations: sortConversations(state.conversations.map((c) => (c.id === id ? updated : c))),
    }));
  },

  setArchived: async (id, archived) => {
    const updated = await conversationApi.setPrefs(id, { is_archived: archived });
    set((state) => {
      const rest = state.conversations.filter((c) => c.id !== id);
      const restArchived = state.archived.filter((c) => c.id !== id);
      return archived
        ? {
            conversations: rest,
            archived: sortConversations([...restArchived, updated]),
            activeId: state.activeId === id ? null : state.activeId,
            detail: state.activeId === id ? null : state.detail,
          }
        : {
            conversations: sortConversations([...rest, updated]),
            archived: restArchived,
          };
    });
  },

  loadContacts: async () => {
    try {
      set({ contacts: await userApi.contacts() });
    } catch {
      // The list still works without the address book; requests just will
      // not be told apart until the next load.
    }
  },

  loadGroupMembers: async () => {
    const groups = get().conversations.filter((c) => c.type === "group");
    const details = await Promise.allSettled(groups.map((g) => conversationApi.get(g.id)));
    const map: Record<string, string[]> = {};
    details.forEach((result) => {
      if (result.status === "fulfilled") {
        map[result.value.id] = result.value.members
          .filter((m) => m.is_active)
          .map((m) => m.user.id);
      }
    });
    set({ groupMembers: map });
  },

  loadArchived: async () => {
    try {
      const rows = await conversationApi.list({ archived: true });
      set({ archived: sortConversations(rows.filter((c) => c.is_archived)) });
    } catch {
      set({ archived: [] });
    }
  },

  acceptRequest: async (peerId) => {
    try {
      const contact = await userApi.addContact({ user_id: peerId });
      set((state) => ({
        contacts: [...state.contacts.filter((c) => c.user.id !== peerId), contact],
      }));
    } catch (error) {
      // Already in the address book from another tab: just resync.
      if (error instanceof ApiError && error.status === 409) await get().loadContacts();
      else throw error;
    }
  },

  blockPeer: async (conversationId, peerId) => {
    const existing = get().contacts.find((c) => c.user.id === peerId);
    const contact = existing ?? (await userApi.addContact({ user_id: peerId }));
    const blocked = await userApi.updateContact(contact.id, { is_blocked: true });
    set((state) => ({
      contacts: [...state.contacts.filter((c) => c.user.id !== peerId), blocked],
    }));
    await get().setArchived(conversationId, true);
  },

  upsertMessage: (message) => {
    // Someone who just sent a message is no longer typing.
    if (message.sender) {
      get().setTyping(
        message.conversation_id,
        message.sender.id,
        message.sender.display_name,
        false,
      );
    }

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
          // A reaction or pin on an older message must not replace the
          // preview; only the newest message (or an update to it) does.
          c.id === message.conversation_id &&
          (c.last_message?.id === message.id ||
            c.last_message?.id === `pending-${message.client_id}` ||
            message.created_at >= c.last_activity_at)
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
                  event: message.event ?? null,
                  attachment_kind: previewKind(message),
                  created_at: message.created_at,
                },
              }
            : c,
        ),
      );

      // Keep the pinned banner in step with pin and unpin frames.
      const currentPins = state.pins[message.conversation_id] ?? [];
      const withoutThis = currentPins.filter((m) => m.id !== message.id);
      const pins =
        message.pinned_at && !message.deleted_at
          ? [message, ...withoutThis].sort((a, b) =>
              (b.pinned_at ?? "").localeCompare(a.pinned_at ?? ""),
            )
          : withoutThis;

      return {
        conversations,
        pins: { ...state.pins, [message.conversation_id]: pins },
        threads: { ...state.threads, [message.conversation_id]: { ...thread, messages } },
        // Anything that arrived from someone else and is not already in the
        // thread needs a delivery acknowledgement sent back over the socket.
        pendingDelivery:
          index >= 0 || !message.sender
            ? state.pendingDelivery
            : [...state.pendingDelivery, message.id],
      };
    });
  },

  setTyping: (conversationId, userId, displayName, isTyping) => {
    set((state) => {
      const current = state.typing[conversationId] ?? [];
      const without = current.filter((entry) => entry.userId !== userId);
      const next = isTyping ? [...without, { userId, displayName }] : without;
      return { typing: { ...state.typing, [conversationId]: next } };
    });
  },

  applyStatus: (conversationId, messageId, status) => {
    set((state) => {
      const thread = state.threads[conversationId];
      if (!thread) return {};
      return {
        threads: {
          ...state.threads,
          [conversationId]: {
            ...thread,
            messages: thread.messages.map((m) => (m.id === messageId ? { ...m, status } : m)),
          },
        },
      };
    });
  },

  applyPresence: (userId, isOnline, lastSeenAt) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.peer?.id === userId
          ? { ...c, peer: { ...c.peer, is_online: isOnline, last_seen_at: lastSeenAt } }
          : c,
      ),
      detail:
        state.detail?.peer?.id === userId
          ? {
              ...state.detail,
              peer: {
                ...state.detail.peer,
                is_online: isOnline,
                last_seen_at: lastSeenAt,
              },
            }
          : state.detail,
    }));
  },

  removeMessages: (conversationId, messageIds) => {
    set((state) => {
      const thread = state.threads[conversationId];
      return {
        threads: thread
          ? {
              ...state.threads,
              [conversationId]: {
                ...thread,
                messages: thread.messages.filter((m) => !messageIds.includes(m.id)),
              },
            }
          : state.threads,
        pins: {
          ...state.pins,
          [conversationId]: (state.pins[conversationId] ?? []).filter(
            (m) => !messageIds.includes(m.id),
          ),
        },
      };
    });
  },

  setDetail: (detail) => {
    set((state) => ({
      detail: state.activeId === detail.id ? detail : state.detail,
      conversations: sortConversations(
        state.conversations.map((c) =>
          c.id === detail.id ? { ...c, ...summaryOf(detail), last_message: c.last_message } : c,
        ),
      ),
    }));
  },

  refreshDetail: async (conversationId) => {
    try {
      const detail = await conversationApi.get(conversationId);
      get().setDetail(detail);
    } catch {
      // Removed from the group, or it no longer exists: keep what we have.
    }
  },

  applyConversation: (summary) => {
    // Membership and settings live on the detail, which the summary frame
    // does not carry, so the open thread refetches it.
    if (get().activeId === summary.id) void get().refreshDetail(summary.id);
    set((state) => {
      const known = state.conversations.some((c) => c.id === summary.id);
      const next = known
        ? state.conversations.map((c) => (c.id === summary.id ? summary : c))
        : [...state.conversations, summary];
      return { conversations: sortConversations(next) };
    });
  },

  takePendingDelivery: () => {
    const ids = get().pendingDelivery;
    if (ids.length) set({ pendingDelivery: [] });
    return ids;
  },
}));

/** The quoted strip for an optimistic reply, built from the loaded thread. */
function replyQuote(messages: Message[], replyToId: string | null): Message["reply_to"] {
  if (!replyToId) return null;
  const target = messages.find((m) => m.id === replyToId);
  if (!target) return null;
  return {
    id: target.id,
    sender_name: target.sender?.display_name ?? null,
    body: target.body,
    type: target.type,
    is_deleted: target.deleted_at !== null,
  };
}

/** Mirrors the server's attachment_kind for previews built client-side. */
function previewKind(message: Message): "sticker" | "voice" | null {
  const first = message.attachments[0];
  if (!first) return null;
  if (first.content_type.startsWith("image/") && first.file_name.startsWith("sticker-")) {
    return "sticker";
  }
  if (first.content_type.startsWith("audio/")) return "voice";
  return null;
}

/** The summary fields of a detail, for keeping the list row in step. */
function summaryOf(detail: ConversationDetail): Partial<ConversationSummary> {
  const {
    members: _members,
    description: _description,
    created_by: _createdBy,
    permissions: _permissions,
    group_link: _groupLink,
    join_requests: _joinRequests,
    ...summary
  } = detail;
  void _members;
  void _description;
  void _createdBy;
  void _permissions;
  void _groupLink;
  void _joinRequests;
  return summary;
}
