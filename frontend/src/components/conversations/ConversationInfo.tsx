"use client";

/**
 * Right-hand details panel.
 *
 * For a group: members with role badges, and the admin controls. For a
 * direct thread: the contact sheet with the simulated safety number.
 */

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { CloseIcon, GroupIcon, LockIcon, TimerIcon } from "@/components/ui/Icons";
import { durationLabel, presenceLabel } from "@/lib/format";
import { userApi } from "@/lib/endpoints";
import type { ConversationDetail } from "@/lib/types";

type ConversationInfoProps = {
  conversation: ConversationDetail;
  currentUserId: string;
  onClose: () => void;
};

export function ConversationInfo({
  conversation,
  currentUserId,
  onClose,
}: ConversationInfoProps) {
  const isGroup = conversation.type === "group";
  const amAdmin = conversation.my_role === "admin";
  const activeMembers = conversation.members.filter((m) => m.is_active);

  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);

  useEffect(() => {
    if (isGroup || !conversation.peer) return;
    let cancelled = false;
    userApi
      .safetyNumber(conversation.peer.id)
      .then((result) => {
        if (!cancelled) setSafetyNumber(result.safety_number);
      })
      .catch(() => setSafetyNumber(null));
    return () => {
      cancelled = true;
    };
  }, [conversation.peer, isGroup]);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-surface-raised lg:w-[300px]">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="flex-1 text-[15px] font-semibold text-ink">
          {isGroup ? "Group info" : "Contact info"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-hover hover:text-ink"
          aria-label="Close details"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <Avatar
            name={conversation.title}
            colorKey={conversation.avatar_color}
            url={conversation.avatar_url}
            size={88}
          />
          <h3 className="mt-2 text-[17px] font-semibold text-ink">
            {conversation.title}
          </h3>
          {isGroup ? (
            <p className="text-[13px] text-ink-2">
              {activeMembers.length} members
              {conversation.description ? ` · ${conversation.description}` : ""}
            </p>
          ) : (
            conversation.peer && (
              <>
                <p className="text-[13px] text-ink-2">
                  {conversation.peer.phone_number}
                </p>
                <p className="text-[12px] text-ink-3">
                  {presenceLabel(
                    conversation.peer.is_online,
                    conversation.peer.last_seen_at,
                  )}
                </p>
                {conversation.peer.about && (
                  <p className="mt-1 text-[13px] text-ink-2">
                    {conversation.peer.about}
                  </p>
                )}
              </>
            )
          )}
        </div>

        <Section title="Conversation">
          <InfoRow
            icon={<TimerIcon size={15} />}
            label="Disappearing messages"
            value={durationLabel(conversation.disappearing_seconds)}
          />
          <InfoRow
            icon={<LockIcon size={15} />}
            label="Encryption"
            value="Simulated"
          />
          {isGroup && (
            <InfoRow
              icon={<GroupIcon size={15} />}
              label="Your role"
              value={amAdmin ? "Admin" : "Member"}
            />
          )}
        </Section>

        {isGroup ? (
          <Section title={`${activeMembers.length} members`}>
            {activeMembers.map((member) => (
              <div key={member.user.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar
                  name={member.user.display_name}
                  colorKey={member.user.avatar_color}
                  url={member.user.avatar_url}
                  size={34}
                  online={member.user.is_online}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink">
                    {member.user.id === currentUserId
                      ? "You"
                      : member.user.display_name}
                  </div>
                  <div className="truncate text-[12px] text-ink-3">
                    {member.user.username ? `@${member.user.username}` : member.user.phone_number}
                  </div>
                </div>
                {member.role === "admin" && (
                  <span className="shrink-0 rounded-full bg-ultramarine-soft px-2 py-0.5 text-[11px] font-medium text-ultramarine">
                    Admin
                  </span>
                )}
              </div>
            ))}

            {amAdmin ? (
              <p className="px-4 py-3 text-[12px] text-ink-3">
                You can add and remove members, and promote others to admin.
              </p>
            ) : (
              <p className="px-4 py-3 text-[12px] text-ink-3">
                Only an admin can add or remove members.
              </p>
            )}
          </Section>
        ) : (
          <Section title="Safety number">
            <div className="px-4 py-3">
              <p className="mb-2 text-[12px] leading-snug text-ink-2">
                Compare this with {conversation.peer?.display_name ?? "them"} to verify
                the conversation. Derived from both identity keys, not from a real key
                exchange.
              </p>
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface-sunken p-3 text-center font-mono text-[12px] leading-relaxed tracking-wide text-ink">
                {safetyNumber ?? "Loading…"}
              </pre>
            </div>
          </Section>
        )}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-2">
      <h4 className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="text-ink-3">{icon}</span>
      <span className="flex-1 text-[13px] text-ink">{label}</span>
      <span className="text-[13px] text-ink-2">{value}</span>
    </div>
  );
}
