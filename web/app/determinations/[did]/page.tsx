"use client";

/**
 * The receipt: one determination as the contract recorded it. What was
 * decided, how each requirement was rated and on which evidence, what every
 * validator reproduced for itself, and the snapshot of the evidence it was
 * decided on. Machine values sit in the verification folds at the foot.
 */
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  Chip, Disclosure, Empty, Glyph, InkLink, Loading, Machine, Outcome, ReadFailure, Row, Section, SectionHead,
} from "@/components/bits";
import {
  claimName, determinationName, evidenceName, lifecycle, outcomeHeadline, prose, rating, requirementName, role, view,
  when, writeOut,
} from "@/lib/present";
import { getDetermination, getSnapshot } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Receipt() {
  const { did } = useParams<{ did: string }>();
  const det = useChain(`determination.${did}`, (f) => getDetermination(did, f));
  const d = det.data;
  const snap = useChain(d ? `snapshot.${d.snapshot_id}` : null, () => getSnapshot(d!.snapshot_id));

  if (det.error) return <Section><ReadFailure what="this determination" retrying={det.retrying} /></Section>;
  if (det.data === null) return <Section><Empty>There is no determination with this number.</Empty></Section>;
  if (!d) return <Section><Loading what="the determination" /></Section>;
  const bound = new Set(d.bound.requirements);
  const obs = d.notes.observations ?? [];

  return (
    <>
      <Section className="pb-6">
        <p className="t-label text-smoke">
          {determinationName(d.determination_id)} ·{" "}
          <Link href={`/claims/${d.claim_id}`} className="underline decoration-fog underline-offset-4">{claimName(d.claim_id)}</Link>
          {" "}· {d.kind === "READJUDICATION" ? "readjudicated on appeal" : "first assessment"}
        </p>
        <h1 className="t-display mt-3"><Outcome value={d.determination} size={30}>{outcomeHeadline(d.determination)}</Outcome></h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Chip>{lifecycle(d.lifecycle)}</Chip>
          <span className="t-label text-smoke">Decided {when(d.decided_at)}{d.finalized_at ? ` · final ${when(d.finalized_at)}` : ""}</span>
        </div>
        {d.superseded_by ? (
          <p className="t-small mt-4 text-graphite">
            Superseded on appeal by <InkLink href={`/determinations/${d.superseded_by}`}>{determinationName(d.superseded_by)}</InkLink>,
            which is kept beside it.
          </p>
        ) : null}
        {d.appeal_of ? (
          <p className="t-small mt-4 text-graphite">
            Reviews <InkLink href={`/determinations/${d.appeal_of}`}>{determinationName(d.appeal_of)}</InkLink>, appealed by
            the {role(d.appeal?.by ?? "").toLowerCase()}.
          </p>
        ) : null}
      </Section>

      <Section className="flex flex-col gap-12 pt-0">
        <div className="flex flex-col gap-4">
          <SectionHead title="Each requirement" aside="Code derives the outcome from these" />
          <ol>
            {d.requirements.map((r) => (
              <li key={r.id} className="grid gap-2 border-b border-[#d9d9d9] py-4 md:grid-cols-[180px_1fr_200px] md:gap-6">
                <span className="t-label text-smoke">{requirementName(r.id)}</span>
                <span className="flex flex-col gap-2">
                  <span className="t-small">{prose(r.text)}</span>
                  {d.notes.requirement_notes?.[r.id] ? (
                    <span className="t-small text-graphite">{writeOut(d.notes.requirement_notes[r.id])}</span>
                  ) : null}
                  {(d.notes.basis?.[r.id] ?? []).length ? (
                    <span className="t-label text-smoke">On {(d.notes.basis[r.id] ?? []).map(evidenceName).join(", ")}</span>
                  ) : null}
                </span>
                <span className="t-small inline-flex items-start gap-2">
                  <Glyph kind={r.status} />
                  <span>
                    {rating(r.status)}
                    {r.status === "NOT_APPLICABLE"
                      ? <span className="block t-label text-smoke">Decided in code from the file</span>
                      : bound.has(r.id) ? <span className="block t-label text-smoke">Reproduced by every validator</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div>
            <Row label="Evidence enough to decide">{d.evidence_sufficient ? "Yes" : "No"}</Row>
            <Row label="Contradiction found">{d.conflicts_detected ? "Yes" : "No"}</Row>
            {d.unseen.length ? <Row label="Photographs no node could examine">{d.unseen.map(evidenceName).join(", ")}</Row> : null}
          </div>
          {d.conflicts_detected && d.notes.conflict_note ? (
            <p className="t-small measure-wide text-graphite">The contradiction: {writeOut(d.notes.conflict_note)}</p>
          ) : null}
        </div>

        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionHead title="What was agreed" />
            <p className="t-small text-graphite">
              Every validator reached this outcome on its own reading of the evidence.
              {d.determination === "ESTABLISHED" ? " Each found every requirement met." : ""}
              {d.determination === "NOT_ESTABLISHED" ? " Each found the requirements marked above unmet, independently." : ""}
              {d.determination === "UNDETERMINED" ? " None could establish the event from this evidence." : ""}
              {" "}The other ratings and the reasoning below are the leading validator&apos;s, recorded as such.
            </p>
            {d.notes.reasoning ? (
              <blockquote className="t-small border-l border-ink pl-4 text-graphite">{writeOut(d.notes.reasoning)}</blockquote>
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead title="What was seen" />
            {obs.length ? (
              <ol className="flex flex-col gap-4">
                {obs.map((o) => (
                  <li key={o.evidence_id} className="flex flex-col gap-1">
                    <span className="t-label text-smoke">{evidenceName(o.evidence_id)} · {view(o.view)} · {role(o.role)}</span>
                    <span className="t-small">{o.seen ? prose(o.shows) : "Could not be examined, so it counted for nothing."}</span>
                    {o.subject_doubts ? <span className="t-small text-graphite">Doubt about the subject: {prose(o.subject_doubts)}</span> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="t-small text-smoke">No photograph notes were recorded.</p>}
          </div>
        </div>

        {d.appeal ? (
          <div className="flex flex-col gap-3">
            <SectionHead title="The appeal it answers" />
            <p className="t-small text-graphite">Opened by the {role(d.appeal.by).toLowerCase()} on {when(d.appeal.opened_at)}:</p>
            <blockquote className="t-small border-l border-ink pl-4 text-graphite">{prose(d.appeal.reason)}</blockquote>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <SectionHead title="Verify this receipt" />
          <Disclosure summary="The evidence snapshot it was decided on">
            {snap.data ? (
              <ol className="flex flex-col gap-3">
                {snap.data.evidence.map((e) => (
                  <li key={e.evidence_id} className="flex flex-col gap-1">
                    <span className="t-label text-smoke">
                      {evidenceName(e.evidence_id)} · {role(e.role)}{e.new_on_appeal ? " · new on appeal" : ""}
                    </span>
                    <code className="t-mono break-all">{e.content_hash}</code>
                  </li>
                ))}
              </ol>
            ) : <Loading what="the snapshot" />}
          </Disclosure>
          <Disclosure summary="Record identifiers">
            <Machine label="Determination id" value={d.determination_id} />
            <Machine label="Snapshot id" value={d.snapshot_id} />
            <Machine label="Claim id" value={d.claim_id} />
            <Machine label="Event type and version" value={`${d.type_id} v${d.type_version}`} />
            <Machine label="Asked for by" value={d.requested_by} />
          </Disclosure>
        </div>
      </Section>
    </>
  );
}
