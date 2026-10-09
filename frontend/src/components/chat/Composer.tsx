"use client";

/**
 * The message composer, laid out as Signal Desktop's: the emoji button on
 * the far left, a wide pill field, then the microphone and the plus on the
 * right. The microphone steps aside once there is something to send; Enter
 * sends and Shift+Enter inserts a newline, so there is no separate send
 * button.
 *
 * Above the field, in Signal's order: the blue reply bar (name and text,
 * with an X), or the edit bar when changing a sent message, and the strip
 * of staged attachments. Files arrive from the plus menu, from pasting an
 * image, or from dropping onto the thread; each starts uploading at once
 * and shows its progress, so Send is instant once they finish.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { StagedStrip, type StagedFile } from "@/components/chat/Attachments";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import {
  CloseIcon,
  EmojiIcon,
  FileIcon,
  MicIcon,
  PencilIcon,
  PhotoIcon,
  PlusIcon,
  PollIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { useToasts } from "@/components/ui/Toasts";
import { ApiError } from "@/lib/api";
import { uploadAttachment } from "@/lib/endpoints";
import type { Attachment, Message } from "@/lib/types";

export type ComposerHandle = { addFiles: (files: File[]) => void };

type ComposerProps = {
  currentUserId: string;
  replyingTo: Message | null;
  editing: Message | null;
  disabled?: boolean;
  handleRef: React.MutableRefObject<ComposerHandle | null>;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (message: Message, body: string) => void;
  onSend: (body: string, replyToId: string | null, attachments: Attachment[]) => void;
  onTyping: (isTyping: boolean) => void;
  onComingSoon: (feature: string) => void;
};

const MAX_HEIGHT = 160;
const MAX_FILES = 10;

/**
 * A draft belongs to its thread. Rather than clearing the field in an
 * effect when the conversation changes, the caller gives this component a
 * key of the conversation id, so React remounts it and the draft resets on
 * its own.
 */
