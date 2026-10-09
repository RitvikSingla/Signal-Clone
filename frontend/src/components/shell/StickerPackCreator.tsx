"use client";

/**
 * File > Create/upload sticker pack.
 *
 * Signal Desktop opens this as its own window, "Signal Sticker Pack
 * Creator", with the same steps:
 *   1. Add your stickers: PNG, APNG or WebP, 512x512, transparent
 *   2. Give each sticker an emoji
 *   3. Title and author
 *   4. Upload, then the pack is installed
 *
 * Stickers are uploaded through the normal attachment endpoint and the pack
 * is kept on this device, where it appears in the composer's Stickers tab.
 * A file that is already 512x512 is uploaded untouched (so an APNG keeps
 * its animation); anything else is fitted onto a 512x512 transparent canvas.
 */

import { useRef, useState } from "react";

import { WindowFrame } from "@/components/ui/WindowDialog";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";
import { useToasts } from "@/components/ui/Toasts";
import { uploadAttachment } from "@/lib/endpoints";
import { useUi } from "@/store/ui";

const ACCEPTED = ["image/png", "image/apng", "image/webp"];
const MAX_STICKERS = 200;
const MAX_BYTES = 300 * 1024;
const EMOJI_CHOICES = [
  "😀",
  "😂",
  "😍",
  "🥳",
  "😢",
  "😡",
  "👍",
  "👋",
  "❤️",
  "🔥",
  "🎉",
  "🤔",
  "😴",
  "😎",
  "🙏",
  "✨",
];

type Draft = { key: string; file: File; preview: string; emoji: string };
type Step = "add" | "emoji" | "meta" | "uploading" | "done";

