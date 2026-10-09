"use client";

/**
 * The Stories tab.
 *
 * Built as the real screen: My Story at the top (its plus badge and the
 * header's plus both offer "Photo or video" and "Text story"), Signal's own
 * onboarding story under it with a thumbnail, and "Click to view a story" in
 * the empty right pane. Opening a story takes over the window with Signal's
 * viewer: a portrait card, segmented progress, pause and mute, arrows either
 * side and a close button.
 *
 * Stories you post are kept on this device and expire after 24 hours.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  ContentEmpty,
  PaneHeader,
  PaneIconButton,
  PaneSearch,
  SidePane,
} from "@/components/shell/SidePane";
import { Avatar } from "@/components/ui/Avatar";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  StoriesIcon,
  VerifiedIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "@/components/ui/Icons";
import { Menu } from "@/components/ui/Menu";
import { useToasts } from "@/components/ui/Toasts";
import { useNow } from "@/hooks/useNow";
import type { UserPrivate } from "@/lib/types";
import { liveStories, useUi, type LocalStory } from "@/store/ui";

export const ONBOARDING_STORY_ID = "signal-onboarding";

const SLIDE_MS = 5500;

const TEXT_BACKGROUNDS = [
  "linear-gradient(160deg,#2c6bed,#6d3fd8)",
  "linear-gradient(160deg,#f05d23,#e8404a)",
  "linear-gradient(160deg,#0f9d8a,#2c6bed)",
  "linear-gradient(160deg,#3b3b3b,#121212)",
  "#c6632f",
  "#a8519b",
];

type Slide = { key: string; render: () => ReactNode; at: string };

export function StoriesPane({
  user,
  onComingSoon,
}: {
  user: UserPrivate;
  onComingSoon: (what: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<null | "header" | "row" | "more">(null);
  const [viewing, setViewing] = useState<null | "signal" | "mine">(null);
  const [creating, setCreating] = useState<null | "text">(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const now = useNow();
  const myStories = liveStories(useUi((state) => state.myStories), now);
  const viewed = useUi((state) => state.viewedStories);
  const addStory = useUi((state) => state.addStory);
  const markViewed = useUi((state) => state.markStoryViewed);
  const push = useToasts((state) => state.push);

  const signalSeen = viewed.includes(ONBOARDING_STORY_ID);
  const signalAt = onboardingTime();
  const needle = search.trim().toLowerCase();
  const showSignal = !needle || "signal".includes(needle);
  const showMine = !needle || "my story".includes(needle);

  const addItems = [
    {
      label: "Photo or video",
      onSelect: () => requestAnimationFrame(() => fileInput.current?.click()),
    },
    { label: "Text story", onSelect: () => setCreating("text") },
  ];

  function onPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      onComingSoon("Video stories");
      return;
    }
    if (file.size > 3_000_000) {
      push("That photo is too large for a story in this build (3 MB max).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addStory({
        id: crypto.randomUUID(),
        kind: "photo",
        content: String(reader.result),
        background: "#000",
        created_at: new Date().toISOString(),
      });
      push("Story posted");
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <SidePane>
        <PaneHeader title="Stories">
          <div className="relative">
            <PaneIconButton
              label="Add a story"
              active={menu === "header"}
              onClick={() => setMenu(menu === "header" ? null : "header")}
            >
              <PlusIcon size={18} strokeWidth={1.8} />
            </PaneIconButton>
            {menu === "header" && (
              <Menu align="left" items={addItems} onClose={() => setMenu(null)} />
            )}
          </div>
          <div className="relative">
            <PaneIconButton
              label="More options"
              active={menu === "more"}
              onClick={() => setMenu(menu === "more" ? null : "more")}
            >
              <MoreIcon size={17} />
            </PaneIconButton>
            {menu === "more" && (
              <Menu
                align="right"
                onClose={() => setMenu(null)}
                items={[{ label: "Story privacy", onSelect: () => onComingSoon("Story privacy settings") }]}
              />
            )}
          </div>
        </PaneHeader>

        <PaneSearch id="stories-search" value={search} onChange={setSearch} />

        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {showMine && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  myStories.length ? setViewing("mine") : setMenu(menu === "row" ? null : "row")
                }
                className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="relative shrink-0">
                  <span
                    className={`block rounded-full ${myStories.length ? "p-[2px] ring-2 ring-ink-3" : ""}`}
                  >
                    <Avatar
                      name={user.display_name}
                      colorKey={user.avatar_color}
                      url={user.avatar_url}
                      size={myStories.length ? 36 : 40}
                    />
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-surface-raised bg-ultramarine text-white">
                    <PlusIcon size={9} strokeWidth={3.5} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">My Story</span>
                  <span className="block text-[12px] text-ink-2">
                    {myStories.length
                      ? `${myStories.length} ${myStories.length === 1 ? "story" : "stories"} · ${ago(myStories.at(-1)!.created_at, now)}`
                      : "Add a story"}
                  </span>
                </span>
                {myStories.length > 0 && <StoryThumb story={myStories.at(-1)!} />}
              </button>
              {menu === "row" && (
                <div className="absolute left-14 top-full z-40">
                  <Menu align="left" placement="below" items={addItems} onClose={() => setMenu(null)} />
                </div>
              )}
            </div>
          )}

          {showSignal && (
            <button
              type="button"
              onClick={() => setViewing("signal")}
              className="mx-2 mt-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <span
                className={`block shrink-0 rounded-full p-[2px] ring-2 ${
                  signalSeen ? "ring-ink-3/60" : "ring-ultramarine"
                }`}
              >
                <SignalAvatar size={36} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                  Signal <VerifiedIcon size={13} />
                </span>
                {signalSeen && (
                  <span className="block text-[12px] text-ink-2">{ago(signalAt, now)}</span>
                )}
              </span>
              <span className="h-[52px] w-[34px] shrink-0 overflow-hidden rounded-md bg-[#f2f2f2] p-[3px] shadow">
                <span className="block h-full w-full rounded-[3px] bg-[#2c6bed] [background:linear-gradient(160deg,#4b81f2,#2c6bed)]" />
              </span>
            </button>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPhoto(file);
            event.target.value = "";
          }}
        />
      </SidePane>

      <ContentEmpty icon={<StoriesIcon size={30} strokeWidth={1.4} />}>Click to view a story</ContentEmpty>

      {viewing === "signal" && (
        <StoryViewer
          author={{ name: "Signal", avatar: <SignalAvatar size={28} />, verified: true }}
          slides={onboardingSlides(signalAt)}
          onClose={() => {
            markViewed(ONBOARDING_STORY_ID);
            setViewing(null);
          }}
        />
      )}

      {viewing === "mine" && myStories.length > 0 && (
        <StoryViewer
          author={{
            name: "My Story",
            avatar: (
              <Avatar name={user.display_name} colorKey={user.avatar_color} url={user.avatar_url} size={28} />
            ),
            verified: false,
          }}
          slides={myStories.map((story) => ({
            key: story.id,
            at: story.created_at,
            render: () => <LocalStoryCard story={story} />,
          }))}
          onClose={() => setViewing(null)}
        />
      )}

      {creating === "text" && (
        <TextStoryComposer
          onClose={() => setCreating(null)}
          onSend={(text, background) => {
            addStory({
              id: crypto.randomUUID(),
              kind: "text",
              content: text,
              background,
              created_at: new Date().toISOString(),
            });
            setCreating(null);
            push("Story posted");
          }}
        />
      )}
    </>
  );
}

/** Signal's own account avatar: the mark on ultramarine. */
function SignalAvatar({ size }: { size: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[#2c6bed]"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 100 100" aria-hidden>
        <path
          d="M50 12C29 12 12 26.3 12 44c0 9.4 4.8 17.8 12.4 23.6l-5 17.8a1.7 1.7 0 0 0 2.4 2l21-9.1c2.4.4 4.8.6 7.2.6 21 0 38-14.3 38-32S71 12 50 12Z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

function StoryThumb({ story }: { story: LocalStory }) {
  return (
    <span
      className="h-[52px] w-[34px] shrink-0 overflow-hidden rounded-md shadow"
      style={{ background: story.background }}
    >
      {story.kind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.content} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-0.5 text-center text-[5px] font-semibold leading-tight text-white">
          {story.content.slice(0, 40)}
        </span>
      )}
    </span>
  );
}

function ago(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/** The onboarding story is stamped at the start of the local day. */
function onboardingTime(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

function StoryViewer({
  author,
  slides,
  onClose,
}: {
  author: { name: string; avatar: ReactNode; verified: boolean };
  slides: Slide[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const now = useNow();

  const next = useCallback(() => {
    setIndex((current) => {
      if (current >= slides.length - 1) {
        onClose();
        return current;
      }
      return current + 1;
    });
  }, [slides.length, onClose]);

  const previous = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
      if (event.key === " ") {
        event.preventDefault();
        setPaused((p) => !p);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, onClose]);

  const slide = slides[index];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-[#0b0b0b]/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${author.name} story`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
      >
        <CloseIcon size={20} />
      </button>

      <button
        type="button"
        onClick={previous}
        disabled={index === 0}
        aria-label="Previous story"
        className="absolute left-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:bg-white/10 disabled:opacity-0 md:left-10"
      >
        <ChevronLeftIcon size={24} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next story"
        className="absolute right-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:bg-white/10 md:right-10"
      >
        <ChevronRightIcon size={24} />
      </button>

      <div className="flex h-[min(88vh,760px)] flex-col" style={{ aspectRatio: "9 / 16" }}>
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-xl"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onMouseLeave={() => setPaused(false)}
        >
          {slide.render()}
        </div>

        <div className="mt-3 flex items-center gap-2 px-1 text-white">
          {author.avatar}
          <span className="flex items-center gap-1 text-[13px] font-semibold">
            {author.name}
            {author.verified && <VerifiedIcon size={13} />}
          </span>
          <span className="text-[12px] text-white/60">{ago(slide.at, now)}</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play" : "Pause"}
            className="flex size-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
          >
            {paused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex size-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
          >
            {muted ? <VolumeOffIcon size={17} /> : <VolumeOnIcon size={17} />}
          </button>
        </div>

        <div className="mt-2 flex gap-1 px-1">
          {slides.map((item, position) => (
            <span key={item.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              {position < index && <span className="block h-full w-full bg-white" />}
              {position === index && (
                <span
                  key={`${item.key}-${index}`}
                  className="block h-full w-full origin-left bg-white"
                  style={{
                    animation: `story-progress ${SLIDE_MS}ms linear forwards`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                  onAnimationEnd={next}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function onboardingSlides(at: string): Slide[] {
  return [
    {
      key: "intro",
      at,
      render: () => (
        <OnboardingCard
          title="Signal Stories"
          body="A new way to share photos, videos or text. Stories automatically disappear after 24 hours."
          art={
            <div className="relative mx-auto h-[150px] w-[200px]">
              <div className="absolute inset-0 rounded-[22px] bg-[linear-gradient(150deg,#4b81f2,#2c4fd6)] shadow-lg" />
              <div className="absolute left-1/2 top-3 h-[132px] w-[118px] -translate-x-1/2 overflow-hidden rounded-xl bg-[#1d1d1d] shadow-xl">
                <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(180deg,#5d4a3f,#2b2622)] text-[54px]">
                  🙋🏽‍♀️
                </div>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 h-1 rounded-full bg-white/40" />
              </div>
              <span className="absolute -left-3 -top-4 rotate-[-12deg] text-[36px]">👋</span>
            </div>
          }
        />
      ),
    },
    {
      key: "private",
      at,
      render: () => (
        <OnboardingCard
          title="Private & encrypted"
          body="Stories are end-to-end encrypted and you have complete control over who can view your stories."
          art={
            <div className="relative mx-auto h-[160px] w-[150px]">
              <div className="absolute left-2 top-3 h-[136px] w-[100px] rotate-[-8deg] rounded-xl bg-[#2c6bed] shadow-lg" />
              <div className="absolute left-7 top-1 flex h-[136px] w-[100px] rotate-[4deg] items-center justify-center rounded-xl bg-[linear-gradient(180deg,#3a3a3a,#1a1a1a)] text-[58px] shadow-xl">
                🐕
              </div>
              <span className="absolute bottom-0 right-0 text-[36px]">🤐</span>
            </div>
          }
        />
      ),
    },
  ];
}

function OnboardingCard({ title, body, art }: { title: string; body: string; art: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 bg-[#f2f2f2] px-8 text-center text-[#1b1b1b]">
      <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
      {art}
      <p className="text-[15px] leading-[1.4]">{body}</p>
    </div>
  );
}

function LocalStoryCard({ story }: { story: LocalStory }) {
  if (story.kind === "photo") {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={story.content} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <div
      className="flex h-full items-center justify-center px-8 text-center text-[26px] font-semibold leading-snug text-white"
      style={{ background: story.background }}
    >
      <span className="whitespace-pre-wrap break-words">{story.content}</span>
    </div>
  );
}

function TextStoryComposer({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (text: string, background: string) => void;
}) {
  const [text, setText] = useState("");
  const [background, setBackground] = useState(TEXT_BACKGROUNDS[0]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#0b0b0b]/95" role="dialog" aria-label="Text story">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
      >
        <CloseIcon size={20} />
      </button>
      <div className="flex h-[min(80vh,680px)] flex-col" style={{ aspectRatio: "9 / 16" }}>
        <div
          className="flex min-h-0 flex-1 items-center justify-center rounded-xl px-6"
          style={{ background }}
        >
          <textarea
            autoFocus
            value={text}
            maxLength={700}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add text"
            className="w-full resize-none bg-transparent text-center text-[26px] font-semibold leading-snug text-white outline-none placeholder:text-white/60"
            rows={4}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {TEXT_BACKGROUNDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBackground(value)}
              aria-label="Background colour"
              className={`size-6 rounded-full ${background === value ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
              style={{ background: value }}
            />
          ))}
          <span className="flex-1" />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => onSend(text.trim(), background)}
            className="h-8 rounded-full bg-ultramarine px-5 text-[13px] font-semibold text-white hover:bg-ultramarine-hover disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