export function Composer({
  currentUserId,
  replyingTo,
  editing,
  disabled = false,
  handleRef,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  onSend,
  onTyping,
  onComingSoon,
}: ComposerProps) {
  const push = useToasts((state) => state.push);
  const [value, setValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [fileKind, setFileKind] = useState<"media" | "file">("media");
  const field = useRef<HTMLTextAreaElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const uploads = useRef(new Map<string, AbortController>());

  // Editing loads the old text into the field; leaving edit clears it.
  const [editingId, setEditingId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    setValue(editing ? (editing.body ?? "") : "");
  }

  // Focus the field on open and when a reply or edit starts.
  useEffect(() => {
    field.current?.focus();
  }, [replyingTo, editing]);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  // Abandon in-flight uploads and free previews when the thread changes.
  useEffect(() => {
    const controllers = uploads.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);

  // Read by addFiles, which must not start uploads inside a state updater
  // (React may run an updater twice in development).
  const stagedCount = useRef(0);
  useEffect(() => {
    stagedCount.current = staged.length;
  }, [staged.length]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (editing) return;
      const room = MAX_FILES - stagedCount.current;
      if (room <= 0) {
        push(`You can send up to ${MAX_FILES} files at once.`);
        return;
      }
      const accepted = files.slice(0, room);
      if (files.length > room) push(`Only the first ${room} files were added.`);

      const next = accepted.map<StagedFile>((file) => ({
        key: crypto.randomUUID(),
        file,
        preview:
          file.type.startsWith("image/") || file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : null,
        progress: 0,
        attachment: null,
        error: null,
      }));
      stagedCount.current += next.length;
      setStaged((current) => [...current, ...next]);

      for (const item of next) {
        const controller = new AbortController();
        uploads.current.set(item.key, controller);
        uploadAttachment(
          item.file,
          (progress) =>
            setStaged((list) => list.map((s) => (s.key === item.key ? { ...s, progress } : s))),
          controller.signal,
        )
          .then((attachment) =>
            setStaged((list) =>
              list.map((s) => (s.key === item.key ? { ...s, attachment, progress: 1 } : s)),
            ),
          )
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            const message = error instanceof ApiError ? error.message : "Upload failed";
            push(`${item.file.name}: ${message}`);
            setStaged((list) =>
              list.map((s) => (s.key === item.key ? { ...s, error: message } : s)),
            );
          })
          .finally(() => uploads.current.delete(item.key));
      }
      field.current?.focus();
    },
    [editing, push],
  );

  useEffect(() => {
    handleRef.current = { addFiles };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, addFiles]);

  function removeStaged(key: string) {
    uploads.current.get(key)?.abort();
    setStaged((list) => {
      const item = list.find((s) => s.key === key);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return list.filter((s) => s.key !== key);
    });
  }

  const ready = staged.filter((s) => s.attachment && !s.error);
  const uploading = staged.some((s) => !s.attachment && !s.error);
  const hasText = value.trim().length > 0;
  const canSend = (hasText || ready.length > 0) && !uploading && !disabled;

  function submit() {
    if (editing) {
      if (!hasText) return;
      if (value.trim() !== (editing.body ?? "").trim()) onSaveEdit(editing, value);
      onCancelEdit();
      return;
    }
    if (uploading) {
      push("Wait for the attachments to finish uploading.");
      return;
    }
    if (!canSend) return;
    // The bubble shows local previews until the server copy replaces it.
    const attachments = ready.map((s) => ({
      ...(s.attachment as Attachment),
      url: s.preview ?? (s.attachment as Attachment).url,
      thumbnail_url: s.preview ?? (s.attachment as Attachment).thumbnail_url,
    }));
    onSend(value, replyingTo?.id ?? null, attachments);
    setValue("");
    setStaged([]);
    onCancelReply();
    field.current?.focus();
  }

  /** Insert at the caret, the way picking an emoji does in Signal. */
  function insert(text: string) {
    const element = field.current;
    if (!element) {
      setValue((current) => current + text);
      return;
    }
    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    setValue(next);
    onTyping(true);
    requestAnimationFrame(() => {
      element.focus();
      const caret = start + text.length;
      element.setSelectionRange(caret, caret);
    });
  }

  const replyName =
    replyingTo?.sender?.id === currentUserId ? "You" : (replyingTo?.sender?.display_name ?? "Unknown");
  const replyText =
    replyingTo?.body ||
    (replyingTo?.attachments.length
      ? replyingTo.type === "image"
        ? "📷 Photo"
        : `📎 ${replyingTo.attachments[0].file_name}`
      : "");

  return (
    <div className="shrink-0 bg-surface px-3 pb-3 pt-1.5">
      {replyingTo && !editing && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-ultramarine px-3 py-1.5 text-white">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">{replyName}</div>
            <div className="truncate text-[13px]">{replyText}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="-mr-1 shrink-0 rounded-full p-1 text-white/85 hover:bg-white/15 hover:text-white"
            aria-label="Cancel reply"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      )}

      {editing && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-1.5">
          <PencilIcon size={14} className="mt-0.5 shrink-0 text-ink-2" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-ink">Edit message</div>
            <div className="truncate text-[13px] text-ink-2">{editing.body}</div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="-mr-1 shrink-0 rounded-full p-1 text-ink-2 hover:bg-surface-hover hover:text-ink"
            aria-label="Cancel edit"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      )}

      <StagedStrip staged={staged} onRemove={removeStaged} />

      <div className="relative flex items-end gap-1.5">
        <div className="relative">
          <button
            type="button"
            data-picker-trigger
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Open emoji chooser"
            aria-expanded={pickerOpen}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              pickerOpen ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            <EmojiIcon size={20} />
          </button>
          {pickerOpen && (
            <EmojiPicker
              onClose={() => setPickerOpen(false)}
              onEmoji={insert}
              onSticker={(sticker) => {
                setPickerOpen(false);
                onSend(sticker, null, []);
              }}
              onGif={(url) => {
                setPickerOpen(false);
                onSend(url, null, []);
              }}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-end rounded-[18px] bg-surface-sunken px-3.5 py-[5px]">
          <textarea
            id="composer-field"
            ref={field}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              setValue(event.target.value);
              // Clearing the field is a stop, not another start.
              if (!editing) onTyping(event.target.value.trim().length > 0);
            }}
            onPaste={(event) => {
              const files = [...event.clipboardData.files];
              if (files.length && !editing) {
                event.preventDefault();
                addFiles(files);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                if (editing) onCancelEdit();
                else if (replyingTo) onCancelReply();
              }
            }}
            placeholder={staged.length ? "Add a message" : "Message"}
            className="max-h-[160px] w-full resize-none bg-transparent py-[3px] text-[14px] leading-[1.4] text-ink outline-none placeholder:text-ink-2"
          />
        </div>

        {!hasText && ready.length === 0 && !editing && (
          <button
            type="button"
            onClick={() => onComingSoon("Voice messages")}
            aria-label="Record a voice message"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
          >
            <MicIcon size={19} />
          </button>
        )}

        {!editing && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAttachOpen((open) => !open)}
              aria-label="Add attachment"
              aria-expanded={attachOpen}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
            >
              <PlusIcon size={19} strokeWidth={1.8} />
            </button>
            {attachOpen && (
              <Menu
                align="right"
                placement="above"
                onClose={() => setAttachOpen(false)}
                items={[
                  {
                    label: "Photos & videos",
                    icon: <PhotoIcon />,
                    onSelect: () => {
                      setFileKind("media");
                      requestAnimationFrame(() => filePicker.current?.click());
                    },
                  },
                  {
                    label: "File",
                    icon: <FileIcon />,
                    onSelect: () => {
                      setFileKind("file");
                      requestAnimationFrame(() => filePicker.current?.click());
                    },
                  },
                  { label: "Poll", icon: <PollIcon />, onSelect: () => onComingSoon("Polls") },
                ]}
              />
            )}
            <input
              ref={filePicker}
              type="file"
              hidden
              multiple
              accept={fileKind === "media" ? "image/*,video/*" : undefined}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) addFiles(files);
                event.target.value = "";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
