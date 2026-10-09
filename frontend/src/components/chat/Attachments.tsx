"use client";

/**
 * Everything attachments draw.
 *
 * In a bubble: photos as a grid (one fills the bubble at its own aspect
 * ratio; two sit side by side; three or more tile, with "+N" on the last
 * tile), videos with native controls, and other files as a card with an
 * icon, the name and the size. Clicking a photo opens the lightbox.
 *
 * In the composer: a strip of staged files with an upload ring on each and
 * an X to drop one before sending.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/ui/Icons";
import { mediaUrl } from "@/lib/endpoints";
import { fileSize } from "@/lib/format";
import type { Attachment } from "@/lib/types";

export const isImage = (a: Attachment) => a.content_type.startsWith("image/");
export const isVideo = (a: Attachment) => a.content_type.startsWith("video/");
export const isAudio = (a: Attachment) => a.content_type.startsWith("audio/");
/** Stickers made in the Sticker Pack Creator travel as images named sticker-*. */
export const isSticker = (a: Attachment) =>
  a.content_type.startsWith("image/") && a.file_name.startsWith("sticker-");

/** Local blob URLs (optimistic bubbles) pass through; server paths get the API origin. */
function src(path: string): string {
  return path.startsWith("blob:") || path.startsWith("data:") ? path : mediaUrl(path);
}

export function AttachmentContent({
  attachments,
  mine,
  hasCaption,
  onOpen,
}: {
  attachments: Attachment[];
  mine: boolean;
  hasCaption: boolean;
  onOpen: (index: number) => void;
}) {
  const visual = attachments.filter((a) => isImage(a) || isVideo(a));
  const others = attachments.filter((a) => !isImage(a) && !isVideo(a));

  return (
    <div className="flex flex-col gap-1">
      {visual.length > 0 && (
        <MediaGrid items={visual} rounded={hasCaption ? "top" : "all"} onOpen={onOpen} />
      )}
      {others.map((attachment) =>
        isAudio(attachment) ? (
          <VoiceNote key={attachment.id} attachment={attachment} mine={mine} />
        ) : (
          <FileCard key={attachment.id} attachment={attachment} mine={mine} />
        ),
      )}
    </div>
  );
}

