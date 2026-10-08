/**
 * Presentation helpers.
 *
 * Signal formats time differently in three places, and getting those
 * differences right is a surprising amount of what makes a clone look
 * correct: the list shows a relative day, a bubble shows a clock time, and
 * the divider between days shows a weekday or a date.
 */

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysApart(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/** Clock time inside a bubble, for example 09:14. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Right-hand timestamp on a conversation row. */
export function listTimestamp(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = daysApart(then, now);

  if (days === 0) return clockTime(iso);
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "short" });
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** The divider that separates one day from the next inside a thread. */
export function dayDivider(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = daysApart(then, now);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return then.toLocaleDateString(undefined, { weekday: "long" });
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Whether two messages belong on either side of a date divider. */
export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** The line under a name in the chat header. */
export function presenceLabel(isOnline: boolean, lastSeenIso: string): string {
  if (isOnline) return "Online";

  const then = new Date(lastSeenIso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Last seen yesterday";
  if (days < 7) return `Last seen ${days} days ago`;
  return `Last seen ${then.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/** Up to two initials, the way Signal draws an avatar with no photo. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Signal's twelve avatar swatches, resolved to the CSS variables. */
export function avatarBackground(colorKey: string): string {
  return `var(--${colorKey.toLowerCase()}, var(--a200))`;
}

/** The preview line under a conversation title. */
export function previewText(
  body: string | null,
  type: string,
  isDeleted: boolean,
  senderName: string | null,
  isGroup: boolean,
  isMine: boolean,
): string {
  let text: string;
  if (isDeleted) text = "This message was deleted";
  else if (type === "image") text = "Photo";
  else if (type === "file") text = "File";
  else text = body ?? "";

  if (type === "system") return text;
  if (isMine) return `You: ${text}`;
  if (isGroup && senderName) return `${senderName.split(" ")[0]}: ${text}`;
  return text;
}

/** A disappearing-message timer, rendered the way Signal labels it. */
export function durationLabel(seconds: number): string {
  if (seconds === 0) return "Off";
  const units: [number, string][] = [
    [604800, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [size, suffix] of units) {
    if (seconds % size === 0) return `${seconds / size}${suffix}`;
  }
  return `${seconds}s`;
}
