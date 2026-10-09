"use client";

/**
 * A round photo with a camera badge, as Signal draws it on "Name this
 * group", the profile step and Profile settings. Clicking it opens a small
 * menu (Upload photo, and Remove photo once there is one), or goes straight
 * to the file picker when there is nothing to remove.
 *
 * Two ways to use it: give it `upload` and it stores the picture at once
 * and reports the stored URL; leave `upload` out and it hands back the File
 * (the profile step uses this, because an account cannot upload anything
 * until its profile exists).
 */

import { useRef, useState, type ReactNode } from "react";

import { PhotoIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { mediaUrl, uploadAttachment } from "@/lib/endpoints";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  /** Stored URL or a local preview (blob:) to show; null for the fallback. */
  value: string | null;
  fallback: ReactNode;
  size?: number;
  label: string;
  disabled?: boolean;
  onRemove?: () => void;
} & (
  | { upload: true; onUploaded: (url: string) => void; onFile?: never }
  | { upload?: false; onFile: (file: File, preview: string) => void; onUploaded?: never }
);

export function PhotoPicker(props: Props) {
  const { value, fallback, size = 80, label, disabled = false, onRemove } = props;
  const push = useToasts((state) => state.push);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handle(file: File) {
    if (!file.type.startsWith("image/")) {
      push("Choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      push("That photo is too large (10 MB max).");
      return;
    }
    if (!props.upload) {
      props.onFile(file, URL.createObjectURL(file));
      return;
    }
    setBusy(true);
    try {
      const attachment = await uploadAttachment(file, () => undefined);
      props.onUploaded(attachment.thumbnail_url ?? attachment.url);
    } catch (error) {
      push(error instanceof ApiError ? error.message : "Could not upload the photo.");
    } finally {
      setBusy(false);
    }
  }

  const src = value ? (value.startsWith("blob:") ? value : mediaUrl(value)) : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => (value && onRemove ? setMenuOpen((o) => !o) : input.current?.click())}
        aria-label={label}
        className="relative size-full rounded-full disabled:cursor-default"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full rounded-full object-cover" />
        ) : (
          fallback
        )}
        {!disabled && (
          <span
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 border-surface-raised bg-surface-chip text-ink"
            style={{ width: Math.max(22, size * 0.3), height: Math.max(22, size * 0.3) }}
          >
            {busy ? (
              <span className="size-3 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
            ) : (
              <PhotoIcon size={Math.max(11, size * 0.15)} />
            )}
          </span>
        )}
      </button>
      {menuOpen && (
        <Menu
          align="left"
          onClose={() => setMenuOpen(false)}
          items={[
            { label: "Upload photo", onSelect: () => input.current?.click() },
            { label: "Remove photo", danger: true, onSelect: () => onRemove?.() },
          ]}
        />
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handle(file);
        }}
      />
    </div>
  );
}
