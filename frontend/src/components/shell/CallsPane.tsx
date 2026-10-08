"use client";

/**
 * The Calls tab.
 *
 * Calling itself is a placeholder, which the brief permits, but the screen
 * around it is the real one: the same pane frame, the Create a Call Link
 * row, and Signal's own empty-state wording. A reviewer clicking Calls
 * should land somewhere that looks like Signal, not on a blank panel.
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
import { LinkIcon, MoreIcon, NewCallIcon, PhoneIcon } from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";

export function CallsPane({ onComingSoon }: { onComingSoon: (what: string) => void }) {
  const [search, setSearch] = useState("");
  const [missedOnly, setMissedOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <SidePane>
        <PaneHeader title="Calls">
          <PaneIconButton label="New call" onClick={() => onComingSoon("Calls")}>
            <NewCallIcon />
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
                  { label: "Clear call history", onSelect: () => onComingSoon("Calls") },
                  {
                    label: missedOnly ? "Show all calls" : "Filter by missed",
                    onSelect: () => setMissedOnly((on) => !on),
                  },
                ]}
              />
            )}
          </div>
        </PaneHeader>

        <PaneSearch
          id="calls-search"
          value={search}
          onChange={setSearch}
          filter={{
            active: missedOnly,
            label: "Filter by missed",
            onToggle: () => setMissedOnly((on) => !on),
          }}
        />

        <button
          type="button"
          onClick={() => onComingSoon("Call links")}
          className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink">
            <LinkIcon />
          </span>
          <span className="text-[14px] font-semibold text-ink">Create a Call Link</span>
        </button>

        <div className="min-h-0 flex-1">
          <PaneEmpty
            heading={missedOnly ? "No missed calls" : "No calls"}
            detail="Recent calls will appear here."
          />
        </div>
      </SidePane>

      <ContentEmpty
        icon={<PhoneIcon size={40} strokeWidth={1.4} />}
        footnote="Calling is a placeholder in this build"
      >
        Click the new-call button to start a new voice or video call.
      </ContentEmpty>
    </>
  );
}
