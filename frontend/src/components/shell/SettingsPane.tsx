"use client";

/**
 * Settings, as a two-pane screen.
 *
 * Matching the real app: the left column becomes a settings navigator with
 * the profile card pinned at the top, and the right column shows the
 * selected section. Profile and Appearance do real work; the rest are the
 * placeholders the brief asks for, drawn as real controls so the shape of
 * the product is visible.
 */

import { useState, type ReactNode } from "react";

import { PaneHeader, SidePane } from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import {
  AccountIcon,
  AppearanceIcon,
  AtIcon,
  BackupIcon,
  BellIcon,
  ChatIcon,
  DataIcon,
  HeartIcon,
  LockIcon,
  PencilIcon,
  PersonIcon,
  PhoneIcon,
  SlidersIcon,
} from "@/components/ui/Icons";
import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { useSession } from "@/store/session";
import type { UserPrivate } from "@/lib/types";

type SectionId =
  | "profile"
  | "account"
  | "donate"
  | "general"
  | "appearance"
  | "chats"
  | "calls"
  | "notifications"
  | "privacy"
  | "data"
  | "backups";

type NavEntry = { id: SectionId; label: string; icon: ReactNode };

/** Two groups, separated by a rule, exactly as the real navigator is. */
const PRIMARY: NavEntry[] = [
  { id: "account", label: "Account", icon: <AccountIcon /> },
  { id: "donate", label: "Donate to Signal", icon: <HeartIcon /> },
];

const SECONDARY: NavEntry[] = [
  { id: "general", label: "General", icon: <SlidersIcon /> },
  { id: "appearance", label: "Appearance", icon: <AppearanceIcon /> },
  { id: "chats", label: "Chats", icon: <ChatIcon size={20} /> },
  { id: "calls", label: "Calls", icon: <PhoneIcon size={20} /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon /> },
  { id: "privacy", label: "Privacy", icon: <LockIcon size={20} /> },
  { id: "data", label: "Data usage", icon: <DataIcon /> },
  { id: "backups", label: "Backups", icon: <BackupIcon /> },
];

