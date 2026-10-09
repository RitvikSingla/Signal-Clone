/**
 * Inline icons.
 *
 * Hand-drawn rather than pulled from a library: the whole set is a few
 * hundred bytes, every path inherits currentColor so it works in both
 * themes, and there is no dependency to pin.
 */

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** The rail draws the active tab's glyph solid, the rest as outlines. */
  filled?: boolean;
};

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export function ChatIcon({ size = 22, className, strokeWidth = 1.7, filled = false }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth} fill={filled ? "currentColor" : "none"}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-5A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
    </svg>
  );
}

export function PhoneIcon({ size = 22, className, strokeWidth = 1.7, filled = false }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth} fill={filled ? "currentColor" : "none"}>
      <path d="M22 16.9v2.6a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.7 2 2 0 0 1 4.1 1.5h2.6a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.8 9.3a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

export function VideoIcon({ size = 22, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2.5" />
    </svg>
  );
}

export function StoriesIcon({ size = 22, className, strokeWidth = 1.7, filled = false }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth} fill={filled ? "currentColor" : "none"}>
      <rect x="9" y="3.5" width="11" height="17" rx="3.2" />
      <path d="M5 7.5v9" />
    </svg>
  );
}

export function SettingsIcon({ size = 22, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3.7 9a1.7 1.7 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export function SearchIcon({ size = 18, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function ComposeIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function PlusIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MoreIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

export function SendIcon({ size = 19, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 12h15" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function MicIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

export function EmojiIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <circle cx="9" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AttachIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.4-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.3-2.3l7.8-7.8" />
    </svg>
  );
}

export function LockIcon({ size = 13, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export function TimerIcon({ size = 14, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}

export function BackIcon({ size = 22, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function PinIcon({ size = 13, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
    </svg>
  );
}

export function MuteIcon({ size = 13, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M18 8a6 6 0 0 0-9.3-5" />
      <path d="M6 9v4l-2 4h13" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function GroupIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 20a6.4 6.4 0 0 0-1.6-4.3" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ReplyIcon({ size = 16, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M9 10 4 15l5 5" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

/**
 * The check marks. Signal shows one outline tick for sent, two for
 * delivered, and two filled ticks for read.
 */
export function TickIcon({
  double,
  size = 16,
  className,
}: {
  double: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m3 10.6 3.2 3.2L12.6 7" />
      {double && <path d="m9.4 13.8 6.4-6.8" />}
    </svg>
  );
}

export function MenuIcon({ size = 20, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** The decreasing-lines filter control that sits beside Signal's search field. */
export function FilterIcon({ size = 18, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 6.5h16M6.5 12h11M10 17.5h4" />
    </svg>
  );
}

/**
 * The Signal mark: a speech bubble inside a dashed ring.
 * Drawn rather than imported so it inherits currentColor and needs no asset.
 */
export function SignalMark({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="11 7"
      />
      <path
        d="M50 15C30.7 15 15 28.1 15 44.3c0 8.6 4.4 16.3 11.4 21.7l-4.6 16.4a1.6 1.6 0 0 0 2.2 1.9l19.3-8.4c2.2.3 4.4.5 6.7.5 19.3 0 35-13.1 35-29.4S69.3 15 50 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function NewCallIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M20 16.6v2.2a1.8 1.8 0 0 1-2 1.8 17.8 17.8 0 0 1-7.7-2.8 17.4 17.4 0 0 1-5.4-5.4A17.8 17.8 0 0 1 2.1 4.7 1.8 1.8 0 0 1 3.9 2.7h2.2a1.8 1.8 0 0 1 1.8 1.6c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9l-1 1a14.4 14.4 0 0 0 5.4 5.4l1-1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.6 1.8Z" />
      <path d="M18 2v6M21 5h-6" />
    </svg>
  );
}

export function LinkIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
    </svg>
  );
}

export function PersonIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function AccountIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="2.8" />
      <path d="M6.3 18.3a6.5 6.5 0 0 1 11.4 0" />
    </svg>
  );
}

export function PencilIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function AtIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M15.6 12v1.4a2.7 2.7 0 0 0 5.4 0V12a9 9 0 1 0-3.5 7.1" />
    </svg>
  );
}

export function HeartIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 20.3 4.6 13a4.8 4.8 0 0 1 6.8-6.8l.6.6.6-.6A4.8 4.8 0 1 1 19.4 13Z" />
    </svg>
  );
}

export function BellIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M18 9a6 6 0 1 0-12 0c0 4-1.5 5.5-1.5 5.5h15S18 13 18 9Z" />
      <path d="M13.7 18a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function AppearanceIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SlidersIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function DataIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12V5.5a6.5 6.5 0 0 1 5.6 9.8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BackupIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 20, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 16, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The smiley with a plus that opens the reaction bar on a message. */
export function ReactIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M20.6 11a8.6 8.6 0 1 1-7.6-7.6" />
      <path d="M8.8 14.6a4.4 4.4 0 0 0 6.4 0" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <path d="M19 2v5M16.5 4.5h5" />
    </svg>
  );
}

export function WarningIcon({ size = 14, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

/** Person with a question mark, the glyph beside "Name not verified". */
export function PersonQuestionIcon({ size = 13, className, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 10.4-5.2" />
      <path d="M16 14.2a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1.1.9-1.1 1.6M18.1 21h.01" />
    </svg>
  );
}

/** Two speech bubbles, the glyph on the "You accepted the request" event. */
export function ChatsIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M15 9.5A5.5 5.5 0 0 0 9.5 4 5.6 5.6 0 0 0 4 9.5a5.3 5.3 0 0 0 .7 2.6L4 15l2.9-.7a5.6 5.6 0 0 0 2.6.7A5.5 5.5 0 0 0 15 9.5Z" />
      <path d="M10.5 16.8a5.5 5.5 0 0 0 6.6 1.5L20 19l-.7-2.9a5.4 5.4 0 0 0-2.5-7.6" />
    </svg>
  );
}

export function VerifiedIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#3a76f0"
        d="M12 1.5 14.6 3.4l3.2-.2 1 3 2.7 1.8-1 3 1 3-2.7 1.8-1 3-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3-2.7-1.8 1-3-1-3 2.7-1.8 1-3 3.2.2Z"
      />
      <path
        d="m8 12.2 2.7 2.7L16.2 9.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArchiveIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
      <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
    </svg>
  );
}

export function FolderIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 10.5v5M9.5 13h5" />
    </svg>
  );
}

