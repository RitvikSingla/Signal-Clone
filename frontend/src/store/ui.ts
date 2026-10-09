"use client";

/**
 * Interface state that is not conversation data.
 *
 * Some of it lives only for the session (which dialog is open, whether the
 * New chat pane is showing). Some of it Signal keeps on the device, and so
 * does this: the hidden-tabs toggle, the zoom level, which stories have been
 * seen, stories you posted, call links you created, and when you accepted a
 * message request, so the "You accepted" line survives a refresh.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppDialog =
  | null
  | "shortcuts"
  | "about"
  | "debug-log"
  | "whats-new"
  | "safety-tips";

export type LocalStory = {
  id: string;
  kind: "text" | "photo";
  /** Text for a text story; a data URL for a photo story. */
  content: string;
  background: string;
  created_at: string;
};

export type CustomSticker = { url: string; emoji: string };

export type CustomStickerPack = {
  id: string;
  title: string;
  author: string;
  cover: string;
  stickers: CustomSticker[];
  created_at: string;
};

export type CallLink = {
  id: string;
  name: string;
  url: string;
  created_at: string;
};

type UiState = {
  tabsHidden: boolean;
  zoom: number;
  dialog: AppDialog;
  /** `${userId}:${conversationId}` -> ISO time the request was accepted. */
  acceptedRequests: Record<string, string>;
  viewedStories: string[];
  myStories: LocalStory[];
  callLinks: CallLink[];
  stickerPacks: CustomStickerPack[];
  /** Set once the browser has granted the microphone, so Signal's own
   *  "Allow Access" step is not shown again. */
  micAllowed: boolean;
  stickerCreatorOpen: boolean;

  toggleTabs: () => void;
  setZoom: (zoom: number) => void;
  openDialog: (dialog: AppDialog) => void;
  markAccepted: (userId: string, conversationId: string) => void;
  markStoryViewed: (id: string) => void;
  addStory: (story: LocalStory) => void;
  addCallLink: (link: CallLink) => void;
  addStickerPack: (pack: CustomStickerPack) => void;
  setMicAllowed: (allowed: boolean) => void;
  setStickerCreatorOpen: (open: boolean) => void;
};

const ZOOM_STEPS = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

export function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex((step) => Math.abs(step - current) < 0.001);
  const from = index === -1 ? ZOOM_STEPS.indexOf(1) : index;
  const to = Math.min(ZOOM_STEPS.length - 1, Math.max(0, from + direction));
  return ZOOM_STEPS[to];
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      tabsHidden: false,
      zoom: 1,
      dialog: null,
      acceptedRequests: {},
      viewedStories: [],
      myStories: [],
      callLinks: [],
      stickerPacks: [],
      micAllowed: false,
      stickerCreatorOpen: false,

      toggleTabs: () => set((state) => ({ tabsHidden: !state.tabsHidden })),
      setZoom: (zoom) => set({ zoom }),
      openDialog: (dialog) => set({ dialog }),
      markAccepted: (userId, conversationId) =>
        set((state) => ({
          acceptedRequests: {
            ...state.acceptedRequests,
            [`${userId}:${conversationId}`]: new Date().toISOString(),
          },
        })),
      markStoryViewed: (id) =>
        set((state) =>
          state.viewedStories.includes(id)
            ? state
            : { viewedStories: [...state.viewedStories, id] },
        ),
      addStory: (story) => set((state) => ({ myStories: [...state.myStories, story] })),
      addCallLink: (link) => set((state) => ({ callLinks: [link, ...state.callLinks] })),
      addStickerPack: (pack) => set((state) => ({ stickerPacks: [...state.stickerPacks, pack] })),
      setMicAllowed: (micAllowed) => set({ micAllowed }),
      setStickerCreatorOpen: (stickerCreatorOpen) => set({ stickerCreatorOpen }),
    }),
    {
      name: "signal-ui",
      storage: createJSONStorage(() => localStorage),
      // Dialogs are per session; everything else is a device preference.
      partialize: (state) => ({
        tabsHidden: state.tabsHidden,
        zoom: state.zoom,
        acceptedRequests: state.acceptedRequests,
        viewedStories: state.viewedStories,
        myStories: state.myStories,
        callLinks: state.callLinks,
        stickerPacks: state.stickerPacks,
        micAllowed: state.micAllowed,
      }),
    },
  ),
);

/** Stories expire after a day, as Signal's do. */
export function liveStories(stories: LocalStory[], now: number): LocalStory[] {
  return stories.filter((story) => now - new Date(story.created_at).getTime() < 86_400_000);
}
