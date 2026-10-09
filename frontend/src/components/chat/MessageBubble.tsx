"use client";

/**
 * One message bubble.
 *
 * Signal details this reproduces:
 *   - 18px radius everywhere except the tail corner of a run from the same
 *     sender, which drops to 4px
 *   - the time sits inside the bubble after the text, relative while recent
 *     ("Now", "3m") and a clock time after that ("9:00 am"), with a pin
 *     glyph before it while the message is pinned
 *   - a message of one to three emoji, or a sticker, is drawn large with no
 *     bubble; a GIF is drawn as the image itself; photos fill the bubble
 *   - hovering shows React, Reply and More beside the bubble. React opens
 *     the six-emoji bar, whose "⋯" opens the whole emoji list. More opens
 *     Forward, Edit (your own), Select, Copy text, Pin, Info and Delete
 *   - in selection mode a round checkbox sits at the left of every message
 */

import { useState } from "react";

import { AttachmentContent, isSticker } from "@/components/chat/Attachments";
import { Avatar } from "@/components/ui/Avatar";
import { mediaUrl } from "@/lib/endpoints";
import { ReactionPicker } from "@/components/chat/EmojiPicker";
import {
  CopyIcon,
  DownloadIcon,
  ForwardIcon,
  InfoIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  ReactIcon,
  ReplyIcon,
  StatusIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { bubbleTime } from "@/lib/format";
import type { Message } from "@/lib/types";

export type BubbleActions = {
  onReply: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onSelect: (message: Message) => void;
  onCopy: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (message: Message) => void;
  onInfo: (message: Message) => void;
  onDelete: (message: Message) => void;
  onOpenMedia: (message: Message, index: number) => void;
  onDownload: (message: Message) => void;
  /** A group sender's avatar or name was clicked. */
  onOpenSender?: (userId: string) => void;
};

type MessageBubbleProps = {
  message: Message;
  mine: boolean;
  isGroup: boolean;
  currentUserId: string;
  now: number;
  highlighted: boolean;
  /** First of a run from this sender: shows the name and the full radius. */
  startsRun: boolean;
  /** Last of a run: carries the tail. */
  endsRun: boolean;
  /** Selection mode, and whether this one is ticked. */
  selecting?: boolean;
  selected?: boolean;
  onToggleSelected?: (message: Message) => void;
  /** Static rendering for the Info screen: no hover actions. */
  readOnly?: boolean;
  /** The sender's member label in this group, if any. */
  senderLabel?: string | null;
  /** This chat's outgoing bubble colour ("visible to only you"). */
  outgoingColor?: string;
  /** Your nickname for the sender, which replaces their profile name. */
  senderName?: string | null;
  actions: BubbleActions;
};

/** The six Signal offers on the reaction bar, in the same order. */
const QUICK_REACTIONS = ["❤️", "\u{1F44D}", "\u{1F44E}", "\u{1F602}", "\u{1F62E}", "\u{1F622}"];

const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*\s*){1,3}$/u;
const GIF_URL = /^https:\/\/media\d*\.giphy\.com\/\S+$/;

