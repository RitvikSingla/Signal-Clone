"use client";

/**
 * The composer's picker: Emoji, Stickers and GIFs behind three pill tabs.
 *
 * Emoji: a search field, sections headed "Smileys & People" and so on, a
 * skin tone control on the first header, and a category bar along the
 * bottom that jumps between sections. Clicking an emoji inserts it and
 * leaves the picker open, as Signal does.
 *
 * Stickers: built-in packs drawn from emoji, so they need no assets;
 * clicking one sends it straight away.
 *
 * GIFs: GIPHY search and categories when NEXT_PUBLIC_GIPHY_API_KEY is set,
 * with the "Powered by GIPHY" badge. Without a key the tab says so rather
 * than spinning forever.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { mediaUrl } from "@/lib/endpoints";
import { useUi, type CustomSticker } from "@/store/ui";

import {
  AngryIcon,
  BallIcon,
  BulbIcon,
  CarIcon,
  CelebrateIcon,
  ClockIcon,
  EmojiIcon,
  EyesIcon,
  FlagIcon,
  FoodIcon,
  HeartIcon,
  PawIcon,
  PlusIcon,
  SadIcon,
  SearchIcon,
  SkinToneIcon,
  SymbolsIcon,
  ThumbsUpIcon,
  TrendingIcon,
} from "@/components/ui/Icons";

type Tab = "emoji" | "stickers" | "gifs";

type EmojiEntry = { emoji: string; name: string; skin: boolean };
type EmojiSection = { id: string; title: string; icon: ReactNode; emojis: EmojiEntry[] };

type RawGroup = {
  name: string;
  slug: string;
  emojis: { emoji: string; name: string; skin_tone_support: boolean; emoji_version: string }[];
};

type EmojiPickerProps = {
  onEmoji: (emoji: string) => void;
  onSticker: (sticker: string) => void;
  /** A sticker from a pack made in the Sticker Pack Creator. */
  onCustomSticker: (sticker: CustomSticker) => void;
  onGif: (url: string) => void;
  onClose: () => void;
};

const SKIN_TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];
const RECENTS_KEY = "signal-emoji-recents";
const SKIN_KEY = "signal-emoji-skin";

/** Newer than this and Windows draws an empty box, so leave them out. */
const MAX_EMOJI_VERSION = 14;

export function EmojiPicker({
  onEmoji,
  onSticker,
  onCustomSticker,
  onGif,
  onClose,
}: EmojiPickerProps) {
  const [tab, setTab] = useState<Tab>("emoji");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (panel.current?.contains(target)) return;
      // The trigger toggles the picker itself.
      if (target.closest("[data-picker-trigger]")) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      className="animate-pop-in absolute bottom-full left-0 z-40 mb-2 flex h-[440px] w-[318px] flex-col overflow-hidden rounded-xl bg-surface-overlay shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      role="dialog"
      aria-label="Emoji, stickers and GIFs"
    >
      <div className="flex shrink-0 items-center justify-center gap-1 px-3 pb-1.5 pt-2.5">
        {(["emoji", "stickers", "gifs"] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`h-[26px] flex-1 rounded-full text-[12.5px] font-semibold transition ${
              tab === value ? "text-ink ring-[1.5px] ring-ink" : "text-ink hover:bg-surface-hover"
            }`}
          >
            {value === "emoji" ? "Emoji" : value === "stickers" ? "Stickers" : "GIFs"}
          </button>
        ))}
      </div>

      {tab === "emoji" && <EmojiTab onEmoji={onEmoji} />}
      {tab === "stickers" && (
        <StickersTab onSticker={onSticker} onCustomSticker={onCustomSticker} />
      )}
      {tab === "gifs" && <GifsTab onGif={onGif} />}
    </div>
  );
}

/**
 * The full emoji list opened from the "⋯" at the end of the reaction bar:
 * the same panel without the Stickers and GIFs tabs.
 */
