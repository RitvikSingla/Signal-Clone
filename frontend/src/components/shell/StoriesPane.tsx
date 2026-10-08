"use client";

/**
 * The Stories tab.
 *
 * Another permitted placeholder, built as the real screen: the My Story row
 * at the top, Signal's empty-state wording, and no filter button beside the
 * search field, which is how the real pane differs from Calls and Chats.
 */

import { useState } from "react";

import {
  ContentEmpty,
  PaneEmpty,
  PaneHeader,
  PaneIconButton,
  PaneSearch,
  SidePane,
} from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import { MoreIcon, PlusIcon, StoriesIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import type { UserPrivate } from "@/lib/types";

export function StoriesPane({
  user,
  onComingSoon,
}: {
  user: UserPrivate;
  onComingSoon: (what: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <SidePane>
        <PaneHeader title="Stories">
          <PaneIconButton label="Add a story" onClick={() => onComingSoon("Stories")}>
            <PlusIcon />
          </PaneIconButton>
          <div className="relative">
            <PaneIconButton
              label="More options"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreIcon />
            </PaneIconButton>
            {menuOpen && (
              <Menu
                align="right"
                onClose={() => setMenuOpen(false)}
                items={[
                  { label: "Story privacy", onSelect: () => onComingSoon("Stories") },
                  { label: "Turn off stories", onSelect: () => onComingSoon("Stories") },
                ]}
              />
            )}
          </div>
        </PaneHeader>

        <PaneSearch id="stories-search" value={search} onChange={setSearch} />

        <button
          type="button"
          onClick={() => onComingSoon("Stories")}
          className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="relative shrink-0">
            <Avatar
              name={user.display_name}
              colorKey={user.avatar_color}
              url={user.avatar_url}
              size={44}
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-surface-raised bg-ultramarine text-white">
              <PlusIcon size={11} strokeWidth={3} />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-ink">My Story</span>
            <span className="block text-[13px] text-ink-2">Add a story</span>
          </span>
        </button>

        <div className="min-h-0 flex-1">
          <PaneEmpty heading="No stories" detail="New updates will appear here." />
        </div>
      </SidePane>

      <ContentEmpty
        icon={<StoriesIcon size={40} strokeWidth={1.4} />}
        footnote="Stories are a placeholder in this build"
      >
        Click the plus button to add an update.
      </ContentEmpty>
    </>
  );
}
