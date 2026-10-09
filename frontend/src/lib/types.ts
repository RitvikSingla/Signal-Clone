/**
 * API types, mirroring the Pydantic schemas on the backend.
 *
 * Hand-written for now. Phase 12 generates these from the OpenAPI document
 * so the two sides cannot drift.
 */

export type ConversationType = "direct" | "group";
export type MemberRole = "admin" | "member";
export type MessageType = "text" | "image" | "file" | "system";
export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export type UserPublic = {
  id: string;
  display_name: string;
  username: string | null;
  phone_number: string;
  about: string | null;
  avatar_url: string | null;
  avatar_color: string;
  is_online: boolean;
  last_seen_at: string;
};

export type UserPrivate = UserPublic & {
  identity_key: string;
  registration_id: number;
  created_at: string;
};

export type MessagePreview = {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  type: MessageType;
  body: string | null;
  status: MessageStatus;
  is_deleted: boolean;
  event?: string | null;
  attachment_kind?: "sticker" | "voice" | null;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  title: string;
  avatar_url: string | null;
  avatar_color: string;
  peer: UserPublic | null;
  last_message: MessagePreview | null;
  unread_count: number;
  member_count: number;
  my_role: MemberRole;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  disappearing_seconds: number;
  ended_at?: string | null;
  /** False when the caller has left, the group ended, or only admins send. */
  can_send?: boolean;
  last_activity_at: string;
};

export type Member = {
  user: UserPublic;
  role: MemberRole;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
  label?: string | null;
};

export type Permission = "all" | "admins";

export type GroupPermissions = {
  add_members: Permission;
  edit_info: Permission;
  send_messages: Permission;
  member_labels: Permission;
};

export type GroupLink = {
  enabled: boolean;
  requires_approval: boolean;
  /** Admins only. */
  token: string | null;
};

export type JoinRequest = { user: UserPublic; created_at: string };

export type JoinPreview = {
  conversation_id: string;
  title: string;
  avatar_url: string | null;
  avatar_color: string;
  member_count: number;
  description: string | null;
  requires_approval: boolean;
  status: "member" | "requested" | "none";
};

export type ConversationDetail = ConversationSummary & {
  description: string | null;
  created_by: string | null;
  members: Member[];
  permissions?: GroupPermissions | null;
  group_link?: GroupLink | null;
  join_requests?: JoinRequest[];
};

export type Reaction = {
  emoji: string;
  user_id: string;
  display_name: string;
};

export type Attachment = {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  url: string;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
};

export type QuotedMessage = {
  id: string;
  sender_name: string | null;
  body: string | null;
  type: MessageType;
  is_deleted: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender: UserPublic | null;
  type: MessageType;
  body: string | null;
  envelope_hash: string;
  status: MessageStatus;
  client_id: string;
  reply_to: QuotedMessage | null;
  reactions: Reaction[];
  attachments: Attachment[];
  edited_at: string | null;
  deleted_at: string | null;
  expires_at: string | null;
  is_forwarded?: boolean;
  /** Set on system rows: "pinned" means reply_to is the pinned message. */
  event?: string | null;
  /** Present only while the pin is live. */
  pinned_at?: string | null;
  pin_expires_at?: string | null;
  pinned_by?: string | null;
  created_at: string;
};

export type Receipt = {
  user: UserPublic;
  delivered_at: string | null;
  read_at: string | null;
};

export type MessageInfo = {
  message: Message;
  receipts: Receipt[];
};

export type MessagePage = {
  messages: Message[];
  next_before: string | null;
  has_more: boolean;
};

export type MessageSearchHit = {
  message_id: string;
  conversation_id: string;
  conversation_title: string;
  sender_id?: string | null;
  sender_name: string | null;
  body: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  user: UserPublic;
  nickname: string | null;
  is_blocked: boolean;
};

export type DemoAccount = {
  phone_number: string;
  display_name: string;
  avatar_color: string;
};

export type RequestCodeResponse = {
  phone_number: string;
  expires_in_seconds: number;
  debug_code: string | null;
};

export type VerifyResponse = {
  access_token: string;
  token_type: string;
  is_registered: boolean;
  user: UserPrivate | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type SafetyNumber = {
  peer: UserPublic;
  safety_number: string;
  is_verified: boolean;
};

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
  environment: string;
};
