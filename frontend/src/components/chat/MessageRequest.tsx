"use client";

/**
 * Message requests.
 *
 * When someone outside your address book writes first, Signal replaces the
 * composer with a warning and three choices, and will not tell the sender
 * you have read anything until you accept. Accepting asks once more, then
 * leaves a "You accepted" line in the thread with a Block or Report button
 * under it. The dialogs here carry Signal's own wording.
 */

import { useState } from "react";

import { ConfirmDialog, DialogButton, Modal } from "@/components/ui/Modal";
import { ChatsIcon, WarningIcon } from "@/components/ui/Icons";

type Pending = null | "accept" | "block" | "report" | "block-or-report";

/** The bar that stands in for the composer while a request is pending. */
export function MessageRequestBar({
  name,
  onAccept,
  onBlock,
  onReport,
}: {
  name: string;
  onAccept: () => void;
  onBlock: () => void;
  onReport: (alsoBlock: boolean) => void;
}) {
  const [pending, setPending] = useState<Pending>(null);

  return (
    <div className="shrink-0 px-6 pb-4 pt-2 text-center">
      <p className="flex items-center justify-center gap-1 text-[12.5px] font-semibold text-danger">
        <WarningIcon size={13} />
        Review requests carefully
      </p>
      <p className="mx-auto mt-1.5 max-w-[760px] text-[12.5px] leading-[1.45] text-ink">
        Let <strong className="font-semibold">{name}</strong> message you and share your name
        and photo with them? They won&rsquo;t know you&rsquo;ve seen their messages until you
        accept.
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <RequestButton tone="danger" onClick={() => setPending("block")}>
          Block
        </RequestButton>
        <RequestButton tone="danger" onClick={() => setPending("report")}>
          Report…
        </RequestButton>
        <RequestButton tone="primary" onClick={() => setPending("accept")}>
          Accept
        </RequestButton>
      </div>

      <RequestDialogs
        pending={pending}
        name={name}
        onClose={() => setPending(null)}
        onAccept={onAccept}
        onBlock={onBlock}
        onReport={onReport}
        onPick={setPending}
      />
    </div>
  );
}

/** The event line left in the thread once a request is accepted. */
export function AcceptedNotice({
  name,
  onBlock,
  onReport,
}: {
  name: string;
  onBlock: () => void;
  onReport: (alsoBlock: boolean) => void;
}) {
  const [pending, setPending] = useState<Pending>(null);

  return (
    <div className="my-4 flex flex-col items-center gap-2 text-center">
      <p className="flex items-center gap-1.5 text-[12px] text-ink">
        <ChatsIcon size={15} className="text-ink-2" />
        You accepted {name}&rsquo;s message request
      </p>
      <button
        type="button"
        onClick={() => setPending("block-or-report")}
        className="rounded-full bg-surface-chip px-3 py-1 text-[12px] font-semibold text-link transition hover:brightness-110"
      >
        Block or Report…
      </button>

      <RequestDialogs
        pending={pending}
        name={name}
        onClose={() => setPending(null)}
        onAccept={() => undefined}
        onBlock={onBlock}
        onReport={onReport}
        onPick={setPending}
      />
    </div>
  );
}

