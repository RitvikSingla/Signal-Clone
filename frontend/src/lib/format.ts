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

/** Clock time inside a bubble, as Signal writes it: "9:00 am". */
export function clockTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace("AM", "am")
    .replace("PM", "pm");
}

/** "Today 10:15 am", "Yesterday 9:02 pm" or "3 Oct 9:02 pm", for Info. */
export function fullTimestamp(iso: string): string {
  return `${dayDivider(iso)} ${clockTime(iso)}`;
}

/** 1.2 MB, 340 KB: the size line on a file card. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Right-hand timestamp on a conversation row. */
export function listTimestamp(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = daysApart(then, now);

  if (days === 0) return bubbleTime(iso, now.getTime());
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

/**
 * Signal Desktop draws an initials avatar as a pale tint with the initials
 * in the saturated version of the same hue, in both themes. These are its
 * twelve pairs, keyed by the same A100..A210 ids the backend assigns.
 */
const AVATAR_PAIRS: Record<string, { bg: string; fg: string }> = {
  A100: { bg: "#e3e3fe", fg: "#3838f5" },
  A110: { bg: "#dde7fc", fg: "#1251d3" },
  A120: { bg: "#d8e8f0", fg: "#086da0" },
  A130: { bg: "#cde4cd", fg: "#067906" },
  A140: { bg: "#eae0fd", fg: "#661aff" },
  A150: { bg: "#f5e3fe", fg: "#9f00f0" },
  A160: { bg: "#f6d8ec", fg: "#b8057c" },
  A170: { bg: "#f5d7d7", fg: "#be0404" },
  A180: { bg: "#fef5d0", fg: "#836b01" },
  A190: { bg: "#eae6d5", fg: "#7d6f40" },
  A200: { bg: "#d2d2dc", fg: "#4f4f6d" },
  A210: { bg: "#d7d7d9", fg: "#5c5c5c" },
};

export function avatarColors(colorKey: string): { bg: string; fg: string } {
  return AVATAR_PAIRS[colorKey.toUpperCase()] ?? AVATAR_PAIRS.A200;
}

/**
 * The timestamp inside a bubble. Signal counts recent messages in minutes
 * ("Now", "11m") and switches to the clock after an hour.
 */
export function bubbleTime(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  return clockTime(iso);
}

/** The preview line under a conversation title. */
export function previewText(
  body: string | null,
  type: string,
  isDeleted: boolean,
  senderName: string | null,
  isGroup: boolean,
  isMine: boolean,
  event?: string | null,
): string {
  if (type === "system" && event === "pinned") {
    const who = isMine ? "You" : (senderName?.split(" ")[0] ?? "Someone");
    return `📌 ${who} pinned a message`;
  }

  let text: string;
  if (isDeleted) text = "This message was deleted";
  else if (type === "image") text = body ? `📷 ${body}` : "📷 Photo";
  else if (type === "file") text = body ? `📎 ${body}` : "📎 File";
  else text = body ?? "";

  if (type === "system") return text;
  // Signal Desktop does not prefix your own messages with "You:".
  if (isGroup && senderName && !isMine) return `${senderName.split(" ")[0]}: ${text}`;
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
