"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Empty, Field, Loading, ReadFailure, Row, Section, SectionHead } from "@/components/bits";
import { typeActs } from "@/lib/acts";
import { evidenceRule, gen, plural, prose } from "@/lib/present";
import { claimsOf, getEventType, getTypeVersion } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

const today = () => new Date().toISOString().slice(0, 10);

export default function FileClaim() {
  const { tid } = useParams<{ tid: string }>();
  const router = useRouter();
  const w = useWallet();
  const type = useChain(`type.${tid}`, (f) => getEventType(tid, f));
  const t = type.data;
  const version = useChain(t ? `version.${tid}.${t.version}` : null, () => getTypeVersion(tid, t!.version));
  const mine = useChain(w.address ? `claimsof.${w.address}` : null, (f) => claimsOf(w.address, 0, 50, f));
  const [f, setF] = useState({ subject: "", subject_ref: "", location: "", event_date: today(), declared_cause: "",
                               account: "", assessor: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (type.error) return <Section><ReadFailure what="this event type" /></Section>;
  if (type.data === null) return <Section><Empty>There is no event type with this number.</Empty></Section>;
  if (!t || !version.data) return <Section><Loading what="the event type" /></Section>;
  const v = version.data;
  const openMine = (mine.data?.claims ?? []).filter((c) => c.type_id === tid && c.claimant.toLowerCase() === w.address.toLowerCase()
    && ["OPEN", "DETERMINED", "UNDER_APPEAL"].includes(c.state)).length;
  const can = typeActs(t, v, w.address, openMine).fileClaim;
  const accepted = t.accepted_assessors ?? [];

  const check = (): string => {
    if (f.subject.trim().length < 5) return "Name the subject: the property, vehicle, consignment or premises.";
    if (f.subject_ref.trim().length < 2) return "Give its identifier: an address, a plate, a consignment or policy number.";
    if (f.declared_cause.trim().length < 5) return "Say what caused it.";
    if (f.account.trim().length < 20) return "Give an account of at least 20 characters.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.event_date)) return "Give the event date.";
    if (v.assessor_required && !f.assessor) return "This event type needs an accepted assessor on the claim.";
    return "";
  };

  return (
    <Section>
      <div className="flex flex-col gap-3 pb-10">
        <p className="t-label text-smoke">{prose(t.title)}</p>
        <h1 className="t-display">File a claim</h1>
        <p className="t-body measure-wide text-graphite">
          Say what happened. The benefit is committed from the sponsor&apos;s reserve the moment the claim is filed, and
          you post the bond. Then file the photographs and documents the event type asks for, and ask for the assessment.
        </p>
      </div>
      <div className="grid gap-12 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <SectionHead title="What happened" />
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Subject" hint="The property, vehicle, consignment or premises.">
              <input className="field" value={f.subject} maxLength={300} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label="Identifier" hint="An address, a plate, a consignment or policy number.">
              <input className="field" value={f.subject_ref} maxLength={120} onChange={(e) => set("subject_ref", e.target.value)} />
            </Field>
            <Field label="Location">
              <input className="field" value={f.location} maxLength={300} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <Field label="Date of the event" hint={`Within ${plural(v.filing_window_days, "day")} of today, in UTC.`}>
              <input type="date" className="field" value={f.event_date} max={today()} onChange={(e) => set("event_date", e.target.value)} />
            </Field>
          </div>
          <Field label="Declared cause">
            <input className="field" value={f.declared_cause} maxLength={300} onChange={(e) => set("declared_cause", e.target.value)} />
          </Field>
          <Field label="Your account" hint="Recorded as your claim. Validators weigh it against what the photographs show.">
            <textarea className="field" value={f.account} maxLength={2000} onChange={(e) => set("account", e.target.value)} />
          </Field>
          {accepted.length ? (
            <Field label={v.assessor_required ? "Independent assessor, required" : "Independent assessor, optional"}
                   hint="An assessor's report counts as an observation neither party controls.">
              <select className="field" value={f.assessor} onChange={(e) => set("assessor", e.target.value)}>
                <option value="">{v.assessor_required ? "Choose one" : "None"}</option>
                {accepted.map((a, i) => <option key={a} value={a}>Assessor {i + 1}</option>)}
              </select>
            </Field>
          ) : null}
          <Act label="File the claim and post the bond" method="file_claim" value={BigInt(v.bond_wei)} can={can}
               working="Recording the claim and committing the benefit."
               prepare={() => {
                 const why = check();
                 if (why) return why;
                 return [tid, JSON.stringify({ ...f, subject: f.subject.trim(), subject_ref: f.subject_ref.trim(),
                                               location: f.location.trim(), declared_cause: f.declared_cause.trim(),
                                               account: f.account.trim() })];
               }}
               onAnswer={(a) => { if (a && !a.refused && typeof a.claim_id === "string") router.push(`/claims/${a.claim_id}`); }} />
        </div>
        <aside className="hair flex flex-col gap-4 self-start p-6">
          <p className="t-label text-smoke">What this claim carries</p>
          <div>
            <Row label="Bond you post">{gen(v.bond_wei)}</Row>
            <Row label="Benefit if established">{gen(v.benefit_wei)}</Row>
            <Row label="Evidence required">
              {v.evidence_requirements.length ? v.evidence_requirements.map(evidenceRule).join(", ") : "A photograph"}
            </Row>
            <Row label="Time to file evidence">{plural(v.evidence_days, "day")}</Row>
          </div>
          <p className="t-small text-graphite">
            Withdrawing before the evidence period ends returns the bond. A claim left to lapse forfeits it to the reserve.
          </p>
        </aside>
      </div>
    </Section>
  );
}
