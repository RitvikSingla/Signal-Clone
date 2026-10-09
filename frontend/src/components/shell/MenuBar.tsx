"use client";

/**
 * The application menu bar Signal Desktop shows on Windows: File, Edit,
 * View, Window, Help, with the same items and shortcuts as the recording.
 *
 * Each item does the browser equivalent of what the desktop app does: Edit
 * acts on the focused field, View zooms the interface and toggles full
 * screen, Help opens the real Signal pages and this build's dialogs. Once
 * one menu is open, hovering the others switches between them, the way a
 * native menu bar behaves.
 */

import { useEffect, useRef, useState } from "react";

import { MenuPanel, type MenuItem } from "@/components/ui/Menu";
import { useToasts } from "@/components/ui/Toasts";
import { nextZoom, useUi } from "@/store/ui";

type MenuBarProps = {
  onOpenSettings: () => void;
  onSignOut: () => void;
};

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const MOD = isMac ? "Cmd" : "Ctrl";

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Runs an editing command against whatever had focus before the click. */
function edit(command: "undo" | "redo" | "cut" | "copy" | "delete" | "selectAll") {
  document.execCommand(command);
}

async function paste() {
  try {
    const text = await navigator.clipboard.readText();
    document.execCommand("insertText", false, text);
  } catch {
    useToasts.getState().push(`Use ${MOD}+V to paste; the browser blocks menu paste.`);
  }
}

export function toggleFullScreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

export function MenuBar({ onOpenSettings, onSignOut }: MenuBarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const zoom = useUi((state) => state.zoom);
  const setZoom = useUi((state) => state.setZoom);
  const openDialog = useUi((state) => state.openDialog);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!bar.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: "File",
      items: [
        {
          label: "Create/upload sticker pack…",
          onSelect: () => openExternal("https://support.signal.org/hc/articles/360031836512"),
        },
        { label: "Settings…", shortcut: `${MOD}+,`, onSelect: onOpenSettings },
        { type: "separator" },
        { label: "Sign out", onSelect: onSignOut },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: `${MOD}+Z`, onSelect: () => edit("undo") },
        { label: "Redo", shortcut: `${MOD}+Y`, onSelect: () => edit("redo") },
        { type: "separator" },
        { label: "Cut", shortcut: `${MOD}+X`, onSelect: () => edit("cut") },
        { label: "Copy", shortcut: `${MOD}+C`, onSelect: () => edit("copy") },
        { label: "Paste", shortcut: `${MOD}+V`, onSelect: () => void paste() },
        {
          label: "Paste and Match Style",
          shortcut: `${MOD}+Shift+V`,
          onSelect: () => void paste(),
        },
        { label: "Delete", onSelect: () => edit("delete") },
        { label: "Select All", shortcut: `${MOD}+A`, onSelect: () => edit("selectAll") },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Actual Size", shortcut: `${MOD}+0`, onSelect: () => setZoom(1) },
        { label: "Zoom In", shortcut: `${MOD}+=`, onSelect: () => setZoom(nextZoom(zoom, 1)) },
        { label: "Zoom Out", shortcut: `${MOD}+-`, onSelect: () => setZoom(nextZoom(zoom, -1)) },
        { type: "separator" },
        { label: "Toggle Full Screen", shortcut: "F11", onSelect: toggleFullScreen },
        { type: "separator" },
        { label: "Debug Log", onSelect: () => openDialog("debug-log") },
      ],
    },
    {
      label: "Window",
      items: [{ label: "Minimize", shortcut: `${MOD}+M`, disabled: true }],
    },
    {
      label: "Help",
      items: [
        {
          label: "Show Keyboard Shortcuts",
          shortcut: `${MOD}+/`,
          onSelect: () => openDialog("shortcuts"),
        },
        { type: "separator" },
        { label: "Contact Us", onSelect: () => openExternal("https://support.signal.org/hc/requests/new") },
        {
          label: "Go to Release Notes",
          onSelect: () => openExternal("https://github.com/signalapp/Signal-Desktop/releases"),
        },
        { label: "Go to Forums", onSelect: () => openExternal("https://community.signalusers.org/") },
        { label: "Go to Support Page", onSelect: () => openExternal("https://support.signal.org/") },
        {
          label: "Join the Beta",
          onSelect: () => openExternal("https://support.signal.org/hc/articles/360007318471"),
        },
        { type: "separator" },
        { label: "About Signal Desktop", onSelect: () => openDialog("about") },
      ],
    },
  ];

  return (
    <div
      ref={bar}
      role="menubar"
      className="relative z-50 hidden h-[26px] shrink-0 items-center gap-0.5 bg-surface-rail px-1.5 md:flex"
    >
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === menu.label}
            // Keep focus in the composer so Edit commands act on it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open && setOpen(menu.label)}
            className={`rounded px-2 py-[3px] text-[12px] text-ink transition-colors ${
              open === menu.label ? "bg-surface-hover" : "hover:bg-surface-hover"
            }`}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <div className="absolute left-0 top-full mt-0.5 min-w-[230px]">
              <MenuPanel items={menu.items} onClose={() => setOpen(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