function MediaGrid({
  items,
  rounded,
  onOpen,
}: {
  items: Attachment[];
  rounded: "top" | "all";
  onOpen: (index: number) => void;
}) {
  const radius = rounded === "all" ? "rounded-[14px]" : "rounded-t-[14px]";

  if (items.length === 1) {
    const item = items[0];
    const ratio = item.width && item.height ? item.width / item.height : 4 / 3;
    // Signal caps the bubble around 300px wide and keeps the image's shape,
    // reserving the space before it loads so the thread does not jump.
    const width = Math.min(300, Math.max(160, ratio >= 1 ? 300 : 300 * ratio));
    return (
      <div className={`overflow-hidden bg-black/20 ${radius}`} style={{ width, aspectRatio: String(ratio) }}>
        <MediaTile item={item} onClick={() => onOpen(0)} />
      </div>
    );
  }

  const shown = items.slice(0, 4);
  return (
    <div className={`grid w-[300px] grid-cols-2 gap-0.5 overflow-hidden ${radius}`}>
      {shown.map((item, index) => (
        <div
          key={item.id}
          className={`relative overflow-hidden bg-black/20 ${
            items.length === 3 && index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"
          }`}
        >
          <MediaTile item={item} onClick={() => onOpen(index)} />
          {index === 3 && items.length > 4 && (
            <button
              type="button"
              onClick={() => onOpen(3)}
              className="absolute inset-0 flex items-center justify-center bg-black/55 text-[22px] font-semibold text-white"
            >
              +{items.length - 4}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MediaTile({ item, onClick }: { item: Attachment; onClick: () => void }) {
  if (isVideo(item)) {
    return (
      <button type="button" onClick={onClick} className="relative block size-full" aria-label="Play video">
        <video src={src(item.url)} preload="metadata" muted className="size-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white">
            <PlayIcon size={18} />
          </span>
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block size-full" aria-label={`Open ${item.file_name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src(item.thumbnail_url ?? item.url)}
        alt={item.file_name}
        loading="lazy"
        className="size-full object-cover"
      />
    </button>
  );
}

function FileCard({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const extension = (attachment.file_name.split(".").pop() ?? "").slice(0, 4).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => void download(attachment)}
      className="flex w-[260px] max-w-full items-center gap-3 py-1 text-left"
      title={`Download ${attachment.file_name}`}
    >
      <span className="relative flex h-11 w-9 shrink-0 items-center justify-center">
        <FileIcon size={40} strokeWidth={1.2} className={mine ? "text-white/90" : "text-ink-2"} />
        <span
          className={`absolute bottom-2 text-[8px] font-bold ${mine ? "text-white" : "text-ink"}`}
        >
          {extension}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium">{attachment.file_name}</span>
        <span className={`block text-[12px] ${mine ? "text-white/75" : "text-ink-2"}`}>
          {fileSize(attachment.size_bytes)}
        </span>
      </span>
    </button>
  );
}

/**
 * Save with the original file name. The server stores opaque files under a
 * random name, so the browser is handed a blob and told what to call it.
 */
export async function download(attachment: Attachment, sentAt?: string): Promise<void> {
  const response = await fetch(src(attachment.url));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName(attachment, sentAt);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Signal names saved photos and videos after the moment they were sent,
 * "signal-2026-10-09-10-20-24-633.png"; other files keep their own name.
 */
export function downloadName(attachment: Attachment, sentAt?: string): string {
  if (!isImage(attachment) && !isVideo(attachment)) return attachment.file_name;
  const when = sentAt ? new Date(sentAt) : new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const stamp = [
    when.getFullYear(),
    pad(when.getMonth() + 1),
    pad(when.getDate()),
    pad(when.getHours()),
    pad(when.getMinutes()),
    pad(when.getSeconds()),
    pad(when.getMilliseconds(), 3),
  ].join("-");
  const extension = attachment.file_name.includes(".")
    ? attachment.file_name.split(".").pop()
    : attachment.content_type.split("/")[1];
  return `signal-${stamp}.${extension}`;
}

/** Deterministic bar heights (0.25..1) from a string, via a small LCG. */
function waveform(key: string, count: number): number[] {
  const heights: number[] = [];
  let seed = [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 7);
  for (let i = 0; i < count; i += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    heights.push(0.25 + (seed / 233280) * 0.75);
  }
  return heights;
}

/** A voice message: play button, a waveform that fills as it plays, time. */
function VoiceNote({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // A stable pseudo-waveform from the attachment id: the file carries no
  // peaks, and decoding every note on screen would be wasteful.
  const bars = useMemo(() => waveform(attachment.id, 28), [attachment.id]);

  const shown = playing || progress > 0 ? progress * duration : duration;
  const label = `${Math.floor(shown / 60)}:${String(Math.floor(shown % 60)).padStart(2, "0")}`;

  return (
    <div className="flex w-[250px] max-w-full items-center gap-2.5 px-1 py-1">
      <button
        type="button"
        onClick={() => {
          const node = audio.current;
          if (!node) return;
          if (node.paused) void node.play();
          else node.pause();
        }}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-white text-ultramarine" : "bg-ink text-surface"
        }`}
      >
        {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </button>
      <span className="flex h-7 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
        {bars.map((height, index) => (
          <span
            key={index}
            className={`w-[3px] rounded-full ${
              index / bars.length < progress
                ? mine
                  ? "bg-white"
                  : "bg-ink"
                : mine
                  ? "bg-white/45"
                  : "bg-ink-3"
            }`}
            style={{ height: `${height * 100}%` }}
          />
        ))}
      </span>
      <span
        className={`w-9 shrink-0 text-right text-[11px] tabular-nums ${
          mine ? "text-white/85" : "text-ink-2"
        }`}
      >
        {label}
      </span>
      <audio
        ref={audio}
        src={src(attachment.url)}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const node = event.currentTarget;
          if (Number.isFinite(node.duration)) {
            setDuration(node.duration);
            return;
          }
          // MediaRecorder WebM carries no duration. Seeking far past the end
          // makes the browser scan the file and report the real length.
          const reset = () => {
            node.removeEventListener("timeupdate", reset);
            node.currentTime = 0;
            if (Number.isFinite(node.duration)) setDuration(node.duration);
          };
          node.addEventListener("timeupdate", reset);
          node.currentTime = 1e101;
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        onTimeUpdate={(event) => {
          const node = event.currentTarget;
          if (Number.isFinite(node.duration) && node.duration > 0) {
            setProgress(node.currentTime / node.duration);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
    </div>
  );
}

/** Full-screen viewer for photos and videos, with arrows between them. */
export function Lightbox({
  items,
  start,
  caption,
  sentAt,
  onForward,
  onClose,
}: {
  items: Attachment[];
  start: number;
  caption?: string | null;
  sentAt?: string;
  onForward?: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const item = items[index];

  const step = useCallback(
    (delta: number) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + delta))),
    [items.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, step]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-4 text-white">
        <span className="mr-auto truncate text-[13px] text-white/80">
          {item.file_name}
          {items.length > 1 && ` · ${index + 1} of ${items.length}`}
        </span>
        {onForward && (
          <LightboxButton label="Forward" onClick={onForward}>
            <ForwardIcon size={19} />
          </LightboxButton>
        )}
        <LightboxButton label="Save" onClick={() => void download(item, sentAt)}>
          <DownloadIcon size={19} />
        </LightboxButton>
        <LightboxButton label="Close" onClick={onClose}>
          <CloseIcon size={19} />
        </LightboxButton>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16" onClick={onClose}>
        <div onClick={(event) => event.stopPropagation()} className="flex max-h-full max-w-full">
          {isVideo(item) ? (
            <video key={item.id} src={src(item.url)} controls autoPlay className="max-h-[calc(100vh-9rem)] max-w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={src(item.url)}
              alt={item.file_name}
              className="max-h-[calc(100vh-9rem)] max-w-full object-contain"
            />
          )}
        </div>
        {index > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
            aria-label="Previous"
            className="absolute left-4 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ChevronLeftIcon size={26} />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
            aria-label="Next"
            className="absolute right-4 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <ChevronRightIcon size={26} />
          </button>
        )}
      </div>

      <div className="flex min-h-14 shrink-0 items-center justify-center px-6 pb-4 text-center text-[14px] text-white/90">
        {caption}
      </div>
    </div>
  );
}

function LightboxButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Composer staging
// ---------------------------------------------------------------------------

export type StagedFile = {
  key: string;
  file: File;
  preview: string | null;
  progress: number;
  attachment: Attachment | null;
  error: string | null;
};

export function StagedStrip({
  staged,
  onRemove,
}: {
  staged: StagedFile[];
  onRemove: (key: string) => void;
}) {
  if (staged.length === 0) return null;
  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1 pl-10">
      {staged.map((item) => (
        <div
          key={item.key}
          className={`relative size-[72px] shrink-0 overflow-hidden rounded-lg bg-surface-sunken ${
            item.error ? "ring-2 ring-danger" : ""
          }`}
          title={item.error ?? item.file.name}
        >
          {item.preview ? (
            item.file.type.startsWith("video/") ? (
              <video src={item.preview} muted className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.preview} alt="" className="size-full object-cover" />
            )
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center">
              <FileIcon size={22} className="text-ink-2" />
              <span className="w-full truncate text-[10px] text-ink-2">{item.file.name}</span>
            </span>
          )}

          {!item.attachment && !item.error && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45">
              <ProgressRing value={item.progress} />
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(item.key)}
            aria-label={`Remove ${item.file.name}`}
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
          >
            <CloseIcon size={11} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-label={`${Math.round(value * 100)}% uploaded`}>
      <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(0.04, value))}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
