"use client";

import Link from "next/link";

import { Empty, Loading, Outcome, ReadFailure, Section, SectionHead } from "@/components/bits";
import { claimName, claimState, day, gen, outcome, plural, prose } from "@/lib/present";
import { listAllClaims } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Claims() {
  const claims = useChain("claims.all", (f) => listAllClaims(0, 50, f));
  return (
    <Section>
      <div className="flex flex-col gap-3 pb-8">
        <p className="t-label text-smoke">Claims</p>
        <h1 className="t-display">Every claim, and where it stands</h1>
        <p className="t-body measure text-graphite">
          Each claim says an event happened. Its receipt says whether the evidence filed for it established that.
        </p>
      </div>
      <SectionHead title="Newest first" aside={claims.data ? plural(claims.data.total, "claim") : undefined} />
      {claims.data ? (
        claims.data.claims.length ? (
          <ul>
            {claims.data.claims.map((c) => (
              <li key={c.claim_id}>
                <Link href={`/claims/${c.claim_id}`}
                      className="grid gap-2 border-b border-[#d9d9d9] py-5 hover:bg-haze md:grid-cols-[1fr_200px_140px_200px] md:items-baseline md:gap-6 md:px-2">
                  <span className="flex flex-col gap-1">
                    <span className="t-body text-obsidian">{prose(c.subject)}</span>
                    <span className="t-label text-smoke">{claimName(c.claim_id)} · event of {day(c.event_date)}</span>
                  </span>
                  <span className="t-small text-graphite">{claimState(c.state)}</span>
                  <span className="t-small">{gen(c.benefit_wei)}</span>
                  <span className="t-small">
                    {c.final ? <Outcome value={c.final.determination}>{outcome(c.final.determination)}</Outcome>
                      : <span className="text-smoke">Not final</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="py-6"><Empty>No claim has been filed yet.</Empty></div>
      ) : claims.error ? <ReadFailure what="the claims" retrying={claims.retrying} /> : <div className="py-6"><Loading what="the claims" /></div>}
    </Section>
  );
}