export function SettingsPane({ user }: { user: UserPrivate }) {
  const [section, setSection] = useState<SectionId>("profile");

  return (
    <>
      <SidePane>
        <PaneHeader title="Settings" />

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <button
            type="button"
            onClick={() => setSection("profile")}
            aria-current={section === "profile" ? "true" : undefined}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
              section === "profile" ? "bg-surface-sunken" : "hover:bg-surface-hover"
            }`}
          >
            <Avatar
              name={user.display_name}
              colorKey={user.avatar_color}
              url={user.avatar_url}
              size={44}
            />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-ink">
                {user.display_name}
              </span>
              <span className="block truncate text-[13px] text-ink-2">
                {user.phone_number}
              </span>
            </span>
          </button>

          <nav className="mt-3 flex flex-col gap-0.5">
            {PRIMARY.map((entry) => (
              <NavRow
                key={entry.id}
                entry={entry}
                active={section === entry.id}
                onSelect={setSection}
              />
            ))}
          </nav>

          <hr className="my-3 border-border" />

          <nav className="flex flex-col gap-0.5">
            {SECONDARY.map((entry) => (
              <NavRow
                key={entry.id}
                entry={entry}
                active={section === entry.id}
                onSelect={setSection}
              />
            ))}
          </nav>
        </div>
      </SidePane>

      <section className="min-w-0 flex-1 overflow-y-auto bg-surface">
        <SectionContent id={section} user={user} />
      </section>
    </>
  );
}

function NavRow({
  entry,
  active,
  onSelect,
}: {
  entry: NavEntry;
  active: boolean;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
        active
          ? "bg-surface-sunken text-ink"
          : "text-ink hover:bg-surface-hover"
      }`}
    >
      <span className="shrink-0 text-ink-2">{entry.icon}</span>
      {entry.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Right-hand content
// ---------------------------------------------------------------------------

function SectionContent({ id, user }: { id: SectionId; user: UserPrivate }) {
  if (id === "profile") return <ProfileSection user={user} />;
  if (id === "appearance") return <AppearanceSection />;
  if (id === "privacy") return <PrivacySection user={user} />;
  if (id === "notifications") return <NotificationsSection />;
  if (id === "account") return <AccountSection user={user} />;

  const copy: Record<string, { title: string; body: string }> = {
    donate: {
      title: "Donate to Signal",
      body: "Signal is funded by donations rather than advertising. This screen is a placeholder in this build.",
    },
    general: {
      title: "General",
      body: "Start on login, minimise to the tray, spell check and language. Placeholders in this build.",
    },
    chats: {
      title: "Chats",
      body: "Message trimming, link previews and chat colours. Placeholders in this build.",
    },
    calls: {
      title: "Calls",
      body: "Call relaying, camera and microphone selection. Calling itself is a placeholder in this build.",
    },
    data: {
      title: "Data usage",
      body: "Automatic media download limits for photos, audio, video and documents. Placeholder in this build.",
    },
    backups: {
      title: "Backups",
      body: "Local encrypted backups and restore. Placeholder in this build.",
    },
  };

  const section = copy[id];
  return (
    <Shell title={section.title}>
      <p className="text-[14px] leading-relaxed text-ink-2">{section.body}</p>
      <ComingSoonChip />
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-7">
      <h2 className="mb-6 text-center text-[16px] font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function ComingSoonChip() {
  return (
    <span className="mt-4 inline-block rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
      Coming soon
    </span>
  );
}

function ProfileSection({ user }: { user: UserPrivate }) {
  const push = useSession((state) => state.patchUser);
  void push;

  return (
    <Shell title="Profile">
      <div className="flex flex-col items-center">
        <Avatar
          name={user.display_name}
          colorKey={user.avatar_color}
          url={user.avatar_url}
          size={96}
        />
        <button
          type="button"
          className="mt-3 rounded-full bg-surface-sunken px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover"
        >
          Edit photo
        </button>
      </div>

      <div className="mt-8 flex flex-col">
        <FieldRow icon={<PersonIcon />} value={user.display_name} />
        <FieldRow icon={<PencilIcon />} value={user.about || "About"} />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          Your profile and changes to it will be visible to people you message,
          contacts and groups.
        </p>
      </div>

      <hr className="my-6 border-border" />

      <div className="flex flex-col">
        <FieldRow
          icon={<AtIcon />}
          value={user.username ? `@${user.username}` : "Username"}
        />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          People can now message you using your optional username so you do not have
          to give out your phone number.
        </p>
      </div>
    </Shell>
  );
}

function FieldRow({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-4 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="shrink-0 text-ink-2">{icon}</span>
      <span className="truncate text-[15px] text-ink">{value}</span>
    </button>
  );
}

function AppearanceSection() {
  const theme = useTheme();
  return (
    <Shell title="Appearance">
      <Group>
        <Row label="Theme">
          <div className="flex gap-1 rounded-full bg-surface-sunken p-1">
            {(["system", "light", "dark"] as Theme[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyTheme(option)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                  theme === option
                    ? "bg-ultramarine text-white"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Chat colour" hint="Placeholder">
          <span className="size-5 rounded-full bg-ultramarine" aria-hidden />
        </Row>
      </Group>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
        The theme is stored in this browser and applied before the app renders, so
        it survives a refresh. System follows your operating system.
      </p>
    </Shell>
  );
}

function PrivacySection({ user }: { user: UserPrivate }) {
  return (
    <Shell title="Privacy">
      <Group>
        <Row label="Read receipts" hint="Placeholder">
          <Toggle on />
        </Row>
        <Row label="Typing indicators" hint="Placeholder">
          <Toggle on />
        </Row>
        <Row
          label="Safety number"
          hint={`Your identity key ends ${user.identity_key.slice(-8)}`}
        >
          <span className="text-[12px] text-ink-3">Per contact</span>
        </Row>
        <Row label="Disappearing messages" hint="Set per conversation">
          <span className="text-[12px] text-ink-3">Off by default</span>
        </Row>
      </Group>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
        Encryption in this build is simulated. Each account carries a random
        identity key and each message a derived envelope hash, but there is no key
        agreement and no ratchet.
      </p>
    </Shell>
  );
}

function NotificationsSection() {
  return (
    <Shell title="Notifications">
      <Group>
        <Row label="Message notifications" hint="Placeholder">
          <Toggle on />
        </Row>
        <Row label="Show message preview" hint="Placeholder">
          <Toggle on />
        </Row>
        <Row label="Play notification sound" hint="Placeholder">
          <Toggle on={false} />
        </Row>
      </Group>
      <ComingSoonChip />
    </Shell>
  );
}

function AccountSection({ user }: { user: UserPrivate }) {
  const signOut = useSession((state) => state.signOut);
  return (
    <Shell title="Account">
      <Group>
        <Row label="Phone number">
          <span className="text-[13px] text-ink-2">{user.phone_number}</span>
        </Row>
        <Row label="Username">
          <span className="text-[13px] text-ink-2">
            {user.username ? `@${user.username}` : "Not set"}
          </span>
        </Row>
        <Row label="Registration id" hint="Part of the simulated key material">
          <span className="font-mono text-[13px] text-ink-2">
            {user.registration_id}
          </span>
        </Row>
        <Row label="This device" hint="Primary">
          <span className="text-[12px] text-ink-3">Active now</span>
        </Row>
        <Row label="Link a new device" hint="Coming soon">
          <span className="text-[12px] text-ink-3">Placeholder</span>
        </Row>
      </Group>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-7 h-10 w-full rounded-full border border-danger text-[14px] font-medium text-danger transition-colors hover:bg-danger hover:text-white"
      >
        Sign out
      </button>
    </Shell>
  );
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {children}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-ink">{label}</div>
        {hint && <div className="text-[12px] text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-[22px] w-[38px] shrink-0 items-center rounded-full px-0.5 ${
        on ? "justify-end bg-ultramarine" : "justify-start bg-border-strong"
      }`}
      aria-hidden
    >
      <span className="size-[18px] rounded-full bg-white" />
    </span>
  );
}
