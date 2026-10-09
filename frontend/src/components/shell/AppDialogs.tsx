"use client";

/**
 * The dialogs the menu bar and the welcome pane open: Keyboard Shortcuts,
 * About, Debug Log and What's New. Each is a Signal-style modal; the About
 * box says plainly that this is a clone, not Signal itself.
 */

import { useMemo } from "react";

import { SafetyTipsDialog } from "@/components/chat/MessageRequest";
import { StickerPackCreator } from "@/components/shell/StickerPackCreator";
import { PermissionPrompt } from "@/components/ui/WindowDialog";
import { SignalMark } from "@/components/ui/Icons";
import { DialogButton, Modal } from "@/components/ui/Modal";
import { useToasts } from "@/components/ui/Toasts";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/store/ui";

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: { group: string; rows: [string, string[]][] }[] = [
  {
    group: "Navigation",
    rows: [
      ["Go to next chat", ["Alt", "↓"]],
      ["Go to previous chat", ["Alt", "↑"]],
      ["Search", [MOD, "F"]],
      ["Search in chat", [MOD, "Shift", "F"]],
      ["Start new chat", [MOD, "N"]],
      ["Open settings", [MOD, ","]],
      ["Show keyboard shortcuts", [MOD, "/"]],
      ["Close a menu, dialog or search", ["Esc"]],
    ],
  },
  {
    group: "Message",
    rows: [
      ["Send message", ["Enter"]],
      ["Insert a new line", ["Shift", "Enter"]],
      ["Focus the composer", [MOD, "Shift", "T"]],
    ],
  },
  {
    group: "View",
    rows: [
      ["Zoom in", [MOD, "="]],
      ["Zoom out", [MOD, "-"]],
      ["Actual size", [MOD, "0"]],
      ["Toggle full screen", ["F11"]],
    ],
  },
];

export function AppDialogs({ socketStatus }: { socketStatus: string }) {
  return (
    <>
      <MenuDialogs socketStatus={socketStatus} />
      <StickerCreatorHost />
      <PermissionPrompt />
    </>
  );
}

function StickerCreatorHost() {
  const open = useUi((state) => state.stickerCreatorOpen);
  const setOpen = useUi((state) => state.setStickerCreatorOpen);
  return open ? <StickerPackCreator onClose={() => setOpen(false)} /> : null;
}

function MenuDialogs({ socketStatus }: { socketStatus: string }) {
  const dialog = useUi((state) => state.dialog);
  const openDialog = useUi((state) => state.openDialog);
  const close = () => openDialog(null);

  if (dialog === "shortcuts") return <ShortcutsDialog onClose={close} />;
  if (dialog === "about") return <AboutDialog onClose={close} />;
  if (dialog === "debug-log") return <DebugLogDialog onClose={close} socketStatus={socketStatus} />;
  if (dialog === "whats-new") return <WhatsNewDialog onClose={close} />;
  if (dialog === "safety-tips") return <SafetyTipsDialog onClose={close} />;
  return null;
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Keyboard shortcuts" width={460} closeButton>
      <h2 className="text-[16px] font-semibold text-ink">Keyboard shortcuts</h2>
      {SHORTCUTS.map((section) => (
        <section key={section.group} className="mt-4">
          <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-2">
            {section.group}
          </h3>
          <ul>
            {section.rows.map(([label, keys]) => (
              <li key={label} className="flex items-center justify-between gap-4 py-1.5 text-[13px] text-ink">
                <span>{label}</span>
                <span className="flex gap-1">
                  {keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-[24px] rounded-md bg-surface-chip px-1.5 py-0.5 text-center font-sans text-[11.5px] text-ink"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Modal>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="About" width={340} closeButton>
      <div className="flex flex-col items-center text-center">
        <SignalMark size={64} className="text-ultramarine" />
        <h2 className="mt-4 text-[16px] font-semibold text-ink">Signal Clone</h2>
        <p className="mt-1 text-[12.5px] text-ink-2">v0.1.0 · Desktop web build</p>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-2">
          A learning project that recreates the Signal Desktop interface. It is not made by,
          affiliated with, or endorsed by Signal Messenger, LLC, and its encryption is
          simulated.
        </p>
      </div>
      <div className="mt-5 flex">
        <DialogButton variant="secondary" onClick={onClose}>
          Close
        </DialogButton>
      </div>
    </Modal>
  );
}

function DebugLogDialog({ onClose, socketStatus }: { onClose: () => void; socketStatus: string }) {
  const theme = useTheme();
  const zoom = useUi((state) => state.zoom);
  const push = useToasts((state) => state.push);

  const log = useMemo(() => {
    const lines = [
      `time          ${new Date().toISOString()}`,
      `userAgent     ${navigator.userAgent}`,
      `language      ${navigator.language}`,
      `viewport      ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
      `theme         ${theme}`,
      `zoom          ${Math.round(zoom * 100)}%`,
      `socket        ${socketStatus}`,
      `online        ${navigator.onLine}`,
      `api           ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}`,
    ];
    return lines.join("\n");
  }, [theme, zoom, socketStatus]);

  return (
    <Modal onClose={onClose} label="Debug log" width={560} closeButton>
      <h2 className="text-[16px] font-semibold text-ink">Debug log</h2>
      <pre className="mt-3 max-h-[50vh] overflow-auto rounded-lg bg-surface-chip p-3 text-[11.5px] leading-relaxed text-ink">
        {log}
      </pre>
      <div className="mt-4 flex gap-2.5">
        <DialogButton variant="secondary" onClick={onClose}>
          Cancel
        </DialogButton>
        <DialogButton
          variant="primary"
          onClick={() => {
            void navigator.clipboard?.writeText(log);
            push("Debug log copied");
          }}
        >
          Copy log
        </DialogButton>
      </div>
    </Modal>
  );
}

function WhatsNewDialog({ onClose }: { onClose: () => void }) {
  const notes = [
    "Message requests: review, accept, block or report people who are not in your contacts.",
    "Emoji, sticker and GIF picker in the composer.",
    "Stories: watch Signal's story and post your own text or photo stories.",
    "Create call links from the Calls tab.",
    "Dark theme by default, matching Signal Desktop.",
  ];
  return (
    <Modal onClose={onClose} label="What's new" width={420} closeButton>
      <h2 className="text-[16px] font-semibold text-ink">What&rsquo;s new</h2>
      <p className="mt-1 text-[12.5px] text-ink-2">v0.1.0</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[13px] leading-snug text-ink">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <div className="mt-5 flex">
        <DialogButton variant="primary" onClick={onClose}>
          OK
        </DialogButton>
      </div>
    </Modal>
  );
}
