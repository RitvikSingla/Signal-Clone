/**
 * Every API call the app makes, in one place.
 *
 * Components call these rather than building URLs, so a route change is a
 * one-line edit here instead of a search across the codebase.
 */

import { api } from "./api";
import type {
  Contact,
  ConversationDetail,
  ConversationSummary,
  DemoAccount,
  Message,
  MessagePage,
  MessageSearchHit,
  RequestCodeResponse,
  SafetyNumber,
  TokenResponse,
  UserPrivate,
  UserPublic,
  VerifyResponse,
} from "./types";

export const authApi = {
  requestCode: (phone_number: string) =>
    api.post<RequestCodeResponse>("/auth/request-code", { phone_number }),

  verify: (phone_number: string, code: string) =>
    api.post<VerifyResponse>("/auth/verify", { phone_number, code }),

  register: (payload: {
    display_name: string;
    username?: string | null;
    about?: string | null;
    avatar_color?: string | null;
  }) => api.post<UserPrivate>("/auth/register", payload),

  refresh: () => api.post<TokenResponse>("/auth/refresh"),

  logout: () => api.post<{ detail: string }>("/auth/logout"),

  me: () => api.get<UserPrivate>("/auth/me"),

  demoAccounts: () => api.get<DemoAccount[]>("/auth/demo-accounts"),
};

export const conversationApi = {
  list: (params?: { unreadOnly?: boolean; archived?: boolean; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.set("unread_only", "true");
    if (params?.archived) query.set("archived", "true");
    if (params?.search) query.set("search", params.search);
    const suffix = query.toString() ? `?${query}` : "";
    return api.get<ConversationSummary[]>(`/conversations${suffix}`);
  },

  get: (id: string) => api.get<ConversationDetail>(`/conversations/${id}`),

  createDirect: (peer_id: string) =>
    api.post<ConversationDetail>("/conversations/direct", { peer_id }),

  createGroup: (payload: {
    name: string;
    member_ids: string[];
    description?: string | null;
  }) => api.post<ConversationDetail>("/conversations/group", payload),

  update: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      avatar_color: string;
      disappearing_seconds: number;
    }>,
  ) => api.patch<ConversationDetail>(`/conversations/${id}`, payload),

  setPrefs: (
    id: string,
    payload: Partial<{ is_pinned: boolean; is_archived: boolean; muted_until: string }>,
  ) => api.patch<ConversationSummary>(`/conversations/${id}/prefs`, payload),

  markRead: (id: string, last_message_id: string | null = null) =>
    api.post<{ conversation_id: string; unread_count: number }>(
      `/conversations/${id}/read`,
      { last_message_id },
    ),

  addMembers: (id: string, user_ids: string[]) =>
    api.post<ConversationDetail>(`/conversations/${id}/members`, { user_ids }),

  changeRole: (id: string, memberId: string, role: "admin" | "member") =>
    api.patch<ConversationDetail>(`/conversations/${id}/members/${memberId}`, { role }),

  removeMember: (id: string, memberId: string) =>
    api.delete<ConversationDetail>(`/conversations/${id}/members/${memberId}`),

  leave: (id: string) => api.post<{ detail: string }>(`/conversations/${id}/leave`),
};

export const messageApi = {
  list: (conversationId: string, params?: { before?: string | null; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.before) query.set("before", params.before);
    query.set("limit", String(params?.limit ?? 40));
    return api.get<MessagePage>(`/conversations/${conversationId}/messages?${query}`);
  },

  send: (
    conversationId: string,
    payload: {
      client_id: string;
      body?: string | null;
      reply_to_id?: string | null;
      attachment_ids?: string[];
    },
  ) => api.post<Message>(`/conversations/${conversationId}/messages`, payload),

  edit: (messageId: string, body: string) =>
    api.patch<Message>(`/messages/${messageId}`, { body }),

  remove: (messageId: string) => api.delete<Message>(`/messages/${messageId}`),

  react: (messageId: string, emoji: string) =>
    api.put<Message>(`/messages/${messageId}/reaction`, { emoji }),

  clearReaction: (messageId: string) =>
    api.delete<Message>(`/messages/${messageId}/reaction`),

  search: (q: string) =>
    api.get<MessageSearchHit[]>(`/messages/search?q=${encodeURIComponent(q)}`),
};

export const userApi = {
  updateProfile: (
    payload: Partial<{ display_name: string; about: string; avatar_color: string }>,
  ) => api.patch<UserPrivate>("/users/me", payload),

  search: (q: string) =>
    api.get<UserPublic[]>(`/users/search?q=${encodeURIComponent(q)}`),

  safetyNumber: (userId: string) =>
    api.get<SafetyNumber>(`/users/${userId}/safety-number`),

  contacts: () => api.get<Contact[]>("/contacts"),

  addContact: (payload: { user_id?: string; handle?: string }) =>
    api.post<Contact>("/contacts", payload),

  removeContact: (contactId: string) =>
    api.delete<{ detail: string }>(`/contacts/${contactId}`),
};
