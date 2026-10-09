/**
 * Group and disappearing-message vocabulary shared by several screens.
 */

import type { ConversationDetail, Message, UserPublic } from "./types";

/** Signal's timer choices, in its order. Seconds; 0 is Off. */
export const TIMER_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "Off" },
  { seconds: 2_419_200, label: "4 weeks" },
  { seconds: 604_800, label: "1 week" },
  { seconds: 86_400, label: "1 day" },
  { seconds: 28_800, label: "8 hours" },
  { seconds: 3_600, label: "1 hour" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 30, label: "30 seconds" },
];

/** "1 hour", "45 minutes", "2 weeks" for any number of seconds. */
export function timerLabel(seconds: number): string {
  if (seconds === 0) return "Off";
  const preset = TIMER_OPTIONS.find((o) => o.seconds === seconds);
  if (preset) return preset.label;
  const units: [number, string][] = [
    [604_800, "week"],
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  for (const [size, unit] of units) {
    if (seconds % size === 0) {
      const count = seconds / size;
      return `${count} ${unit}${count === 1 ? "" : "s"}`;
    }
  }
  return `${seconds} seconds`;
}

/** Signal's chat colour swatches: solids, then gradients. */
export const CHAT_COLORS: string[] = [
  "#2c6bed",
  "#e5546b",
  "#e8763b",
  "#b5a782",
  "#3fa14b",
  "#2a9d73",
  "#2c9b9b",
  "#4a8ab8",
  "#7a6ad6",
  "#d873e0",
  "#e3609b",
  "#d79c95",
  "#a8a8a8",
  "linear-gradient(135deg,#f7a33a,#e5546b)",
  "linear-gradient(135deg,#9da4b1,#5d6676)",
  "linear-gradient(135deg,#e05fbd,#f6ad55)",
  "linear-gradient(135deg,#1f7a6b,#3e9e8a)",
  "linear-gradient(135deg,#7a5fc4,#c35fd0)",
  "linear-gradient(135deg,#1db954,#3fd18a)",
  "linear-gradient(135deg,#f5b5cf,#9db8f3)",
  "linear-gradient(135deg,#1fb6d6,#5ad0ea)",
  "linear-gradient(135deg,#f06e4b,#f4a161)",
];

export const DEFAULT_CHAT_COLOR = CHAT_COLORS[0];

/**
 * The text of a group update for this reader. New updates store the actor
 * as sender and the predicate as body ("created the group."); older seeded
 * ones are full sentences with no sender.
 */
export function systemText(
  message: Message,
  currentUserId: string,
): { actor: string | null; text: string } {
  const body = message.body ?? "";
  if (!message.sender || message.event === "pinned") return { actor: null, text: body };
  const actor = message.sender.id === currentUserId ? "You" : message.sender.display_name;
  return { actor, text: `${actor} ${body}` };
}

/** "Aarav and you", "Aarav, Priya and you", "Aarav, Priya and 3 others". */
export function membersLine(detail: ConversationDetail, currentUserId: string): string {
  const others = detail.members
    .filter((m) => m.is_active && m.user.id !== currentUserId)
    .map((m) => m.user.display_name);
  if (others.length === 0) return "Only you";
  if (others.length === 1) return `${others[0]} and you`;
  if (others.length === 2) return `${others[0]}, ${others[1]} and you`;
  return `${others[0]}, ${others[1]} and ${others.length - 1} others`;
}

export function isAdmin(detail: ConversationDetail, userId: string): boolean {
  return detail.members.some((m) => m.user.id === userId && m.is_active && m.role === "admin");
}

/** Whether the four permissions let this person do something. */
export function allowed(
  detail: ConversationDetail,
  userId: string,
  permission: "add_members" | "edit_info" | "send_messages" | "member_labels",
): boolean {
  if (detail.type !== "group") return true;
  if (detail.ended_at) return false;
  const setting = detail.permissions?.[permission] ?? "all";
  return setting === "all" || isAdmin(detail, userId);
}

export function labelOf(detail: ConversationDetail, user: UserPublic | null): string | null {
  if (!user) return null;
  return detail.members.find((m) => m.user.id === user.id)?.label ?? null;
}

/** The group link as people share it: this app's address with a join token. */
export function groupLinkUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/?join=${token}`;
}