export function MoonIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

export function PhotoIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="9.5" r="1.7" />
      <path d="m21 15.5-4.5-4.5L7 20" />
    </svg>
  );
}

export function FileIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function PollIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  );
}

export function HashIcon({ size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}

export function ThumbsUpIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <path d="M7 10 11 3a2.5 2.5 0 0 1 2.7 3L13 10h5.6a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.1 21H7" />
    </svg>
  );
}

export function TrendingIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m7 15 4-4 2.5 2.5L17 10M14 10h3v3" />
    </svg>
  );
}

export function CelebrateIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m4 20 4.5-12 7.5 7.5Z" />
      <path d="M14 4.5c.5 1.5-.5 2.5-1 3M19.5 10c-1.5-.5-2.5.5-3 1M17 3l.5 1.5M21 7l-1.5.5" />
    </svg>
  );
}

export function EyesIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <ellipse cx="7.5" cy="12" rx="4" ry="6" />
      <ellipse cx="16.5" cy="12" rx="4" ry="6" />
      <circle cx="8.5" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SadIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 16a4.5 4.5 0 0 1 7 0" />
      <circle cx="9" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AngryIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 16.5a4.5 4.5 0 0 1 7 0M7.5 8.5l3 1.5M16.5 8.5l-3 1.5" />
    </svg>
  );
}

/** Category glyphs for the emoji picker's bottom bar. */
export function PawIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="6" cy="10" r="1.8" />
      <circle cx="10" cy="6" r="1.8" />
      <circle cx="14" cy="6" r="1.8" />
      <circle cx="18" cy="10" r="1.8" />
      <path d="M8 17c0-3 2-5 4-5s4 2 4 5a2.5 2.5 0 0 1-4 1.5A2.5 2.5 0 0 1 8 17Z" />
    </svg>
  );
}

export function FoodIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 11h16a8 8 0 0 1-16 0Z" />
      <path d="M9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5" />
    </svg>
  );
}

export function BallIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7.5 3.5 2.5-1.3 4h-4.4L8.5 10Z" />
      <path d="M12 3v4.5M15.5 10l4.5-1.5M14.2 14l2.8 4M9.8 14 7 18M8.5 10 4 8.5" />
    </svg>
  );
}

export function CarIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18v2.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V18H7v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1ZM5 11h14" />
    </svg>
  );
}

export function BulbIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.4.4.6.8.6 1.4V16h6v-.8c0-.6.2-1 .6-1.4A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function SymbolsIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 8h3M9.5 6.5v3M13 15h3M7 16l3-3M7 13l3 3M14 7l2 3" />
    </svg>
  );
}

export function FlagIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function ClockIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PauseIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export function PlayIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M7 4.8v14.4a1 1 0 0 0 1.5.9l11.4-7.2a1 1 0 0 0 0-1.7L8.5 3.9A1 1 0 0 0 7 4.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function VolumeOffIcon({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

export function VolumeOnIcon({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function CopyIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

export function InfoIcon({ size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </svg>
  );
}

export function SkinToneIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
    </svg>
  );
}

/** The delivery state as Signal Desktop draws it: ticks inside circles. */
export function StatusIcon({
  status,
  size = 14,
  className,
}: {
  status: "sending" | "sent" | "delivered" | "read";
  size?: number;
  className?: string;
}) {
  if (status === "sending") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Sending">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }
  if (status === "sent") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Sent">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m8.3 12.2 2.5 2.5 4.9-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const filled = status === "read";
  return (
    <svg
      width={size * 1.45}
      height={size}
      viewBox="0 0 35 24"
      className={className}
      aria-label={filled ? "Read" : "Delivered"}
    >
      <circle cx="12" cy="12" r="8.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <circle cx="23" cy="12" r="8.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m18.6 12.2 2.5 2.5 4.9-5"
        fill="none"
        stroke={filled ? "var(--status-on-fill, #2c6bed)" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Signal's Forward glyph: an arrow curving out to the right. */
export function ForwardIcon({ size = 16, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m15 4 6 6-6 6" />
      <path d="M21 10h-9a8 8 0 0 0-8 8v2" />
    </svg>
  );
}

export function DownloadIcon({ size = 16, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ScrollDownIcon({ size = 16, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
