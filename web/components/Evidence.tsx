"use client";

/**
 * The evidence on a claim, as filed: each photograph read from the chain and
 * its bytes hashed in this browser against the digest the contract recorded,
 * each document's text, and what the filer said about it, shown as their
 * claim. Filing forms sit beside the list, for the parties who may file now.
 */
import { useEffect, useState } from "react";

import { Act } from "./Act";
import { Disclosure, Field, Machine } from "./bits";
import { documentTypesFor, type ClaimActs } from "@/lib/acts";
import { preparePhoto, type PreparedImage } from "@/lib/images";
import { docType, evidenceKind, evidenceName, prose, role, view, when } from "@/lib/present";
import { getEvidenceText, getImage } from "@/lib/read";
import type { Claim, Evidence } from "@/lib/types";

function Photo({ item }: { item: Evidence }) {
  const [src, setSrc] = useState<string | null>(null);
  const [match, setMatch] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    getImage(item.evidence_id).then((img) => {
      if (!alive) return;
      url = URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: "image/jpeg" }));
      setSrc(url);
      setMatch(img.digest === item.content_hash);
    }, () => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.evidence_id, item.content_hash]);
  return (
    <figure className="flex flex-col gap-3">
      <div className="hair-soft flex aspect-[4/3] items-center justify-center overflow-hidden bg-haze">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${view(item.view ?? "")} filed by the ${role(item.role).toLowerCase()}`}
               className="h-full w-full object-cover" />
        ) : (
          <span className="t-label text-smoke">{failed ? "Could not read the photograph" : "Reading the photograph"}</span>
        )}
      </div>
      {match === false ? (
        <p className="t-small text-obsidian">These bytes do not match the digest the contract recorded.</p>
      ) : null}
    </figure>
  );
}

function DocumentBody({ item }: { item: Evidence }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getEvidenceText(item.evidence_id).then((t) => { if (alive) setText(t ?? ""); }, () => { if (alive) setText(""); });
    return () => { alive = false; };
  }, [item.evidence_id]);
  return (
    <blockquote className="hair-soft t-small whitespace-pre-wrap bg-haze p-4 text-graphite">
      {text === null ? "Reading the document." : prose(text) || "The document could not be read."}
    </blockquote>
  );
}

export function EvidenceList({ claim }: { claim: Claim }) {
  const items = claim.evidence ?? [];
  if (!items.length) return <p className="t-body text-smoke">Nothing has been filed yet.</p>;
  return (
    <ol className="grid gap-8 md:grid-cols-2">
      {items.map((it) => (
        <li key={it.evidence_id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="t-sub">{evidenceKind(it)}</span>
            <span className="t-label text-smoke">
              {evidenceName(it.evidence_id)} · {role(it.role)}{it.during_appeal ? " · during the appeal" : ""}
            </span>
          </div>
          {it.kind === "IMAGE" ? <Photo item={it} /> : <DocumentBody item={it} />}
          {it.title ? <p className="t-small text-obsidian">{prose(it.title)}</p> : null}
          {it.description ? (
            <p className="t-small text-graphite">The filer says: &ldquo;{prose(it.description)}&rdquo;</p>
          ) : null}
          {it.capture_note ? <p className="t-small text-smoke">Capture note: {prose(it.capture_note)}</p> : null}
          <p className="t-label text-smoke">Filed {when(it.submitted_at)}</p>
          <Disclosure summary="Verify this item">
            <Machine label="Evidence id" value={it.evidence_id} />
            <Machine label="sha256 recorded at filing" value={it.content_hash} />
            <Machine label="Filed by" value={it.submitter} />
          </Disclosure>
        </li>
      ))}
    </ol>
  );
}

const VIEWS = ["SCENE", "DAMAGE_DETAIL", "IDENTIFIER", "BEFORE", "DOCUMENT_SCAN"];
const DOCS = ["INCIDENT_REPORT", "REPAIR_ESTIMATE", "DELIVERY_RECORD", "CLOSURE_NOTICE", "CLAIMANT_STATEMENT",
              "ASSESSOR_REPORT"];

export function FilePhoto({ claim, acts }: { claim: Claim; acts: ClaimActs }) {
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [problem, setProblem] = useState("");
  const [v, setV] = useState("SCENE");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);
  return (
    <Act label="File the photograph" method="submit_image" can={acts.fileImage}
         working="Storing the photograph on chain and recording its digest."
         prepare={() => {
           if (!photo) return "Choose a photograph first.";
           const meta = { view: v, description: description.trim(),
                          capture_note: note.trim() || photo.claimedCapture };
           return [claim.claim_id, JSON.stringify(meta), photo.bytes];
         }}
         onAnswer={(a) => { if (a && !a.refused) { setPhoto(null); setDescription(""); setNote(""); } }}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Photograph" hint="Redrawn in this browser as a JPEG under 400 KB, the form validators read.">
          <input type="file" accept="image/*" className="t-small" onChange={(e) => {
            const f = e.target.files?.[0];
            setProblem("");
            if (!f) return;
            preparePhoto(f).then(setPhoto, (err: unknown) => setProblem(String((err as Error).message ?? err)));
          }} />
        </Field>
        <Field label="What it shows">
          <select className="field" value={v} onChange={(e) => setV(e.target.value)}>
            {VIEWS.map((x) => <option key={x} value={x}>{view(x)}</option>)}
          </select>
        </Field>
        <Field label="Your description" hint="Recorded as your claim about the photograph; validators look before they read it.">
          <input className="field" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="When and where it was taken" hint="Optional. Read from the photo itself when it carries a date.">
          <input className="field" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.preview} alt="The photograph as it will be filed" className="hair-soft max-h-64 w-auto" />
      ) : null}
      {problem ? <p className="t-small text-obsidian">{problem}</p> : null}
    </Act>
  );
}

export function FileDocument({ claim, acts }: { claim: Claim; acts: ClaimActs }) {
  const types = documentTypesFor(acts.role, DOCS);
  const [d, setD] = useState(types[0] ?? "INCIDENT_REPORT");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <Act label="File the document" method="submit_document" can={acts.fileDocument}
         prepare={() => {
           if (!text.trim()) return "Write or paste the document's text first.";
           return [claim.claim_id, JSON.stringify({ doc_type: d, title: title.trim() }), text];
         }}
         onAnswer={(a) => { if (a && !a.refused) { setTitle(""); setText(""); } }}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Kind of document">
          <select className="field" value={d} onChange={(e) => setD(e.target.value)}>
            {types.map((x) => <option key={x} value={x}>{docType(x)}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <Field label="Text" hint={`${text.length.toLocaleString("en-GB")} of 6,000 characters. Stored on chain as filed.`}>
        <textarea className="field" value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Act>
  );
}
