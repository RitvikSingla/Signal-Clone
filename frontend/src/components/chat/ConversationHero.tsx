"use client";

/**
 * The card at the top of every thread.
 *
 * Signal opens a conversation with who this is before any messages: a large
 * avatar, the name with a chevron (which opens the details), and a few
 * facts. For someone outside your address book that is a red "Name not
 * verified" pill, the groups you share, and a Safety tips button while the
 * request is still pending. The card is outlined, not filled.
 */

import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon, GroupIcon, PersonQuestionIcon } from "@/components/ui/Icons";
import type { ConversationDetail } from "@/lib/types";

type ConversationHeroProps = {
  conversation: ConversationDetail;
  verified: boolean;
  commonGroups: string[];
  showSafetyTips: boolean;
  onOpenInfo: () => void;
  onSafetyTips: () => void;
};

export function ConversationHero({
  conversation,
  verified,
  commonGroups,
  showSafetyTips,
  onOpenInfo,
  onSafetyTips,
}: ConversationHeroProps) {
  const isGroup = conversation.type === "group";
  const activeMembers = conversation.members.filter((m) => m.is_active).length;

  return (
    <div className="flex justify-center pb-3 pt-6">
      <div className="flex min-w-[220px] max-w-[320px] flex-col items-center rounded-2xl border border-border-strong/60 px-6 pb-4 pt-4 text-center">
        <Avatar
          name={conversation.title}
          colorKey={conversation.avatar_color}
          url={conversation.avatar_url}
          size={52}
        />

        <button
          type="button"
          onClick={onOpenInfo}
          className="mt-2.5 flex items-center gap-0.5 text-[16px] font-semibold text-ink hover:underline"
        >
          {conversation.title}
          <ChevronRightIcon size={16} className="text-ink-2" />
        </button>

        {!isGroup && !verified && (
          <span className="mt-2 flex items-center gap-1 rounded-full bg-danger-soft px-2 py-[3px] text-[11px] font-semibold text-danger">
            <PersonQuestionIcon size={12} />
            Name not verified
          </span>
        )}

        {isGroup ? (
          <p className="mt-2 text-[12px] text-ink-2">
            {activeMembers} {activeMembers === 1 ? "member" : "members"}
            {conversation.description ? ` · ${conversation.description}` : ""}
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-ink">
            <GroupIcon size={13} className="shrink-0" />
            {groupsLine(commonGroups)}
          </p>
        )}

        {showSafetyTips && (
          <button
            type="button"
            onClick={onSafetyTips}
            className="mt-3 rounded-full bg-surface-chip px-3 py-1 text-[12px] font-semibold text-ink transition hover:brightness-110"
          >
            Safety tips
          </button>
        )}
      </div>
    </div>
  );
}

/** Signal's wording for shared groups. */
function groupsLine(groups: string[]): string {
  if (groups.length === 0) return "No groups in common";
  if (groups.length === 1) return `Member of ${groups[0]}`;
  if (groups.length === 2) return `Member of ${groups[0]} and ${groups[1]}`;
  return `Member of ${groups[0]}, ${groups[1]} and ${groups.length - 2} more`;
}
