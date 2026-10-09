"use client";

/**
 * Avatar with Signal's initials fallback.
 *
 * Most accounts have no photo, so the fallback is the common case rather
 * than the edge case: initials on the account's assigned swatch, which is
 * stable per person and is what makes a list of names scannable. Signal
 * draws that swatch as a pale tint with the initials in the strong colour.
 */

import { avatarColors, initials } from "@/lib/format";

type AvatarProps = {
  name: string;
  colorKey: string;
  url?: string | null;
  size?: number;
  /** Draws the green presence dot, used in the list and the chat header. */
  online?: boolean;
  className?: string;
};

export function Avatar({
  name,
  colorKey,
  url,
  size = 48,
  online = false,
  className = "",
}: AvatarProps) {
  const fontSize = Math.round(size * 0.42);
  const colors = avatarColors(colorKey);
  const dot = Math.max(10, Math.round(size * 0.26));

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex size-full select-none items-center justify-center rounded-full font-normal tracking-tight"
          style={{ background: colors.bg, color: colors.fg, fontSize }}
          aria-hidden
        >
          {initials(name)}
        </div>
      )}

      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-[#3fbb5c]"
          style={{ width: dot, height: dot }}
          aria-label="Online"
        />
      )}
    </div>
  );
}
