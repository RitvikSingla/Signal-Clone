"use client";

/**
 * The dialogs behind the message menu, worded and laid out as in Signal
 * Desktop: "Pin message for…" with four durations, "Delete selected
 * message?" with its stacked choices, and "Forward To" with a searchable,
 * multi-select chat list and a round send button.
 */

import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, SearchIcon, SendIcon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import type { ConversationSummary } from "@/lib/types";

const PIN_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "24 hours", seconds: 86_400 },
  { label: "7 days", seconds: 604_800 },
  { label: "30 days", seconds: 2_592_000 },
  { label: "Forever", seconds: null },
];

export function PinDialog({
  onPin,
  onClose,
}: {
  onPin: (seconds: number | null) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState(1);

  return (
    <Modal onClose={onClose} label="Pin message for" width={300}>
      <div className="-mt-1 flex items-center">
        <h2 className="flex-1 text-center text-[14px] font-semibold text-ink">Pin message for…</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
        >
          <CloseIcon size={15} />
        </button>
      </div>

      <div className="mt-3 flex flex-col" role="radiogroup">
        {PIN_OPTIONS.map((option, index) => (
          <label
            key={option.label}
            className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-2 text-[13px] text-ink"
          >
            <input
              type="radio"
              name="pin-duration"
              checked={choice === index}
              onChange={() => setChoice(index)}
              className="peer sr-only"
            />
            <span
              className={`flex size-[18px] items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-ultramarine ${
                choice === index ? "border-ultramarine" : "border-ink-3"
              }`}
            >
              {choice === index && <span className="size-2 rounded-full bg-ultramarine" />}
            </span>
            {option.label}
          </label>
        ))}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-full bg-surface-chip px-4 text-[13px] font-semibold text-ink hover:brightness-110"
        >
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => {
            onPin(PIN_OPTIONS[choice].seconds);
            onClose();
          }}
          className="h-8 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white hover:bg-ultramarine-hover"
        >
          Pin
        </button>
      </div>
    </Modal>
  );
}

export function DeleteDialog({
  count,
  canDeleteForEveryone,
  onDeleteForEveryone,
  onDeleteForMe,
  onClose,
}: {
  count: number;
  canDeleteForEveryone: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onClose: () => void;
}) {
  const plural = count > 1;
  return (
    <Modal onClose={onClose} label="Delete messages" width={300}>
      <h2 className="text-center text-[14px] font-semibold text-ink">
        {plural ? `Delete ${count} selected messages?` : "Delete selected message?"}
      </h2>
      <p className="mt-1.5 text-center text-[13px] leading-snug text-ink">
        Who would you like to delete {plural ? "these messages" : "this message"} for?
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {canDeleteForEveryone && (
          <StackButton
            danger
            onClick={() => {
              onDeleteForEveryone();
              onClose();
            }}
          >
            Delete for everyone
          </StackButton>
        )}
        <StackButton
          danger
          onClick={() => {
            onDeleteForMe();
            onClose();
          }}
        >
          Delete for me
        </StackButton>
        <StackButton onClick={onClose}>Cancel</StackButton>
      </div>
    </Modal>
  );
}

function StackButton({
  children,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 w-full rounded-full bg-surface-chip text-[13px] font-semibold transition hover:brightness-110 ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function ForwardDialog({
  conversations,
  onForward,
  onClose,
}: {
  conversations: ConversationSummary[];
  onForward: (conversationIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((c) => !needle || c.title.toLowerCase().includes(needle));
  }, [conversations, query]);

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <Modal onClose={onClose} label="Forward To" width={360}>
      <div className="-mt-1 flex items-center">
        <h2 className="flex-1 text-[14px] font-semibold text-ink">Forward To</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
        >
          <CloseIcon size={15} />
        </button>
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Name, username, or number</span>
        <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, username, or number"
          className="h-[30px] w-full rounded-md bg-surface-chip pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-2 focus:ring-2 focus:ring-ultramarine"
        />
      </label>

      <div className="mt-2 h-[300px] overflow-y-auto">
        {visible.map((conversation) => {
          const on = picked.includes(conversation.id);
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => toggle(conversation.id)}
              aria-pressed={on}
              className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-hover"
            >
              <Avatar
                name={conversation.title}
                colorKey={conversation.avatar_color}
                url={conversation.avatar_url}
                size={30}
                group={conversation.type === "group"}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                {conversation.title}
              </span>
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                  on ? "border-ultramarine bg-ultramarine" : "border-ink-3"
                }`}
              >
                {on && (
                  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                    <path d="m2.5 6.2 2.2 2.2 4.8-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-2">No chats found</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-[12px] text-ink-2">
          {picked.length
            ? conversations
                .filter((c) => picked.includes(c.id))
                .map((c) => c.title)
                .join(", ")
            : ""}
        </span>
        <button
          type="button"
          disabled={picked.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onForward(picked);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ultramarine text-white transition hover:bg-ultramarine-hover disabled:opacity-40"
        >
          <SendIcon size={17} />
        </button>
      </div>
    </Modal>
  );
}
