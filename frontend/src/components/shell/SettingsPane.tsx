"use client";

/**
 * Settings.
 *
 * Profile and appearance do real work. Privacy and notifications are the
 * placeholders the brief asks for, shown as real controls rather than an
 * empty screen so the shape of the product is visible.
 */

import { Avatar } from "@/components/ui/Avatar";
import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { useSession } from "@/store/session";
import type { UserPrivate } from "@/lib/types";

export function SettingsPane({ user }: { user: UserPrivate }) {
  const { signOut } = useSession();
  const theme = useTheme();

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto max-w-xl px-6 py-8">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">Settings</h2>

        <div className="mt-6 flex items-center gap-4 rounded-xl border border-border p-4">
          <Avatar
            name={user.display_name}
            colorKey={user.avatar_color}
            url={user.avatar_url}
            size={56}
          />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold text-ink">
              {user.display_name}
            </div>
            <div className="truncate text-[13px] text-ink-2">{user.phone_number}</div>
            {user.about && (
              <div className="truncate text-[13px] text-ink-3">{user.about}</div>
            )}
          </div>
        </div>

        <Group title="Appearance">
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
        </Group>

        <Group title="Privacy">
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

        <Group title="Notifications">
          <Row label="Message notifications" hint="Placeholder">
            <Toggle on />
          </Row>
          <Row label="Show message preview" hint="Placeholder">
            <Toggle on />
          </Row>
        </Group>

        <Group title="Linked devices">
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
          className="mt-8 h-10 w-full rounded-full border border-danger text-[14px] font-medium text-danger transition-colors hover:bg-danger hover:text-white"
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        {title}
      </h3>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {children}
      </div>
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
  children: React.ReactNode;
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
