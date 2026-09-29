"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import {
  Chip, Disclosure, Empty, Field, InkLink, Loading, Machine, Outcome, ReadFailure, Row, Section, SectionHead,
} from "@/components/bits";
import { EvidenceList, FileDocument, FilePhoto } from "@/components/Evidence";
import { claimActs } from "@/lib/acts";
import {
  claimName, claimState, day, determinationName, gen, lifecycle, outcome, outcomeHeadline, prose, relative, role,
  settledHow, when,
} from "@/lib/present";
import { getClaim, getDetermination, getEventType, getTypeVersion } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";
import type { Claim } from "@/lib/types";

const STAGES = ["Filed", "Evidence", "Determined", "Appeal", "Final"];

function stage(c: Claim): number {
  if (c.state === "FINAL" || c.state === "WITHDRAWN" || c.state === "CLOSED") return 4;
  if (c.state === "UNDER_APPEAL") return 3;
  if (c.state === "DETERMINED") return 2;
  return (c.evidence ?? []).length ? 1 : 0;
}

export default function ClaimPage() {
  const { cid } = useParams<{ cid: string }>();
  const w = useWallet();
  const now = useNow();
  const claim = useChain(`claim.${cid}`, (f) => getClaim(cid, f));
  const c = claim.data;
  const version = useChain(c ? `version.${c.type_id}.${c.type_version}` : null, () => getTypeVersion(c!.type_id, c!.type_version));
  const type = useChain(c ? `type.${c.type_id}` : null, (f) => getEventType(c!.type_id, f));
  const det = useChain(c?.determination_id ? `determination.${c.determination_id}` : null,
                       (f) => getDetermination(c!.determination_id!, f));
  const [reason, setReason] = useState("");

  if (claim.error) return <Section><ReadFailure what="this claim" /></Section>;
  if (claim.data === null) return <Section><Empty>There is no claim with this number.</Empty></Section>;
  if (!c || !version.data) return <Section><Loading what="the claim" /></Section>;
  const d = det.data ?? null;
  const acts = claimActs(c, version.data, d, w.address, now);
  const at = stage(c);
  const closedOut = c.state === "WITHDRAWN" || c.state === "CLOSED";

  return (
    <>
      <Section className="pb-6">
        <p className="t-label text-smoke">
          {claimName(c.claim_id)} · <Link href={`/types/${c.type_id}`} className="underline decoration-fog underline-offset-4">
            {type.data ? prose(type.data.title) : "the event type"}</Link> · version {c.type_version}
        </p>
        <h1 className="t-display mt-3 max-w-[860px]">{prose(c.subject)}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Chip>{claimState(c.state)}</Chip>
          <span className="t-label text-smoke">Event of {day(c.event_date)} · filed {when(c.filed_at)}</span>
        </div>
        <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Where this claim is">
          {STAGES.map((s, i) => (
            <li key={s} className="flex flex-col gap-2">
              <span className={`h-[3px] ${i <= at ? "bg-obsidian" : "bg-[#d9d9d9]"}`} />
              <span className={`t-label ${i === at ? "text-obsidian" : "text-smoke"}`}>{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="grid gap-12 pt-0 md:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-12">
          {c.final ? (
            <div className="hair flex flex-col gap-3 p-6">
              <p className="t-label text-smoke">Final</p>
              <p className="t-heading"><Outcome value={c.final.determination}>{outcomeHeadline(c.final.determination)}</Outcome></p>
              <p className="t-small text-graphite">
                {settledHow(c.final.how)} on {when(c.final.at)}.{" "}
                {c.final.determination === "ESTABLISHED"
                  ? `The claimant was credited the benefit of ${gen(c.final.paid_wei)} and the bond of ${gen(c.bond_wei)}.`
                  : c.final.bond_to === "SPONSOR_RESERVE"
                    ? `The bond of ${gen(c.bond_wei)} went to the sponsor's reserve; no benefit was paid.`
                    : `The bond of ${gen(c.bond_wei)} was returned to the claimant; no benefit was paid.`}
              </p>
              <InkLink href={`/determinations/${c.final.determination_id}`}>Read the receipt</InkLink>
            </div>
          ) : closedOut ? (
            <div className="hair flex flex-col gap-2 p-6">
              <p className="t-label text-smoke">{claimState(c.state)}</p>
              <p className="t-small text-graphite">
                {prose(c.close_reason)} on {when(c.closed_at)}. The benefit went back to the reserve and the bond
                {c.bond_to === "SPONSOR_RESERVE" ? " was forfeited to it." : " was returned to the claimant."}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <SectionHead title="The claim" />
            <div>
              <Row label="Identifier">{prose(c.subject_ref)}</Row>
              {c.location ? <Row label="Location">{prose(c.location)}</Row> : null}
              <Row label="Declared cause">{prose(c.declared_cause)}</Row>
              <Row label="Benefit if established">{gen(c.benefit_wei)}</Row>
              <Row label="Bond">{gen(c.bond_wei)}</Row>
              <Row label="Independent assessor">{c.assessor ? "Nominated" : "None"}</Row>
            </div>
            <p className="t-label mt-2 text-smoke">The claimant&apos;s account, a claim</p>
            <blockquote className="t-body measure-wide border-l border-ink pl-4 text-graphite">{prose(c.account)}</blockquote>
          </div>

          <div className="flex flex-col gap-6">
            <SectionHead title="Evidence" aside={`${(c.evidence ?? []).length} filed`} />
            <EvidenceList claim={c} />
            {acts.role && (acts.fileImage.ok || acts.fileDocument.ok) ? (
              <div className="flex flex-col gap-8 border-t border-ink pt-6">
                <p className="t-label text-smoke">File as the {role(acts.role).toLowerCase()}</p>
                <FilePhoto claim={c} acts={acts} />
                <FileDocument claim={c} acts={acts} />
              </div>
            ) : null}
          </div>

          {c.determinations.length ? (
            <div className="flex flex-col gap-4">
              <SectionHead title="Determinations" />
              <ol>
                {[...c.determinations].reverse().map((did) => (
                  <li key={did}>
                    <DeterminationRow did={did} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-8 md:sticky md:top-6 md:self-start">
          {c.state === "OPEN" ? (
            <div className="flex flex-col gap-3">
              <p className="t-label text-smoke">Evidence period ends {relative(c.evidence_ends, now)}</p>
              <Act label="Ask for the assessment" method="request_assessment" args={[cid]} can={acts.assess}
                   working="Each validator examines the photographs, reads the documents and rates every requirement. This takes a few minutes." />
              <Act label="Withdraw the claim" method="withdraw_claim" args={[cid]} variant="secondary" can={acts.withdraw} />
              {acts.close.ok ? <Act label="Close the lapsed claim" method="close_claim" args={[cid]} variant="secondary" can={acts.close} /> : null}
            </div>
          ) : null}

          {c.state === "DETERMINED" && d ? (
            <div className="flex flex-col gap-4">
              <p className="t-label text-smoke">Standing determination</p>
              <p className="t-sub"><Outcome value={d.determination}>{outcome(d.determination)}</Outcome></p>
              <p className="t-small text-graphite">
                {d.appeals_left > 0
                  ? `${lifecycle(d.lifecycle)} until ${when(d.appeal_window_ends)}.`
                  : "No appeal is left, so it can be finalized now."}
              </p>
              <InkLink href={`/determinations/${d.determination_id}`}>Read the receipt</InkLink>
              <Act label="Appeal the determination" method="open_appeal" can={acts.appeal} variant="secondary"
                   prepare={() => (reason.trim().length >= 10 ? [cid, reason.trim()] : "State the grounds in at least 10 characters.")}>
                {acts.appeal.ok ? (
                  <Field label="Grounds of appeal" hint="Argument, not evidence. Once the appeal is open you must file at least one new photograph or document, or it closes with the determination standing.">
                    <textarea className="field" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                ) : null}
              </Act>
              <Act label="Finalize" method="finalize" args={[cid]} can={acts.finalize} />
            </div>
          ) : null}

          {c.state === "UNDER_APPEAL" && c.appeal ? (
            <div className="flex flex-col gap-4">
              <p className="t-label text-smoke">Appeal by the {role(c.appeal.by).toLowerCase()}</p>
              <blockquote className="t-small border-l border-ink pl-3 text-graphite">{prose(c.appeal.reason)}</blockquote>
              <p className="t-small text-graphite">
                Both sides may file new evidence until {when(c.appeal.evidence_ends)}. The appeal is judged again only
                if the {role(c.appeal.by).toLowerCase()} files something new; otherwise it closes and the
                determination stands.
              </p>
              <Act label="Ask for the readjudication" method="readjudicate" args={[cid]} can={acts.readjudicate}
                   working="Validators judge the whole file again, with the evidence filed during the appeal." />
              {acts.close.ok ? <Act label="Close the appeal" method="close_claim" args={[cid]} variant="secondary" can={acts.close} /> : null}
            </div>
          ) : null}

          <Disclosure summary="Verify this claim">
            <Machine label="Claim id" value={c.claim_id} />
            <Machine label="Claimant" value={c.claimant} />
            <Machine label="Sponsor" value={c.sponsor} />
            {c.assessor ? <Machine label="Assessor" value={c.assessor} /> : null}
          </Disclosure>
        </aside>
      </Section>
    </>
  );
}

function DeterminationRow({ did }: { did: string }) {
  const d = useChain(`determination.${did}`, (f) => getDetermination(did, f));
  if (!d.data) return <p className="t-small border-b border-[#d9d9d9] py-4 text-smoke">Reading {determinationName(did).toLowerCase()}.</p>;
  const x = d.data;
  return (
    <Link href={`/determinations/${did}`}
          className="grid gap-1 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_200px] md:gap-6 md:px-2">
      <span className="t-small">
        <Outcome value={x.determination}>{outcome(x.determination)}</Outcome>
        <span className="text-smoke"> · {x.kind === "READJUDICATION" ? "on appeal" : "first assessment"} · {when(x.decided_at)}</span>
      </span>
      <span className="t-label text-graphite">{lifecycle(x.lifecycle)}</span>
    </Link>
  );
}
