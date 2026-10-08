"use client";

/**
 * The three animated dots.
 *
 * Signal shows them in a bubble on the incoming side, at the foot of the
 * thread, with the sender's name only when the thread is a group.
 */

type TypingIndicatorProps = {
  people: { userId: string; displayName: string }[];
  isGroup: boolean;
};

export function TypingIndicator({ people, isGroup }: TypingIndicatorProps) {
  if (people.length === 0) return null;

  const names = people.map((p) => p.displayName.split(" ")[0]);
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="mb-2 flex w-full justify-start" aria-live="polite">
      <div className="flex flex-col items-start">
        {isGroup && (
          <span className="mb-0.5 px-1 text-[12px] text-ink-2">{label}</span>
        )}
        <div className="flex items-center gap-1 rounded-bubble rounded-bl-bubble-tail bg-bubble-in px-3.5 py-3">
          <Dot delay="0ms" />
          <Dot delay="160ms" />
          <Dot delay="320ms" />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 rounded-full bg-ink-3 motion-safe:animate-[typing-bounce_1.1s_ease-in-out_infinite]"
      style={{ animationDelay: delay }}
    />
  );
}
