"use client";

import Link from "next/link";

import { ButtonLink, Empty, Loading, Outcome, ReadFailure, Section, SectionHead, Stat } from "@/components/bits";
import { category, claimName, claimState, eventKind, gen, outcome, prose } from "@/lib/present";
import { getStats, listAllClaims, listEventTypes } from "@/lib/read";
import { useChain } from "@/lib/useChain";

const FLOW = [
  { n: "01", title: "Evidence is filed", text: "Photographs and documents go on chain, each hashed as it arrives." },
  { n: "02", title: "Validators examine", text: "Each validator looks at the photographs itself, then rates every requirement." },
  { n: "03", title: "Code decides", text: "Ratings stand only on what was seen. A fixed rule turns them into the outcome." },
  { n: "04", title: "A receipt is kept", text: "The determination, what every validator reproduced, and the evidence snapshot." },
];

export default function Home() {
  const stats = useChain("stats", (f) => getStats(f));
  const types = useChain("home.types", (f) => listEventTypes(0, 4, f));
  const claims = useChain("home.claims", (f) => listAllClaims(0, 6, f));

  return (
    <>
      <section className="hero-photo">
        <div className="page flex min-h-[420px] flex-col justify-end gap-6 py-14 md:min-h-[520px] md:py-20">
          <p className="t-label text-graphite">Decentralized verification of real-world events</p>
          <h1 className="t-display max-w-[900px] text-obsidian">
            Did it happen? The evidence decides, and no single party reads it.
          </h1>
          <p className="t-body measure text-graphite">
            A sponsor defines an event. A claimant files photographs and documents. Independent GenLayer validators
            each examine them, and the contract records whether they establish that the event occurred as defined.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/types">Browse event types</ButtonLink>
            <ButtonLink href="/types/new" variant="secondary">Write an event type</ButtonLink>
          </div>
        </div>
      </section>

      <Section>
        {stats.data ? (
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat label="Event types" value={stats.data.type} />
            <Stat label="Claims filed" value={stats.data.claim} />
            <Stat label="Events established" value={stats.data.established} />
            <Stat label="Benefits paid" value={gen(String(stats.data.paid_wei))} />
          </div>
        ) : stats.error ? <ReadFailure what="the totals" retrying={stats.retrying} /> : <Loading what="the totals" />}
      </Section>

      <Section>
        <SectionHead title="How a claim is decided" aside={<Link href="/how">The full rule</Link>} />
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {FLOW.map((s) => (
            <li key={s.n} className="flex min-h-[200px] flex-col justify-between rounded-[4px] bg-obsidian p-6 text-canvas">
              <span className="t-label text-fog">{s.n}</span>
              <div>
                <p className="t-sub text-canvas">{s.title}</p>
                <p className="t-small mt-2 text-[#c9c9c9]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHead title="Who does what" />
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <p className="t-label text-smoke">Sponsors</p>
            <p className="t-sub">Define the event once, fund a reserve, and let the evidence settle every claim.</p>
            <p className="t-small measure text-graphite">
              An insurer, a logistics desk or a fund writes the definition, the criteria and the evidence a claim must
              carry. Each claim commits its benefit from the reserve at filing, so two claims never share one benefit.
            </p>
            <div><ButtonLink href="/types/new" variant="secondary">Write an event type</ButtonLink></div>
          </div>
          <div className="flex flex-col gap-4">
            <p className="t-label text-smoke">Claimants</p>
            <p className="t-sub">File what happened, with the photographs that show it, and a bond.</p>
            <p className="t-small measure text-graphite">
              The bond comes back unless the evidence establishes that the event did not happen as claimed. The party a
              determination goes against may appeal once, and both sides answer before it is judged again.
            </p>
            <div><ButtonLink href="/types" variant="secondary">Find an event type</ButtonLink></div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHead title="Latest claims" aside={<Link href="/claims">Every claim</Link>} />
        <div className="mt-4">
          {claims.data ? (
            claims.data.claims.length ? (
              <ul>
                {claims.data.claims.map((c) => (
                  <li key={c.claim_id}>
                    <Link href={`/claims/${c.claim_id}`}
                          className="grid gap-2 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_220px_200px] md:items-baseline md:gap-6 md:px-2">
                      <span className="t-body text-obsidian">{prose(c.subject)}</span>
                      <span className="t-label text-smoke">{claimName(c.claim_id)} · {claimState(c.state)}</span>
                      <span className="t-small">
                        {c.final ? <Outcome value={c.final.determination}>{outcome(c.final.determination)}</Outcome>
                          : <span className="text-smoke">No final determination yet</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>No claim has been filed yet.</Empty>
          ) : claims.error ? <ReadFailure what="the claims" retrying={claims.retrying} /> : <Loading what="the latest claims" />}
        </div>
      </Section>

      <Section>
        <SectionHead title="Event types" aside={<Link href="/types">All of them</Link>} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {types.data ? (
            types.data.event_types.length ? types.data.event_types.map((t) => (
              <Link key={t.type_id} href={`/types/${t.type_id}`} className="hair flex flex-col gap-3 p-6 hover:bg-haze">
                <span className="t-label text-smoke">{category(t.category)} · {eventKind(t.event_kind)}</span>
                <span className="t-sub">{prose(t.title)}</span>
                <span className="t-small text-graphite">Pays {gen(t.benefit_wei)} for an established event · bond {gen(t.bond_wei)}</span>
              </Link>
            )) : <Empty>No event type has been written yet.</Empty>
          ) : types.error ? <ReadFailure what="the event types" retrying={types.retrying} /> : <Loading what="the event types" />}
        </div>
      </Section>
    </>
  );
}
