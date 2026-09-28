/**
 * The Occurra mark: a moment pinned on a line. A horizontal rule (the
 * timeline a claim describes) passes through a ring (the event), and the
 * filled square at its centre is the occurrence the evidence establishes.
 * Glacier blue, the one colour the mark carries; legible at 16px.
 */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M2 16h7M23 16h7" stroke="#4f6f8f" strokeWidth="2.4" strokeLinecap="square" />
      <circle cx="16" cy="16" r="8.2" fill="none" stroke="#4f6f8f" strokeWidth="2.4" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill="#1a1a1a" />
    </svg>
  );
}

/** The mark beside a two-line wordmark, as the header carries it. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-3">
      <Mark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[19px] font-light tracking-[-0.4px] text-obsidian">Occurra</span>
        <span className="t-label mt-1 text-smoke">Event verification</span>
      </span>
    </span>
  );
}
