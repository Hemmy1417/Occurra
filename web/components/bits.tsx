/**
 * The parts every page is built from. Black hairlines do the delineation,
 * whisper-weight headlines do the hierarchy, and a mono marks everything
 * functional. One filled button style exists (obsidian); every other act is
 * a hairline ghost or a text link.
 */
import Link from "next/link";
import type { ReactNode } from "react";

/** A section title in Almarai 300 over a full-width black hairline. */
export function SectionHead({ title, aside, id }: { title: string; aside?: ReactNode; id?: string }) {
  return (
    <div id={id} className="ruled flex flex-wrap items-end justify-between gap-3 pb-3">
      <h2 className="t-heading text-obsidian">{title}</h2>
      {aside ? <div className="t-label text-graphite">{aside}</div> : null}
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`page py-12 md:py-16 ${className}`}>{children}</section>;
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  full?: boolean;
};

/** Obsidian fill for the one act a view is about; a hairline ghost for the rest. */
export function Button({ children, onClick, disabled, variant = "primary", type = "button", full = false }: ButtonProps) {
  const base = `t-label rounded-[4px] px-4 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    full ? "w-full" : ""}`;
  const look = variant === "primary"
    ? "bg-obsidian text-canvas hover:bg-graphite"
    : "border border-graphite text-obsidian hover:bg-haze";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, children, variant = "primary" }:
    { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const look = variant === "primary"
    ? "bg-obsidian text-canvas hover:bg-graphite"
    : "border border-graphite text-obsidian hover:bg-haze";
  return <Link href={href} className={`t-label inline-block rounded-[4px] px-4 py-2.5 ${look}`}>{children}</Link>;
}

export function InkLink({ href, children, external = false }:
    { href: string; children: ReactNode; external?: boolean }) {
  const cls = "t-label text-graphite underline decoration-fog underline-offset-4 hover:text-obsidian hover:decoration-obsidian";
  return external
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="t-label text-graphite">{label}</span>
      {children}
      {hint ? <span className="t-small text-smoke">{hint}</span> : null}
    </label>
  );
}

/** A labelled fact: mono label over the value. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="t-label text-smoke">{label}</dt>
      <dd className="t-body text-obsidian">{children}</dd>
    </div>
  );
}

/** A ruled ledger row: label left in mono, value right. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[#d9d9d9] py-3">
      <span className="t-label text-smoke">{label}</span>
      <span className="t-small text-right text-obsidian">{children}</span>
    </div>
  );
}

/**
 * An outcome told without colour. Established: a filled square. Not
 * established: a hollow square struck through. Undetermined: a dashed square.
 * A claim still in progress: a hollow square.
 */
export function Glyph({ kind, size = 14 }: { kind: string | null | undefined; size?: number }) {
  const s = size;
  if (kind === "ESTABLISHED" || kind === "SATISFIED") {
    return <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden><rect x="1" y="1" width="12" height="12" rx="1.5" fill="#1a1a1a" /></svg>;
  }
  if (kind === "NOT_ESTABLISHED_OUTCOME" || kind === "NOT_SATISFIED") {
    return (
      <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden>
        <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="#1a1a1a" strokeWidth="1.4" />
        <path d="M2.5 11.5 11.5 2.5" stroke="#1a1a1a" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === "UNDETERMINED" || kind === "NOT_ESTABLISHED") {
    return (
      <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden>
        <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="#1a1a1a" strokeWidth="1.4"
              strokeDasharray="2.4 2" />
      </svg>
    );
  }
  if (kind === "NOT_APPLICABLE") {
    return <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden><path d="M3 7h8" stroke="#8d8d8d" strokeWidth="1.4" /></svg>;
  }
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" aria-hidden>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="#8d8d8d" strokeWidth="1.4" />
    </svg>
  );
}

/** An outcome's glyph beside its words. */
export function Outcome({ value, children, size = 14 }: { value: string | null | undefined; children: ReactNode; size?: number }) {
  const kind = value === "NOT_ESTABLISHED" ? "NOT_ESTABLISHED_OUTCOME" : value;
  return (
    <span className={`inline-flex items-center ${size > 20 ? "gap-4" : "gap-2"}`}>
      <Glyph kind={kind} size={size} />
      <span>{children}</span>
    </span>
  );
}

/** A quiet state marker: mono words in a hairline box. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="t-label inline-block rounded-[4px] border border-graphite px-2 py-1 text-obsidian">{children}</span>;
}

export function Loading({ what }: { what: string }) {
  return <p className="t-label text-smoke">Reading {what} from the chain.</p>;
}

export function ReadFailure({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="hair p-6">
      <p className="t-sub">Could not read {what}</p>
      {detail ? <p className="t-small mt-2 text-graphite">{detail}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="t-body text-smoke">{children}</p>;
}

/** A stat in the ledger strip: a mono label over a whisper-weight figure. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-l border-ink pl-4">
      <span className="t-label text-smoke">{label}</span>
      <span className="t-heading text-obsidian">{value}</span>
    </div>
  );
}

/** Machine values, folded away until someone asks to verify. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group border-t border-[#d9d9d9] py-3">
      <summary className="t-label cursor-pointer list-none text-graphite">
        <span className="mr-2 inline-block w-3 text-center group-open:hidden">+</span>
        <span className="mr-2 hidden w-3 text-center group-open:inline-block">-</span>
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** One machine value with a copy button; only ever inside a Disclosure or on the verify page. */
export function Machine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-1">
      <span className="t-label text-smoke">{label}</span>
      <code className="t-mono break-all text-obsidian">{value}</code>
    </div>
  );
}
