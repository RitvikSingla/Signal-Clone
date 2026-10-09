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

import { useToasts } from "@/components/ui/Toasts";

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
  MoreIcon,
  PencilIcon,
  PersonIcon,
  PhoneIcon,
  SlidersIcon,
} from "@/components/ui/Icons";
import { userApi } from "@/lib/endpoints";
import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { useSession } from "@/store/session";
import type { UserPrivate } from "@/lib/types";

export type SectionId =
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

export function SettingsPane({
  user,
  section,
  onSectionChange: setSection,
}: {
  user: UserPrivate;
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
}) {
  return (
    <>
      <SidePane>
        <PaneHeader title="Settings" />

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <button
            type="button"
            onClick={() => setSection("profile")}
            aria-current={section === "profile" ? "true" : undefined}
            className={`mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
              section === "profile" ? "bg-surface-selected" : "hover:bg-surface-hover"
            }`}
          >
            <Avatar
              name={user.display_name}
              colorKey={user.avatar_color}
              url={user.avatar_url}
              size={36}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {user.display_name}
              </span>
              <span className="block truncate text-[12px] text-ink-2">
                {formatPhone(user.phone_number)}
              </span>
            </span>
          </button>

          <nav className="mt-2 flex flex-col gap-0.5">
            {PRIMARY.map((entry) => (
              <NavRow
                key={entry.id}
                entry={entry}
                active={section === entry.id}
                onSelect={setSection}
              />
            ))}
          </nav>

          <div className="my-2" />

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
      className={`flex items-center gap-3 rounded-lg px-3 py-[7px] text-left text-[13px] transition-colors ${
        active
          ? "bg-surface-selected text-ink"
          : "text-ink hover:bg-surface-hover"
      }`}
    >
      <span className="shrink-0 text-ink [&_svg]:size-[18px]">{entry.icon}</span>
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
  if (id === "chats") return <ChatsSection />;

  const copy: Record<string, { title: string; body: string }> = {
    donate: {
      title: "Donate to Signal",
      body: "Signal is funded by donations rather than advertising. This screen is a placeholder in this build.",
    },
    general: {
      title: "General",
      body: "Start on login, minimise to the tray, spell check and language. Placeholders in this build.",
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
    <div className="mx-auto w-full max-w-[640px] px-6 py-5">
      <h2 className="mb-5 text-center text-[14px] font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

/** +919812345601 -> 098123 45601, the grouping Signal shows under the name. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+91") && digits.length === 12) {
    const local = digits.slice(2);
    return `0${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return phone;
}

function ComingSoonChip() {
  return (
    <span className="mt-4 inline-block rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
      Coming soon
    </span>
  );
}

function ProfileSection({ user }: { user: UserPrivate }) {
  const push = useToasts((state) => state.push);
  const patchUser = useSession((state) => state.patchUser);
  const [editing, setEditing] = useState<null | "name" | "about">(null);

  return (
    <Shell title="Profile">
      <div className="flex flex-col items-center">
        <Avatar
          name={user.display_name}
          colorKey={user.avatar_color}
          url={user.avatar_url}
          size={80}
        />
        <button
          type="button"
          onClick={() => push("Profile photos are a placeholder in this build.")}
          className="mt-2.5 rounded-full bg-surface-chip px-3 py-1 text-[12px] font-semibold text-ink transition hover:brightness-110"
        >
          Edit photo
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl bg-surface-raised">
        {editing ? (
          <InlineEditor
            label={editing === "name" ? "Your name" : "About"}
            initial={editing === "name" ? user.display_name : (user.about ?? "")}
            onCancel={() => setEditing(null)}
            onSave={async (value) => {
              try {
                const updated = await userApi.updateProfile(
                  editing === "name" ? { display_name: value } : { about: value },
                );
                patchUser(updated);
                setEditing(null);
              } catch {
                push("Could not save your profile. Try again.");
              }
            }}
          />
        ) : (
          <>
            <FieldRow icon={<PersonIcon />} value={user.display_name} onClick={() => setEditing("name")} />
            <FieldRow icon={<PencilIcon />} value={user.about || "About"} onClick={() => setEditing("about")} />
          </>
        )}
      </div>
      <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-ink-2">
        Your profile and changes to it will be visible to people you message, contacts and
        groups.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl bg-surface-raised">
        <FieldRow
          icon={<AtIcon />}
          value={user.username ? user.username : "Username"}
          trailing={<MoreIcon size={16} className="rotate-90 text-ink-2" />}
          onClick={() => push("Changing your username is a placeholder in this build.")}
        />
      </div>
      <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-ink-2">
        People can now message you using your optional username so you don&rsquo;t have to
        give out your phone number.
      </p>
    </Shell>
  );
}

function InlineEditor({
  label,
  initial,
  onCancel,
  onSave,
}: {
  label: string;
  initial: string;
  onCancel: () => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2 p-3">
      <label className="text-[12px] font-semibold text-ink-2">{label}</label>
      <input
        autoFocus
        value={value}
        maxLength={label === "About" ? 140 : 26}
        onChange={(event) => setValue(event.target.value)}
        className="h-9 rounded-lg bg-surface-sunken px-3 text-[13px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-full bg-surface-chip px-4 text-[12.5px] font-semibold text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || (label !== "About" && !value.trim())}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(value.trim());
            } finally {
              setBusy(false);
            }
          }}
          className="h-8 rounded-full bg-ultramarine px-4 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  icon,
  value,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  value: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span className="shrink-0 text-ink [&_svg]:size-[17px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{value}</span>
      {trailing}
    </button>
  );
}

function ChatsSection() {
  const push = useToasts((state) => state.push);
  const [folders, setFolders] = useState<string[]>([]);
  const presets = ["Unread", "Direct chats", "Groups"];
  return (
    <Shell title="Chats">
      <Group>
        <Row label="Generate link previews" hint="Placeholder">
          <Toggle on />
        </Row>
        <Row label="Use system emoji" hint="Placeholder">
          <Toggle on={false} />
        </Row>
      </Group>

      <h3 className="mb-2 mt-7 px-1 text-[13px] font-semibold text-ink">Chat folders</h3>
      <p className="mb-3 px-1 text-[12px] leading-relaxed text-ink-2">
        Organise your chats into folders and quickly switch between them on your chat list.
      </p>
      <Group>
        <Row label="All chats">
          <span className="text-[12px] text-ink-2">Default</span>
        </Row>
        {folders.map((folder) => (
          <Row key={folder} label={folder}>
            <span className="text-[12px] text-ink-2">Folder</span>
          </Row>
        ))}
      </Group>

      {folders.length < presets.length && (
        <>
          <h3 className="mb-2 mt-6 px-1 text-[12px] font-semibold text-ink-2">Suggested folders</h3>
          <Group>
            {presets
              .filter((preset) => !folders.includes(preset))
              .map((preset) => (
                <Row key={preset} label={preset}>
                  <button
                    type="button"
                    onClick={() => {
                      setFolders((current) => [...current, preset]);
                      push(`“${preset}” folder added`);
                    }}
                    className="h-7 rounded-full bg-surface-chip px-3 text-[12px] font-semibold text-ink hover:brightness-110"
                  >
                    Add
                  </button>
                </Row>
              ))}
          </Group>
        </>
      )}
    </Shell>
  );
}

function AppearanceSection() {
  const theme = useTheme();
  return (
    <Shell title="Appearance">
      <Group>
        <Row label="Theme">
          <select
            value={theme}
            onChange={(event) => applyTheme(event.target.value as Theme)}
            aria-label="Theme"
            className="h-8 rounded-md bg-surface-chip px-2.5 text-[13px] text-ink outline-none focus:ring-2 focus:ring-ultramarine"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Row>
        <Row label="Chat colour" hint="Placeholder">
          <span className="size-5 rounded-full bg-ultramarine" aria-hidden />
        </Row>
      </Group>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
        Dark is the default. The choice is stored in this browser and applied before
        the first paint, so it survives a refresh. System follows your operating
        system.
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
    <div className="divide-y divide-border overflow-hidden rounded-xl bg-surface-raised">
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
        <div className="text-[13px] text-ink">{label}</div>
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