/** Signal lets you edit your own text messages for 24 hours. */
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function MessageBubble({
  message,
  mine,
  isGroup,
  currentUserId,
  now,
  highlighted,
  startsRun,
  endsRun,
  selecting = false,
  selected = false,
  onToggleSelected,
  readOnly = false,
  senderLabel = null,
  outgoingColor,
  senderName = null,
  actions,
}: MessageBubbleProps) {
  const [barOpen, setBarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const deleted = message.deleted_at !== null;
  const body = message.body ?? "";
  const media = message.attachments ?? [];
  const hasMedia = media.length > 0 && !deleted;
  const sticker = hasMedia && !body && media.length === 1 && isSticker(media[0]);
  const jumbo = !deleted && !hasMedia && EMOJI_ONLY.test(body.trim());
  const gif = !deleted && !hasMedia && GIF_URL.test(body.trim());
  const visualOnly =
    hasMedia &&
    !body &&
    media.every((a) => a.content_type.startsWith("image/") || a.content_type.startsWith("video/"));
  const bare = jumbo || gif || sticker;

  const tail = mine
    ? endsRun
      ? "rounded-br-bubble-tail"
      : ""
    : endsRun
      ? "rounded-bl-bubble-tail"
      : "";

  const myReaction = message.reactions.find((r) => r.user_id === currentUserId)?.emoji;
  const hovering = barOpen || menuOpen || pickerOpen;
  const pinned = Boolean(message.pinned_at);
  const canEdit =
    mine &&
    !deleted &&
    message.type === "text" &&
    !gif &&
    now - new Date(message.created_at).getTime() < EDIT_WINDOW_MS &&
    !message.id.startsWith("pending-");

  const meta = (
    <span
      className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${
        bare
          ? "text-ink-2"
          : visualOnly
            ? "text-white drop-shadow"
            : mine
              ? "text-white/80"
              : "text-ink-2"
      }`}
      title={new Date(message.created_at).toLocaleString()}
      style={{ ["--status-on-fill" as string]: bare ? "var(--surface)" : "var(--bubble-out)" }}
    >
      {pinned && <PinIcon size={11} strokeWidth={2} className="-rotate-45" />}
      {message.expires_at && (
        <ExpiryTimer createdAt={message.created_at} expiresAt={message.expires_at} now={now} />
      )}
      {message.edited_at && <span>Edited</span>}
      {bubbleTime(message.created_at, now)}
      {mine && <StatusIcon status={message.status} size={11} />}
    </span>
  );

  function pickReaction(emoji: string) {
    setBarOpen(false);
    setPickerOpen(false);
    actions.onReact(message, emoji);
  }

  return (
    <div
      id={`msg-${message.id}`}
      onClick={selecting ? () => onToggleSelected?.(message) : undefined}
      className={`group flex w-full items-center gap-1 ${mine ? "justify-end" : "justify-start"} ${
        endsRun ? "mb-2.5" : "mb-[3px]"
      } ${selecting ? "cursor-pointer" : ""} ${selected ? "rounded-lg bg-ultramarine/10" : ""}`}
    >
      {selecting && (
        <span
          className={`order-first mr-2 flex size-[18px] shrink-0 items-center justify-center self-center rounded-full border-2 ${
            mine ? "mr-auto" : ""
          } ${selected ? "border-ultramarine bg-ultramarine" : "border-ink-3"}`}
          aria-hidden
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 12 12">
              <path
                d="m2.5 6.2 2.2 2.2 4.8-4.8"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      )}

      {isGroup && !mine && message.sender && (
        // Signal puts the sender's avatar beside the last bubble of a run and
        // keeps the column empty beside the others.
        <div
          className={`mr-1 w-7 shrink-0 self-end ${message.reactions.length > 0 ? "mb-3.5" : ""}`}
        >
          {endsRun &&
            (readOnly ? (
              <Avatar
                name={message.sender.display_name}
                colorKey={message.sender.avatar_color}
                url={message.sender.avatar_url}
                size={28}
              />
            ) : (
              <button
                type="button"
                aria-label={`About ${senderName ?? message.sender.display_name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!selecting && message.sender) actions.onOpenSender?.(message.sender.id);
                }}
                className="block rounded-full transition hover:brightness-110"
              >
                <Avatar
                  name={message.sender.display_name}
                  colorKey={message.sender.avatar_color}
                  url={message.sender.avatar_url}
                  size={28}
                />
              </button>
            ))}
        </div>
      )}

      <div
        className={`flex max-w-[min(70%,560px)] flex-col ${mine ? "order-2 items-end" : "items-start"}`}
      >
        <div
          className={`relative transition-shadow ${
            bare
              ? ""
              : visualOnly
                ? `overflow-hidden rounded-[16px] ${tail}`
                : `rounded-bubble ${hasMedia ? "p-1" : "px-3 py-[7px]"} ${tail} ${
                    mine ? "bg-bubble-out text-bubble-out-ink" : "bg-bubble-in text-bubble-in-ink"
                  }`
          } ${message.reactions.length > 0 ? "mb-3.5" : ""} ${
            highlighted ? "ring-2 ring-[#f5c518] ring-offset-2 ring-offset-surface" : ""
          }`}
          style={
            mine && !bare && !visualOnly && outgoingColor
              ? { background: outgoingColor }
              : undefined
          }
        >
          {message.is_forwarded && !deleted && (
            <div
              className={`mb-0.5 flex items-center gap-1 text-[12px] italic ${
                hasMedia ? "px-2 pt-1" : ""
              } ${mine && !bare ? "text-white/80" : "text-ink-2"}`}
            >
              <ForwardIcon size={11} />
              Forwarded
            </div>
          )}

          {isGroup && !mine && startsRun && message.sender && !bare && (
            <div
              className={`mb-0.5 text-[12.5px] font-semibold ${hasMedia ? "px-2 pt-1" : ""}`}
              style={{ color: `var(--${message.sender.avatar_color.toLowerCase()})` }}
            >
              <span className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={readOnly || selecting}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (message.sender) actions.onOpenSender?.(message.sender.id);
                  }}
                  className="cursor-pointer font-semibold hover:underline disabled:cursor-default disabled:no-underline"
                >
                  {senderName ?? message.sender.display_name}
                </button>
                {senderLabel && (
                  <span className="rounded bg-[#1f6f3a] px-1.5 text-[10.5px] font-semibold leading-[16px] text-[#b7f5c6]">
                    {senderLabel}
                  </span>
                )}
              </span>
            </div>
          )}

          {message.reply_to && (
            <div className={hasMedia ? "px-1 pt-1" : ""}>
              <QuotedStrip quoted={message.reply_to} mine={mine} />
            </div>
          )}

          {sticker ? (
            <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(media[0].url)}
                alt="Sticker"
                className="size-[150px] object-contain"
              />
              {meta}
            </div>
          ) : jumbo ? (
            <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="text-[48px] leading-[1.1]">{body.trim()}</span>
              {meta}
            </div>
          ) : gif ? (
            <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={body.trim()}
                alt="GIF"
                className="max-h-[260px] max-w-[300px] rounded-[14px] bg-surface-sunken"
                loading="lazy"
              />
              {meta}
            </div>
          ) : hasMedia ? (
            <div className="relative">
              <AttachmentContent
                attachments={media}
                mine={mine}
                hasCaption={Boolean(body)}
                onOpen={(index) => actions.onOpenMedia(message, index)}
              />
              {body ? (
                <p className="whitespace-pre-wrap break-words px-2 pb-1 pt-1.5 text-[14px] leading-[1.4]">
                  {body}
                  <span className="float-right ml-2.5 mt-[3px] inline-flex">{meta}</span>
                </p>
              ) : visualOnly ? (
                <span className="pointer-events-none absolute bottom-1.5 right-2 rounded-full bg-black/35 px-1.5 py-0.5">
                  {meta}
                </span>
              ) : (
                <span className="flex justify-end px-2 pb-1">{meta}</span>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.4]">
              <span className={deleted ? "italic opacity-70" : ""}>
                {deleted ? "This message was deleted." : body}
              </span>
              <span className="float-right ml-2.5 mt-[3px] inline-flex">{meta}</span>
            </p>
          )}

          {message.reactions.length > 0 && (
            <ReactionPills reactions={message.reactions} mine={mine} />
          )}

          {barOpen && (
            <ReactionBar
              mine={mine}
              current={myReaction}
              onPick={pickReaction}
              onMore={() => {
                setBarOpen(false);
                setPickerOpen(true);
              }}
              onClose={() => setBarOpen(false)}
            />
          )}

          {pickerOpen && (
            <ReactionPicker
              onPick={pickReaction}
              onClose={() => setPickerOpen(false)}
              className={`bottom-full mb-1.5 ${mine ? "right-0" : "left-0"}`}
            />
          )}
        </div>
      </div>

      {!deleted && !selecting && !readOnly && (
        <div
          className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
            mine ? "order-1 flex-row-reverse" : ""
          } ${hovering ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"}`}
        >
          <ActionButton label="React" onClick={() => setBarOpen((open) => !open)}>
            <ReactIcon size={17} />
          </ActionButton>
          {hasMedia && !sticker && (
            <ActionButton label="Download" onClick={() => actions.onDownload(message)}>
              <DownloadIcon size={16} />
            </ActionButton>
          )}
          <ActionButton label="Reply" onClick={() => actions.onReply(message)}>
            <ReplyIcon size={16} />
          </ActionButton>
          <div className="relative">
            <ActionButton label="More actions" onClick={() => setMenuOpen((open) => !open)}>
              <MoreIcon size={16} className="rotate-90" />
            </ActionButton>
            {menuOpen && (
              <Menu
                align={mine ? "right" : "left"}
                placement="above"
                onClose={() => setMenuOpen(false)}
                items={[
                  {
                    label: "Forward",
                    icon: <ForwardIcon size={15} />,
                    onSelect: () => actions.onForward(message),
                  },
                  ...(canEdit
                    ? [
                        {
                          label: "Edit",
                          icon: <PencilIcon size={15} />,
                          onSelect: () => actions.onEdit(message),
                        },
                      ]
                    : []),
                  {
                    label: "Select",
                    icon: <SelectIcon />,
                    onSelect: () => actions.onSelect(message),
                  },
                  ...(body && !gif
                    ? [
                        {
                          label: "Copy text",
                          icon: <CopyIcon size={15} />,
                          onSelect: () => actions.onCopy(message),
                        },
                      ]
                    : []),
                  pinned
                    ? {
                        label: "Unpin",
                        icon: <PinIcon size={15} strokeWidth={1.7} />,
                        onSelect: () => actions.onUnpin(message),
                      }
                    : {
                        label: "Pin",
                        icon: <PinIcon size={15} strokeWidth={1.7} />,
                        onSelect: () => actions.onPin(message),
                      },
                  {
                    label: "Info",
                    icon: <InfoIcon size={15} />,
                    onSelect: () => actions.onInfo(message),
                  },
                  {
                    label: "Delete",
                    icon: <TrashIcon size={15} />,
                    onSelect: () => actions.onDelete(message),
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.7 2.7L16 9.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActionButton({
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
      title={label}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
    >
      {children}
    </button>
  );
}

function ReactionBar({
  mine,
  current,
  onPick,
  onMore,
  onClose,
}: {
  mine: boolean;
  current: string | undefined;
  onPick: (emoji: string) => void;
  onMore: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onMouseDown={onClose} aria-hidden />
      <div
        className={`animate-pop-in absolute bottom-full z-40 mb-1.5 flex items-center gap-0.5 rounded-full bg-surface-overlay p-1 shadow-[0_4px_20px_rgba(0,0,0,0.4)] ${
          mine ? "right-0" : "left-0"
        }`}
        role="menu"
        aria-label="Reactions"
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className={`flex size-8 items-center justify-center rounded-full text-[20px] transition-transform hover:scale-[1.35] ${
              current === emoji ? "bg-surface-hover" : ""
            }`}
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-label="More reactions"
          className="ml-0.5 flex size-7 items-center justify-center rounded-full bg-surface-chip text-ink hover:brightness-125"
        >
          <MoreIcon size={14} className="rotate-90" />
        </button>
      </div>
    </>
  );
}

function QuotedStrip({
  quoted,
  mine,
}: {
  quoted: NonNullable<Message["reply_to"]>;
  mine: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        document
          .getElementById(`msg-${quoted.id}`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }}
      className={`mb-1.5 block w-full rounded-lg border-l-[3px] px-2 py-1 text-left text-[12.5px] ${
        mine ? "border-white/70 bg-white/15" : "border-ink-2 bg-black/15"
      }`}
    >
      <div className="font-semibold">{quoted.sender_name ?? "Unknown"}</div>
      <div className="line-clamp-2 opacity-85">
        {quoted.is_deleted
          ? "This message was deleted."
          : quoted.body ||
            (quoted.type === "image" ? "📷 Photo" : quoted.type === "file" ? "📎 File" : "")}
      </div>
    </button>
  );
}

function ReactionPills({ reactions, mine }: { reactions: Message["reactions"]; mine: boolean }) {
  const grouped = new Map<string, number>();
  for (const reaction of reactions) {
    grouped.set(reaction.emoji, (grouped.get(reaction.emoji) ?? 0) + 1);
  }

  return (
    <div
      className={`absolute -bottom-4 flex gap-1 ${mine ? "left-2" : "right-2"}`}
      title={reactions.map((r) => `${r.display_name} ${r.emoji}`).join(", ")}
    >
      {[...grouped.entries()].map(([emoji, count]) => (
        <span
          key={emoji}
          className="flex items-center gap-0.5 rounded-full border-2 border-surface bg-surface-chip px-1 py-[2px] text-[12px] leading-none text-ink"
        >
          {emoji}
          {count > 1 && <span className="text-[11px] text-ink-2">{count}</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * Signal's disappearing-message glyph: a small clock face whose filled
 * wedge shrinks as the message nears its expiry.
 */
function ExpiryTimer({
  createdAt,
  expiresAt,
  now,
}: {
  createdAt: string;
  expiresAt: string;
  now: number;
}) {
  const start = new Date(createdAt).getTime();
  const end = new Date(expiresAt).getTime();
  const left = Math.max(0, Math.min(1, (end - now) / Math.max(1, end - start)));
  const angle = left * 2 * Math.PI;
  const x = 6 + 4.2 * Math.sin(angle);
  const y = 6 - 4.2 * Math.cos(angle);
  const wedge =
    left >= 0.999
      ? "M6 1.8a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 1 1 0-8.4Z"
      : `M6 6V1.8A4.2 4.2 0 ${left > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-label="Disappearing message" role="img">
      <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
      {left > 0 && <path d={wedge} fill="currentColor" />}
    </svg>
  );
}
