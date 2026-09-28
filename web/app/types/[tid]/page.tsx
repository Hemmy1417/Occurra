"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import {
  ButtonLink, Chip, Disclosure, Empty, Field, Loading, Machine, Outcome, ReadFailure, Row, Section, SectionHead,
} from "@/components/bits";
import { typeActs } from "@/lib/acts";
import {
  category, chainEvent, claimName, claimState, day, evidenceRule, eventKind, gen, outcome, parseGen, plural, prose,
  span, typeState, when,
} from "@/lib/present";
import { claimsOf, getEvents, getEventType, getTypeVersion, listClaims } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function TypePage() {
  const { tid } = useParams<{ tid: string }>();
  const w = useWallet();
  const type = useChain(`type.${tid}`, (f) => getEventType(tid, f));
  const t = type.data;
  const version = useChain(t ? `version.${tid}.${t.version}` : null, () => getTypeVersion(tid, t!.version));
  const claims = useChain(`claims.${tid}`, (f) => listClaims(tid, 0, 50, f));
  const events = useChain(`events.${tid}`, (f) => getEvents(tid, 0, 20, f));
  const mine = useChain(w.address ? `claimsof.${w.address}` : null, (f) => claimsOf(w.address, 0, 50, f));
  const [fund, setFund] = useState("1");
  const [take, setTake] = useState("");

  if (type.error) return <Section><ReadFailure what="this event type" /></Section>;
  if (type.data === null) return <Section><Empty>There is no event type with this number.</Empty></Section>;
  if (!t || !version.data) return <Section><Loading what="the event type" /></Section>;
  const v = version.data;
  const openMine = (mine.data?.claims ?? []).filter((c) => c.type_id === tid && c.claimant.toLowerCase() === w.address.toLowerCase()
    && ["OPEN", "DETERMINED", "UNDER_APPEAL"].includes(c.state)).length;
  const acts = typeActs(t, v, w.address, openMine);
  const isSponsor = !!w.address && w.address.toLowerCase() === t.sponsor.toLowerCase();
  const named = v.assessors.some((a) => a.toLowerCase() === w.address.toLowerCase());

  return (
    <>
      <Section className="pb-6">
        <p className="t-label text-smoke">{category(t.category)} · {eventKind(t.event_kind)}</p>
        <h1 className="t-display mt-3 max-w-[820px]">{prose(t.title)}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Chip>{typeState(t.state)}</Chip>
          <span className="t-label text-smoke">Version {t.version} · written {when(t.created_at)}</span>
        </div>
      </Section>

      <Section className="grid gap-12 pt-0 md:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <SectionHead title="The definition" />
            <p className="t-body measure-wide">{prose(v.definition)}</p>
            {v.exclusions ? <p className="t-small measure-wide text-graphite">Does not count: {prose(v.exclusions)}</p> : null}
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead title="What the evidence must establish" />
            <ol className="flex flex-col">
              {v.criteria.map((c) => (
                <li key={c.id} className="grid grid-cols-[100px_1fr] gap-4 border-b border-[#d9d9d9] py-3">
                  <span className="t-label text-smoke">Criterion {c.id.slice(1)}</span>
                  <span className="t-small">{prose(c.text)}</span>
                </li>
              ))}
              {[["Right subject", "Nothing in the evidence shows a different property, vehicle, consignment or premises."],
                ["Consistent cause", "What is shown fits the declared cause and this kind of event, not wear or another incident."],
                ["Documents agree", "The documents filed agree with what the photographs and the assessor show."]].map(([n, text]) => (
                <li key={n} className="grid grid-cols-[100px_1fr] gap-4 border-b border-[#d9d9d9] py-3">
                  <span className="t-label text-smoke">{n}</span>
                  <span className="t-small text-graphite">{text} Always asked.</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead title="Cover" />
            <div>
              <Row label="Benefit for an established event">{gen(v.benefit_wei)}</Row>
              <Row label="Claimant's bond">{gen(v.bond_wei)}</Row>
              <Row label="Evidence a claim must carry">
                {v.evidence_requirements.length ? v.evidence_requirements.map(evidenceRule).join(", ") : "Any photograph"}
              </Row>
              <Row label="Filing window">{plural(v.filing_window_days, "day")} from the event</Row>
              <Row label="Evidence period">{plural(v.evidence_days, "day")} from filing</Row>
              <Row label="Appeals">{v.max_appeals === 0 ? "None" : `${v.max_appeals}, within ${span(v.appeal_window_seconds)}`}</Row>
              <Row label="Appeal evidence period">{span(v.evidence_period_seconds)}</Row>
              <Row label="Independent assessor">
                {v.assessors.length ? `${v.assessor_required ? "Required" : "Optional"}; ${plural((t.accepted_assessors ?? []).length, "has", "have")} accepted`
                  : "None named"}
              </Row>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead title="Claims" aside={claims.data ? plural(claims.data.total, "claim") : undefined} />
            {claims.data ? (
              claims.data.claims.length ? (
                <ul>
                  {claims.data.claims.map((c) => (
                    <li key={c.claim_id}>
                      <Link href={`/claims/${c.claim_id}`}
                            className="grid gap-1 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_180px] md:gap-6 md:px-2">
                        <span className="t-small">{prose(c.subject)} <span className="text-smoke">· event of {day(c.event_date)}</span></span>
                        <span className="t-small">
                          {c.final ? <Outcome value={c.final.determination}>{outcome(c.final.determination)}</Outcome>
                            : <span className="text-graphite">{claimState(c.state)}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No claim has been filed under this event type.</Empty>
            ) : <Loading what="the claims" />}
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead title="Activity" />
            {events.data ? (
              <ol>
                {events.data.events.map((e) => (
                  <li key={e.n} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#d9d9d9] py-2">
                    <span className="t-small">
                      {chainEvent(e.kind)}{e.subject.startsWith("cl-") ? `: ${claimName(e.subject)}` : ""}
                    </span>
                    <span className="t-label text-smoke">{when(e.at)}</span>
                  </li>
                ))}
              </ol>
            ) : <Loading what="the activity" />}
          </div>
        </div>

        <aside className="flex flex-col gap-8 md:sticky md:top-6 md:self-start">
          <div className="hair flex flex-col gap-5 p-6">
            <p className="t-label text-smoke">Reserve</p>
            <p className="t-heading">{gen(t.free_wei ?? "0")} free</p>
            <div>
              <Row label="Held">{gen(t.reserve_wei)}</Row>
              <Row label="Committed to open claims">{gen(t.committed_wei)}</Row>
              <Row label="Paid in benefits">{gen(t.paid_wei)}</Row>
              <Row label="Bonds forfeited to it">{gen(t.forfeited_wei)}</Row>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="t-label text-smoke">File a claim</p>
            {acts.fileClaim.ok ? <ButtonLink href={`/types/${tid}/claim`}>File a claim</ButtonLink>
              : <p className="t-small text-smoke">{acts.fileClaim.why}</p>}
          </div>

          {named ? (
            <div className="flex flex-col gap-3">
              <p className="t-label text-smoke">Assessor</p>
              <Act label="Accept the assessor role" method="accept_assessor_role" args={[tid]} can={acts.acceptAssessor} />
            </div>
          ) : null}

          {isSponsor ? (
            <div className="flex flex-col gap-6">
              <p className="t-label text-smoke">You sponsor this event type</p>
              <Act label="Add to the reserve" method="fund_reserve" can={acts.fund} value={parseGen(fund) ?? 0n}
                   prepare={() => ((parseGen(fund) ?? 0n) > 0n ? [tid] : "Enter an amount of GEN.")}>
                <Field label="Amount, GEN"><input className="field" inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} /></Field>
              </Act>
              <Act label="Withdraw free reserve" method="withdraw_reserve" variant="secondary" can={acts.withdrawReserve}
                   prepare={() => {
                     const wei = parseGen(take);
                     return wei && wei > 0n ? [tid, wei.toString()] : "Enter an amount of GEN.";
                   }}>
                <Field label="Amount, GEN" hint={`Up to ${gen(t.free_wei ?? "0")}. It is credited to you to withdraw.`}>
                  <input className="field" inputMode="decimal" value={take} onChange={(e) => setTake(e.target.value)} />
                </Field>
              </Act>
              {t.state === "ACTIVE"
                ? <Act label="Pause new claims" method="set_type_state" args={[tid, "PAUSED"]} variant="secondary" can={acts.pause} />
                : <Act label="Take claims again" method="set_type_state" args={[tid, "ACTIVE"]} variant="secondary" can={acts.resume} />}
              {acts.publish.ok ? <ButtonLink href={`/types/${tid}/version`} variant="secondary">Publish a new version</ButtonLink>
                : <p className="t-small text-smoke">{acts.publish.why}</p>}
            </div>
          ) : null}

          <Disclosure summary="Verify this event type">
            <Machine label="Event type id" value={t.type_id} />
            <Machine label="Sponsor" value={t.sponsor} />
            {v.assessors.map((a) => <Machine key={a} label="Named assessor" value={a} />)}
          </Disclosure>
        </aside>
      </Section>
    </>
  );
}