export function ReactionPicker({
  onPick,
  onClose,
  className = "",
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", onPointerDown), 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      className={`animate-pop-in absolute z-50 flex h-[360px] w-[300px] flex-col overflow-hidden rounded-xl bg-surface-overlay pt-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${className}`}
      role="dialog"
      aria-label="Choose a reaction"
    >
      <EmojiTab onEmoji={onPick} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Emoji
// ---------------------------------------------------------------------------

const SECTION_META: { id: string; title: string; groups: string[]; icon: ReactNode }[] = [
  {
    id: "people",
    title: "Smileys & People",
    groups: ["smileys_emotion", "people_body"],
    icon: <EmojiIcon size={17} />,
  },
  {
    id: "animals",
    title: "Animals & Nature",
    groups: ["animals_nature"],
    icon: <PawIcon size={17} />,
  },
  { id: "food", title: "Food & Drink", groups: ["food_drink"], icon: <FoodIcon size={17} /> },
  { id: "activity", title: "Activities", groups: ["activities"], icon: <BallIcon size={17} /> },
  {
    id: "travel",
    title: "Travel & Places",
    groups: ["travel_places"],
    icon: <CarIcon size={17} />,
  },
  { id: "objects", title: "Objects", groups: ["objects"], icon: <BulbIcon size={17} /> },
  { id: "symbols", title: "Symbols", groups: ["symbols"], icon: <SymbolsIcon size={17} /> },
  { id: "flags", title: "Flags", groups: ["flags"], icon: <FlagIcon size={17} /> },
];

/** Loaded on first open, so the dataset is not in the main bundle. */
let sectionsCache: EmojiSection[] | null = null;

async function loadSections(): Promise<EmojiSection[]> {
  if (sectionsCache) return sectionsCache;
  const raw = (await import("unicode-emoji-json/data-by-group.json")).default as RawGroup[];
  sectionsCache = SECTION_META.map((meta) => ({
    id: meta.id,
    title: meta.title,
    icon: meta.icon,
    emojis: raw
      .filter((group) => meta.groups.includes(group.slug))
      .flatMap((group) => group.emojis)
      .filter((entry) => parseFloat(entry.emoji_version) <= MAX_EMOJI_VERSION)
      .map((entry) => ({ emoji: entry.emoji, name: entry.name, skin: entry.skin_tone_support })),
  }));
  return sectionsCache;
}

function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function applySkin(emoji: string, tone: string): string {
  if (!tone) return emoji;
  const chars = [...emoji.replace(/️/g, "")];
  return chars[0] + tone + chars.slice(1).join("");
}

function EmojiTab({ onEmoji }: { onEmoji: (emoji: string) => void }) {
  const [sections, setSections] = useState<EmojiSection[] | null>(sectionsCache);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(() => readList(RECENTS_KEY));
  const [tone, setTone] = useState<string>(() => {
    try {
      return localStorage.getItem(SKIN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [toneOpen, setToneOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sections) void loadSections().then(setSections);
    field.current?.focus();
  }, [sections]);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!sections || !needle) return [];
    return sections
      .flatMap((section) => section.emojis)
      .filter((entry) => entry.name.includes(needle))
      .slice(0, 160);
  }, [sections, needle]);

  function pick(entry: EmojiEntry) {
    const value = entry.skin ? applySkin(entry.emoji, tone) : entry.emoji;
    onEmoji(value);
    const next = [value, ...recents.filter((e) => e !== value)].slice(0, 24);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Recents are a convenience.
    }
  }

  function chooseTone(value: string) {
    setTone(value);
    setToneOpen(false);
    try {
      localStorage.setItem(SKIN_KEY, value);
    } catch {
      // Not worth surfacing.
    }
  }

  function jumpTo(id: string) {
    setQuery("");
    requestAnimationFrame(() => {
      const target = scroller.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
      if (target && scroller.current) scroller.current.scrollTop = target.offsetTop - 4;
    });
  }

  return (
    <>
      <SearchField inputRef={field} value={query} onChange={setQuery} placeholder="Search emoji" />

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {!sections && (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}

        {sections && needle && (
          <EmojiGrid entries={results} tone={tone} onPick={pick} empty="No emoji found" />
        )}

        {sections && !needle && (
          <>
            {recents.length > 0 && (
              <section data-section="recents">
                <SectionTitle>Recently Used</SectionTitle>
                <div className="grid grid-cols-8">
                  {recents.map((emoji) => (
                    <EmojiButton
                      key={emoji}
                      emoji={emoji}
                      label={emoji}
                      onClick={() => onEmoji(emoji)}
                    />
                  ))}
                </div>
              </section>
            )}
            {sections.map((section, index) => (
              <section key={section.id} data-section={section.id}>
                <SectionTitle
                  trailing={
                    index === 0 ? (
                      <span className="relative">
                        <button
                          type="button"
                          onClick={() => setToneOpen((open) => !open)}
                          aria-label="Skin tone"
                          className="flex size-5 items-center justify-center rounded-full text-ink-2 hover:text-ink"
                        >
                          <SkinToneIcon size={13} />
                        </button>
                        {toneOpen && (
                          <span className="absolute right-0 top-6 z-10 flex gap-0.5 rounded-lg bg-surface-chip p-1 shadow-lg">
                            {SKIN_TONES.map((value) => (
                              <button
                                key={value || "default"}
                                type="button"
                                onClick={() => chooseTone(value)}
                                className={`flex size-7 items-center justify-center rounded-md text-[18px] hover:bg-surface-hover ${
                                  tone === value ? "bg-surface-hover" : ""
                                }`}
                              >
                                {applySkin("\u{1F44B}", value)}
                              </button>
                            ))}
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                >
                  {section.title}
                </SectionTitle>
                <EmojiGrid entries={section.emojis} tone={tone} onPick={pick} />
              </section>
            ))}
          </>
        )}
      </div>

      <BottomBar>
        {recents.length > 0 && (
          <BarButton label="Recents" onClick={() => jumpTo("recents")}>
            <ClockIcon size={17} />
          </BarButton>
        )}
        {SECTION_META.map((meta) => (
          <BarButton key={meta.id} label={meta.title} onClick={() => jumpTo(meta.id)}>
            {meta.icon}
          </BarButton>
        ))}
      </BottomBar>
    </>
  );
}

function EmojiGrid({
  entries,
  tone,
  onPick,
  empty,
}: {
  entries: EmojiEntry[];
  tone: string;
  onPick: (entry: EmojiEntry) => void;
  empty?: string;
}) {
  if (entries.length === 0 && empty) {
    return <p className="py-10 text-center text-[13px] text-ink-2">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-8">
      {entries.map((entry) => (
        <EmojiButton
          key={entry.emoji}
          emoji={entry.skin ? applySkin(entry.emoji, tone) : entry.emoji}
          label={entry.name}
          onClick={() => onPick(entry)}
        />
      ))}
    </div>
  );
}

function EmojiButton({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex aspect-square items-center justify-center rounded-md text-[24px] leading-none transition-colors hover:bg-surface-hover"
    >
      {emoji}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stickers
// ---------------------------------------------------------------------------

type StickerPack = { id: string; title: string; cover: string; stickers: string[] };

const STICKER_PACKS: StickerPack[] = [
  {
    id: "pond",
    title: "Pond Pals",
    cover: "\u{1F438}",
    stickers: [
      "\u{1F438}",
      "\u{1F422}",
      "\u{1F986}",
      "\u{1F41F}",
      "\u{1F40A}",
      "\u{1F98E}",
      "\u{1F995}",
      "\u{1F996}",
      "\u{1F40D}",
      "\u{1F433}",
      "\u{1F419}",
      "\u{1F980}",
    ],
  },
  {
    id: "critters",
    title: "Cuddly Critters",
    cover: "\u{1F43C}",
    stickers: [
      "\u{1F43C}",
      "\u{1F428}",
      "\u{1F431}",
      "\u{1F436}",
      "\u{1F98A}",
      "\u{1F430}",
      "\u{1F439}",
      "\u{1F43B}",
      "\u{1F981}",
      "\u{1F42F}",
      "\u{1F427}",
      "\u{1F984}",
    ],
  },
  {
    id: "moods",
    title: "Big Moods",
    cover: "\u{1F973}",
    stickers: [
      "\u{1F973}",
      "\u{1F60D}",
      "\u{1F602}",
      "\u{1F62D}",
      "\u{1F631}",
      "\u{1F92F}",
      "\u{1F634}",
      "\u{1F60E}",
      "\u{1F914}",
      "\u{1F644}",
      "\u{1F917}",
      "\u{1F621}",
    ],
  },
  {
    id: "signals",
    title: "Hand Signals",
    cover: "\u{1F44B}",
    stickers: [
      "\u{1F44B}",
      "\u{1F44D}",
      "\u{1F44E}",
      "\u{1F44F}",
      "\u{1F64F}",
      "\u{1F64C}",
      "\u{1F91D}",
      "\u{270C}\u{FE0F}",
      "\u{1F918}",
      "\u{1F44C}",
      "\u{1F4AA}",
      "\u{1FAF6}",
    ],
  },
];

function StickersTab({
  onSticker,
  onCustomSticker,
}: {
  onSticker: (sticker: string) => void;
  onCustomSticker: (sticker: CustomSticker) => void;
}) {
  const [query, setQuery] = useState("");
  const custom = useUi((state) => state.stickerPacks);
  const setCreatorOpen = useUi((state) => state.setStickerCreatorOpen);
  const [packId, setPackId] = useState(custom[0]?.id ?? STICKER_PACKS[0].id);
  const scroller = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();

  const packs = needle
    ? STICKER_PACKS.filter((pack) => pack.title.toLowerCase().includes(needle))
    : STICKER_PACKS;
  // Searching matches a custom pack's title or any of its emoji.
  const customPacks = custom.filter(
    (pack) =>
      !needle ||
      pack.title.toLowerCase().includes(needle) ||
      pack.stickers.some((s) => s.emoji && needle.includes(s.emoji)),
  );

  function jumpTo(id: string) {
    setPackId(id);
    const target = scroller.current?.querySelector<HTMLElement>(`[data-pack="${id}"]`);
    if (target && scroller.current) scroller.current.scrollTop = target.offsetTop - 4;
  }

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search stickers" />
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {packs.length === 0 && customPacks.length === 0 && (
          <p className="py-10 text-center text-[13px] text-ink-2">No sticker packs found</p>
        )}
        {customPacks.map((pack) => (
          <section key={pack.id} data-pack={pack.id}>
            <SectionTitle>{pack.title}</SectionTitle>
            <div className="grid grid-cols-4 gap-1">
              {pack.stickers.map((sticker) => (
                <button
                  key={sticker.url}
                  type="button"
                  onClick={() => onCustomSticker(sticker)}
                  aria-label={`Send sticker ${sticker.emoji}`}
                  title={sticker.emoji}
                  className="flex aspect-square items-center justify-center rounded-lg p-1 transition hover:scale-105 hover:bg-surface-hover"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(sticker.url)} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          </section>
        ))}
        {packs.map((pack) => (
          <section key={pack.id} data-pack={pack.id}>
            <SectionTitle>{pack.title}</SectionTitle>
            <div className="grid grid-cols-4 gap-1">
              {pack.stickers.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  onClick={() => onSticker(sticker)}
                  aria-label={`Send sticker ${sticker}`}
                  className="flex aspect-square items-center justify-center rounded-lg text-[46px] leading-none transition hover:scale-105 hover:bg-surface-hover"
                >
                  <span className="drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]">{sticker}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <BottomBar>
        {custom.map((pack) => (
          <BarButton
            key={pack.id}
            label={pack.title}
            active={pack.id === packId}
            onClick={() => jumpTo(pack.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(pack.cover)} alt="" className="size-5 object-contain" />
          </BarButton>
        ))}
        {STICKER_PACKS.map((pack) => (
          <BarButton
            key={pack.id}
            label={pack.title}
            active={pack.id === packId}
            onClick={() => jumpTo(pack.id)}
          >
            <span className="text-[18px] leading-none">{pack.cover}</span>
          </BarButton>
        ))}
        <span className="flex-1" />
        <BarButton label="Create a sticker pack" onClick={() => setCreatorOpen(true)}>
          <PlusIcon size={16} />
        </BarButton>
      </BottomBar>
    </>
  );
}

// ---------------------------------------------------------------------------
// GIFs
// ---------------------------------------------------------------------------

type Gif = { id: string; title: string; preview: string; full: string };

const GIF_CATEGORIES: { id: string; label: string; query: string | null; icon: ReactNode }[] = [
  { id: "trending", label: "Trending", query: null, icon: <TrendingIcon size={17} /> },
  { id: "celebrate", label: "Celebrate", query: "celebrate", icon: <CelebrateIcon size={17} /> },
  { id: "love", label: "Love", query: "love", icon: <HeartIcon size={17} /> },
  { id: "thumbs", label: "Thumbs up", query: "thumbs up", icon: <ThumbsUpIcon size={17} /> },
  { id: "surprised", label: "Surprised", query: "surprised", icon: <EyesIcon size={17} /> },
  { id: "happy", label: "Happy", query: "happy", icon: <EmojiIcon size={17} /> },
  { id: "sad", label: "Sad", query: "sad", icon: <SadIcon size={17} /> },
  { id: "angry", label: "Angry", query: "angry", icon: <AngryIcon size={17} /> },
];

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";

type GiphyImage = { url: string };
type GiphyItem = {
  id: string;
  title: string;
  images: { fixed_width: GiphyImage; downsized_medium?: GiphyImage; original: GiphyImage };
};

function GifsTab({ onGif }: { onGif: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("trending");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");

  const needle = query.trim();
  const activeQuery = needle || GIF_CATEGORIES.find((c) => c.id === category)?.query || null;

  useEffect(() => {
    if (!GIPHY_KEY) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setState("loading");
        const base = "https://api.giphy.com/v1/gifs";
        const params = new URLSearchParams({ api_key: GIPHY_KEY, limit: "24", rating: "pg-13" });
        const url = activeQuery
          ? `${base}/search?${params}&q=${encodeURIComponent(activeQuery)}`
          : `${base}/trending?${params}`;
        fetch(url, { signal: controller.signal })
          .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
          .then((body: { data: GiphyItem[] }) => {
            setGifs(
              body.data.map((item) => ({
                id: item.id,
                title: item.title,
                preview: item.images.fixed_width.url,
                full: (item.images.downsized_medium ?? item.images.original).url,
              })),
            );
            setState("idle");
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setState("error");
          });
      },
      needle ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeQuery, needle]);

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search GIFs" />
      <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-10">
        {!GIPHY_KEY ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[13px] font-semibold text-ink">GIFs are not configured</p>
            <p className="mt-1 text-[12px] leading-snug text-ink-2">
              Add NEXT_PUBLIC_GIPHY_API_KEY to frontend/.env.local to search GIPHY.
            </p>
          </div>
        ) : state === "loading" ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : state === "error" ? (
          <p className="py-10 text-center text-[13px] text-ink-2">Couldn&rsquo;t load GIFs.</p>
        ) : gifs.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-2">No GIFs found</p>
        ) : (
          <div className="columns-2 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onGif(gif.full)}
                className="mb-1 block w-full overflow-hidden rounded-md bg-surface-sunken"
                aria-label={gif.title || "Send GIF"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gif.preview} alt="" className="block w-full" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <span className="pointer-events-none sticky bottom-1 left-0 mx-auto mt-2 flex w-fit items-center gap-1 rounded-full bg-black/85 px-3 py-1 text-[8px] font-semibold uppercase tracking-wider text-white/70">
          Powered by{" "}
          <span className="text-[12px] font-black normal-case tracking-tight text-white">
            GIPHY
          </span>
        </span>
      </div>
      <BottomBar>
        {GIF_CATEGORIES.map((item) => (
          <BarButton
            key={item.id}
            label={item.label}
            active={!needle && category === item.id}
            onClick={() => {
              setQuery("");
              setCategory(item.id);
            }}
          >
            {item.icon}
          </BarButton>
        ))}
      </BottomBar>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SearchField({
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="shrink-0 px-2.5 pb-1.5">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <SearchIcon
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2"
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[30px] w-full rounded-full bg-surface-sunken pl-8 pr-3 text-[13px] text-ink outline-none ring-ink/80 placeholder:text-ink-2 focus:ring-[1.5px]"
        />
      </label>
    </div>
  );
}

function SectionTitle({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1 pt-2 text-[11.5px] font-semibold text-ink-2">
      <span>{children}</span>
      {trailing}
    </div>
  );
}

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 border-t border-border-strong/40 px-2 py-1.5">
      {children}
    </div>
  );
}

function BarButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex size-[30px] items-center justify-center rounded-md transition-colors ${
        active ? "bg-surface-hover text-ink" : "text-ink-2 hover:bg-surface-hover hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span className="size-7 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" />
  );
}
