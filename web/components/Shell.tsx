"use client";

/**
 * The frame of every page: a black announcement strip, the header with the
 * mark, the mono navigation and the wallet, the notices that outlive a card
 * (a confirmed write, credit waiting), and a ruled footer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ConfirmedNotice } from "./Confirmed";
import { CreditBar } from "./CreditBar";
import { Wordmark } from "./Logo";
import { WalletDock } from "./WalletDock";
import { CONTRACT_CONFIGURED, IS_RECORD, REPO_URL } from "@/lib/config";

const NAV = [
  { href: "/types", label: "Event types" },
  { href: "/claims", label: "Claims" },
  { href: "/mine", label: "Your record" },
  { href: "/how", label: "How it works" },
  { href: "/verify", label: "Verify" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-obsidian">
        <p className="page py-2 text-center text-[12px] leading-5 text-canvas">
          {!CONTRACT_CONFIGURED
            ? "No deployment is configured for this build."
            : IS_RECORD
              ? "Occurra runs on GenLayer Studio Next, a test network. Every amount is test GEN."
              : "This build points at a deployment other than the one of record. Treat what it shows as a test."}
        </p>
      </div>
      <header className="page flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-6">
        <Link href="/" aria-label="Occurra, home"><Wordmark /></Link>
        <nav aria-label="Main" className="order-3 w-full md:order-2 md:w-auto">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV.map((n) => {
              const here = path === n.href || path.startsWith(`${n.href}/`);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={here ? "page" : undefined}
                        className={`t-label ${here ? "text-obsidian underline underline-offset-[6px]" : "text-graphite hover:text-obsidian"}`}>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="order-2 md:order-3"><WalletDock /></div>
      </header>
      <ConfirmedNotice />
      <CreditBar />
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-ink">
        <div className="page flex flex-wrap items-start justify-between gap-6 py-8">
          <p className="t-small measure text-graphite">
            Occurra decides whether a claimed event happened, from the evidence filed for it, by the agreement of
            independent GenLayer validators. It never decides whether anyone deserves a payment.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/how" className="t-label text-graphite hover:text-obsidian">How it works</Link></li>
            <li><Link href="/verify" className="t-label text-graphite hover:text-obsidian">Verify the deployment</Link></li>
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="t-label text-graphite hover:text-obsidian">Source</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
