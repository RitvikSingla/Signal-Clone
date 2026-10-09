"use client";

/**
 * Message Info, which in Signal Desktop replaces the thread rather than
 * opening a dialog: a back arrow, the message itself, then when it was sent
 * and received, and who it came from (or, for your own message, who has
 * read it, who it was delivered to, and who it was only sent to).
 */

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronLeftIcon, CopyIcon } from "@/components/ui/Icons";
import { useToasts } from "@/components/ui/Toasts";
import { messageApi } from "@/lib/endpoints";
import { fullTimestamp } from "@/lib/format";
import type { Message, MessageInfo, UserPublic } from "@/lib/types";

export function MessageInfoView({
  message,
  mine,
  renderBubble,
  onBack,
}: {
  message: Message;
  mine: boolean;
  renderBubble: (message: Message) => React.ReactNode;
  onBack: () => void;
}) {
  const push = useToasts((state) => state.push);
  const [info, setInfo] = useState<MessageInfo | null>(null);

  useEffect(() => {
    let live = true;
    messageApi
      .info(message.id)
      .then((value) => live && setInfo(value))
      .catch(() => live && push("Could not load message details."));
    return () => {
      live = false;
    };
  }, [message.id, push]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const receipts = info?.receipts ?? [];
  const mineReceipt = receipts[0];
  const read = receipts.filter((r) => r.read_at);
  const delivered = receipts.filter((r) => r.delivered_at && !r.read_at);
  const sentOnly = receipts.filter((r) => !r.delivered_at);

  const timeLines = [
    { label: "Sent", value: fullTimestamp(message.created_at) },
    ...(!mine && mineReceipt?.delivered_at
      ? [{ label: "Received", value: fullTimestamp(mineReceipt.delivered_at) }]
      : []),
    ...(message.edited_at ? [{ label: "Edited", value: fullTimestamp(message.edited_at) }] : []),
  ];

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-12 shrink-0 items-center px-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-8 items-center justify-center rounded-md text-ink hover:bg-surface-hover"
        >
          <ChevronLeftIcon size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-[720px]">
          <div className="pointer-events-none py-3">{renderBubble(message)}</div>

          <div className="mt-2 flex items-start gap-4 rounded-xl px-1 py-2">
            <dl className="flex-1 space-y-3">
              {timeLines.map((line) => (
                <div key={line.label}>
                  <dt className="text-[13px] font-semibold text-ink">{line.label}</dt>
                  <dd className="text-[12.5px] text-ink-2">{line.value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  timeLines.map((l) => `${l.label}: ${l.value}`).join("\n"),
                );
                push("Copied to clipboard");
              }}
              aria-label="Copy details"
              title="Copy details"
              className="flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink"
            >
              <CopyIcon size={16} />
            </button>
          </div>

          {!mine && message.sender && (
            <PeopleSection title="From" people={[{ user: message.sender, when: null }]} />
          )}
          {mine && (
            <>
              <PeopleSection title="Read" people={read.map((r) => ({ user: r.user, when: r.read_at }))} />
              <PeopleSection
                title="Delivered"
                people={delivered.map((r) => ({ user: r.user, when: r.delivered_at }))}
              />
              <PeopleSection title="Sent to" people={sentOnly.map((r) => ({ user: r.user, when: null }))} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PeopleSection({
  title,
  people,
}: {
  title: string;
  people: { user: UserPublic; when: string | null }[];
}) {
  if (people.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-ink">{title}</h3>
      {people.map(({ user, when }) => (
        <div key={user.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
          <Avatar name={user.display_name} colorKey={user.avatar_color} url={user.avatar_url} size={28} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
            {user.display_name}
          </span>
          {when && <span className="text-[12px] text-ink-2">{fullTimestamp(when)}</span>}
        </div>
      ))}
    </div>
  );
}