function RequestButton({
  children,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  tone: "danger" | "primary";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full bg-surface-chip px-3.5 py-1.5 text-[12.5px] font-semibold transition hover:brightness-110 ${
        tone === "danger" ? "text-danger" : "text-link"
      }`}
    >
      {children}
    </button>
  );
}

function RequestDialogs({
  pending,
  name,
  onClose,
  onAccept,
  onBlock,
  onReport,
  onPick,
}: {
  pending: Pending;
  name: string;
  onClose: () => void;
  onAccept: () => void;
  onBlock: () => void;
  onReport: (alsoBlock: boolean) => void;
  onPick: (next: Pending) => void;
}) {
  if (pending === "accept") {
    return (
      <ConfirmDialog
        title="Accept request?"
        confirmLabel="Accept"
        onConfirm={onAccept}
        onClose={onClose}
      >
        Only accept requests from people you trust.{" "}
        <strong className="font-semibold">Signal will never</strong> message you for a
        registration code, PIN, or recovery key.
      </ConfirmDialog>
    );
  }

  if (pending === "block") {
    return (
      <ConfirmDialog
        title={`Block ${name}?`}
        confirmLabel="Block"
        tone="danger"
        onConfirm={onBlock}
        onClose={onClose}
      >
        Blocked people won&rsquo;t be able to call you or send you messages.
      </ConfirmDialog>
    );
  }

  if (pending === "report") {
    return (
      <Modal onClose={onClose} label="Report spam?" width={340}>
        <h2 className="text-center text-[15px] font-semibold text-ink">Report spam?</h2>
        <p className="mt-2 text-center text-[13px] leading-[1.45] text-ink">
          Signal will be notified that this person may be sending spam. Signal can&rsquo;t
          see the content of any chats.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <DialogButton
            variant="danger"
            onClick={() => {
              onReport(true);
              onClose();
            }}
          >
            Report and block
          </DialogButton>
          <DialogButton
            variant="secondary"
            onClick={() => {
              onReport(false);
              onClose();
            }}
          >
            Report
          </DialogButton>
          <DialogButton variant="secondary" onClick={onClose}>
            Cancel
          </DialogButton>
        </div>
      </Modal>
    );
  }

  if (pending === "block-or-report") {
    return (
      <Modal onClose={onClose} label="Block or report" width={320}>
        <p className="text-center text-[13px] leading-[1.45] text-ink">
          You accepted a message request from {name}. If this was a mistake, you can choose an
          action below.
        </p>
        <div className="mt-4 flex gap-2">
          <DialogButton variant="secondary" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger" onClick={() => onPick("report")}>
            Report…
          </DialogButton>
          <DialogButton variant="danger" onClick={() => onPick("block")}>
            Block
          </DialogButton>
        </div>
      </Modal>
    );
  }

  return null;
}

const TIPS: { title: string; body: string }[] = [
  {
    title: "Crypto or money scams",
    body: "If someone you don’t know messages you about crypto or money, be careful. It’s likely a scam.",
  },
  {
    title: "Vague or irrelevant messages",
    body: "Scammers often start with a simple message like “Hi” to get your attention, then build trust before asking for something.",
  },
  {
    title: "Messages with links",
    body: "Be careful with messages from people you don’t know that include links to websites. Never visit links from people you don’t trust.",
  },
  {
    title: "Fake businesses and institutions",
    body: "Be careful of businesses or government agencies contacting you. Messages that involve tax agencies, couriers and more can be spam.",
  },
];

export function SafetyTipsDialog({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const tip = TIPS[page];

  return (
    <Modal onClose={onClose} label="Safety tips" width={400} closeButton>
      <h2 className="text-center text-[16px] font-semibold text-ink">Safety tips</h2>
      <p className="mt-1.5 text-center text-[13px] leading-snug text-ink-2">
        Be cautious when accepting message requests from people you don&rsquo;t know. Watch
        out for:
      </p>

      <div className="mt-5 rounded-xl bg-surface-chip px-5 py-6 text-center">
        <p className="text-[15px] font-semibold text-ink">{tip.title}</p>
        <p className="mt-2 text-[13px] leading-[1.5] text-ink-2">{tip.body}</p>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {TIPS.map((_, index) => (
          <span
            key={index}
            className={`size-1.5 rounded-full ${index === page ? "bg-ink" : "bg-ink-3"}`}
          />
        ))}
      </div>

      <div className="mt-5 flex gap-2.5">
        <DialogButton
          variant="secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous tip
        </DialogButton>
        <DialogButton
          variant="primary"
          onClick={() => (page === TIPS.length - 1 ? onClose() : setPage((p) => p + 1))}
        >
          {page === TIPS.length - 1 ? "Done" : "Next tip"}
        </DialogButton>
      </div>
    </Modal>
  );
}