export function StickerPackCreator({ onClose }: { onClose: () => void }) {
  const push = useToasts((state) => state.push);
  const addStickerPack = useUi((state) => state.addStickerPack);

  const [step, setStep] = useState<Step>("add");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [uploaded, setUploaded] = useState(0);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  function addFiles(files: File[]) {
    const rejected = files.filter((file) => !ACCEPTED.includes(file.type));
    const accepted = files
      .filter((file) => ACCEPTED.includes(file.type))
      .slice(0, MAX_STICKERS - drafts.length);
    setError(
      rejected.length
        ? `${rejected.length} file${rejected.length > 1 ? "s were" : " was"} skipped. Stickers must be PNG, APNG or WebP.`
        : null,
    );
    setDrafts((current) => [
      ...current,
      ...accepted.map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        emoji: "",
      })),
    ]);
  }

  function remove(key: string) {
    setDrafts((current) => {
      const draft = current.find((d) => d.key === key);
      if (draft) URL.revokeObjectURL(draft.preview);
      return current.filter((d) => d.key !== key);
    });
  }

  async function upload() {
    setStep("uploading");
    setUploaded(0);
    const packId = crypto.randomUUID().slice(0, 8);
    try {
      const stickers = [];
      for (const [index, draft] of drafts.entries()) {
        const file = await toStickerFile(draft.file, `sticker-${packId}-${index + 1}`);
        const attachment = await uploadAttachment(file, () => undefined);
        stickers.push({ url: attachment.url, emoji: draft.emoji });
        setUploaded(index + 1);
      }
      addStickerPack({
        id: packId,
        title: title.trim(),
        author: author.trim(),
        cover: stickers[0].url,
        stickers,
        created_at: new Date().toISOString(),
      });
      setStep("done");
    } catch {
      push("Could not upload the sticker pack. Try again.");
      setStep("meta");
    }
  }

  return (
    <WindowFrame title="Signal Sticker Pack Creator" width={620} height={540} onClose={onClose}>
      <div className="flex h-full flex-col px-6 pb-5">
        <header className="flex items-center justify-between py-3">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="#2c6bed" />
              <path
                d="M50 24c-15 0-27 10-27 23 0 6.6 3.3 12.5 8.8 16.7L28 76.4a1.2 1.2 0 0 0 1.7 1.5l15-6.5c1.7.3 3.5.4 5.3.4 15 0 27-10 27-23S65 24 50 24Z"
                fill="#fff"
              />
            </svg>
            Signal Sticker Pack Creator
          </span>
          <a
            href="https://support.signal.org/hc/articles/360031836512"
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] font-semibold text-ink hover:underline"
          >
            Sticker Pack Creator Guidelines
          </a>
        </header>

        {step === "add" && (
          <>
            <h2 className="mt-2 text-[13px] font-semibold text-ink">Add your stickers</h2>
            <p className="mt-1 text-[12px] leading-snug text-ink-2">
              Stickers must be in PNG, APNG, or WebP format with a transparent background and
              512x512 pixels. Recommended margin is 16px.
            </p>

            <div
              className={`mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg bg-surface-sunken p-3 ${
                dragging ? "ring-2 ring-ultramarine" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles([...event.dataTransfer.files]);
              }}
            >
              {drafts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-2 hover:text-ink"
                >
                  <PlusIcon size={26} strokeWidth={1.6} />
                  <span className="text-[12.5px]">Click to add or drop images here</span>
                </button>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                  {drafts.map((draft) => (
                    <div
                      key={draft.key}
                      className="group relative aspect-square rounded-md bg-surface p-1.5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.preview} alt="" className="size-full object-contain" />
                      <button
                        type="button"
                        onClick={() => remove(draft.key)}
                        aria-label="Remove sticker"
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100"
                      >
                        <CloseIcon size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  {drafts.length < MAX_STICKERS && (
                    <button
                      type="button"
                      onClick={() => picker.current?.click()}
                      aria-label="Add more stickers"
                      className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border-strong text-ink-2 hover:text-ink"
                    >
                      <PlusIcon size={22} strokeWidth={1.6} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
            <Footer
              note={drafts.length ? `${drafts.length}/${MAX_STICKERS} stickers` : ""}
              primary={{
                label: "Next",
                disabled: drafts.length === 0,
                onClick: () => setStep("emoji"),
              }}
            />
            <input
              ref={picker}
              type="file"
              hidden
              multiple
              accept=".png,.apng,.webp,image/png,image/apng,image/webp"
              onChange={(event) => {
                addFiles([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
          </>
        )}

        {step === "emoji" && (
          <>
            <h2 className="mt-2 text-[13px] font-semibold text-ink">
              Add an emoji to each sticker
            </h2>
            <p className="mt-1 text-[12px] text-ink-2">
              This lets people find stickers while they type.
            </p>
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] content-start gap-2 overflow-y-auto">
              {drafts.map((draft) => (
                <div
                  key={draft.key}
                  className="flex flex-col items-center gap-1.5 rounded-md bg-surface-sunken p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.preview} alt="" className="size-16 object-contain" />
                  <select
                    value={draft.emoji}
                    aria-label="Emoji for this sticker"
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((d) =>
                          d.key === draft.key ? { ...d, emoji: event.target.value } : d,
                        ),
                      )
                    }
                    className="h-7 w-full rounded bg-surface-chip px-1 text-[14px] text-ink outline-none"
                  >
                    <option value="">Pick an emoji</option>
                    {EMOJI_CHOICES.map((emoji) => (
                      <option key={emoji} value={emoji}>
                        {emoji}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <Footer
              back={() => setStep("add")}
              primary={{
                label: "Next",
                disabled: drafts.some((d) => !d.emoji),
                onClick: () => setStep("meta"),
              }}
              note={drafts.some((d) => !d.emoji) ? "Every sticker needs an emoji." : ""}
            />
          </>
        )}

        {step === "meta" && (
          <>
            <h2 className="mt-2 text-[13px] font-semibold text-ink">Add a title and author</h2>
            <label className="mt-4 text-[12px] font-semibold text-ink-2" htmlFor="pack-title">
              Title
            </label>
            <input
              id="pack-title"
              autoFocus
              maxLength={60}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 h-9 rounded-md bg-surface-sunken px-3 text-[13px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
            />
            <label className="mt-3 text-[12px] font-semibold text-ink-2" htmlFor="pack-author">
              Author
            </label>
            <input
              id="pack-author"
              maxLength={60}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className="mt-1 h-9 rounded-md bg-surface-sunken px-3 text-[13px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
            />
            <div className="flex-1" />
            <Footer
              back={() => setStep("emoji")}
              primary={{
                label: "Upload",
                disabled: !title.trim() || !author.trim(),
                onClick: () => void upload(),
              }}
            />
          </>
        )}

        {step === "uploading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <span className="size-8 animate-spin rounded-full border-2 border-ink-3 border-t-ultramarine" />
            <p className="text-[13px] text-ink">
              Uploading {uploaded} of {drafts.length}…
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-[15px] font-semibold text-ink">Your sticker pack is installed</p>
            <p className="max-w-sm text-[12.5px] text-ink-2">
              &ldquo;{title.trim()}&rdquo; is in the Stickers tab of the emoji picker. Packs you
              make are kept on this device.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-8 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white hover:bg-ultramarine-hover"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </WindowFrame>
  );
}

function Footer({
  back,
  primary,
  note,
}: {
  back?: () => void;
  primary: { label: string; disabled: boolean; onClick: () => void };
  note?: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="flex-1 text-[12px] text-ink-2">{note}</span>
      {back && (
        <button
          type="button"
          onClick={back}
          className="h-8 rounded-full bg-surface-chip px-4 text-[13px] font-semibold text-ink hover:brightness-110"
        >
          Back
        </button>
      )}
      <button
        type="button"
        disabled={primary.disabled}
        onClick={primary.onClick}
        className="h-8 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white hover:bg-ultramarine-hover disabled:opacity-40"
      >
        {primary.label}
      </button>
    </div>
  );
}

/** 512x512 files go up untouched; anything else is fitted onto a canvas. */
async function toStickerFile(file: File, name: string): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const exact = bitmap.width === 512 && bitmap.height === 512 && file.size <= MAX_BYTES;
  if (exact) {
    bitmap.close();
    const extension = file.type === "image/webp" ? "webp" : "png";
    return new File([file], `${name}.${extension}`, {
      type: file.type === "image/webp" ? "image/webp" : "image/png",
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const scale = Math.min(480 / bitmap.width, 480 / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (512 - width) / 2, (512 - height) / 2, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Encode failed"))),
      "image/png",
    ),
  );
  return new File([blob], `${name}.png`, { type: "image/png" });
}
