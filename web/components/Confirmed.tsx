"use client";

/**
 * A write that finalized often changes the page so much that the card which
 * sent it disappears. This notice outlives the card, so the person always
 * sees that it went through.
 */
import { useEffect, useState } from "react";

import { txUrl } from "@/lib/chain";

export const CONFIRMED_EVENT = "occurra:confirmed";

export function announceConfirmed(hash: string, what: string): void {
  window.dispatchEvent(new CustomEvent(CONFIRMED_EVENT, { detail: { hash, what } }));
}

export function ConfirmedNotice() {
  const [last, setLast] = useState<{ hash: string; what: string } | null>(null);
  useEffect(() => {
    const h = (e: Event) => setLast((e as CustomEvent<{ hash: string; what: string }>).detail);
    window.addEventListener(CONFIRMED_EVENT, h);
    return () => window.removeEventListener(CONFIRMED_EVENT, h);
  }, []);
  if (!last) return null;
  return (
    <div role="status" className="border-b border-ink bg-haze">
      <div className="page flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="t-small text-obsidian">
          {last.what}: finalized on chain.{" "}
          <a className="underline decoration-fog underline-offset-4" href={txUrl(last.hash)} target="_blank" rel="noreferrer">
            See the transaction
          </a>
        </p>
        <button type="button" className="t-label text-graphite" onClick={() => setLast(null)}>Dismiss</button>
      </div>
    </div>
  );
}
