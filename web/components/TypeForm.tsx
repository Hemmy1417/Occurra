"use client";

/**
 * Writing an event type, or a new version of one. The form holds exactly the
 * fields the contract reads, checks what it can count before anything is
 * signed, and shows the contract's own sentence if it refuses anyway.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Act } from "./Act";
import { Button, Field, SectionHead } from "./bits";
import { category as categoryName, eventKind, gen, parseGen, requirementType } from "@/lib/present";
import type { Category, TypeVersion } from "@/lib/types";

export const KINDS: Record<Category, string[]> = {
  PROPERTY: ["WATER_DAMAGE", "FIRE_DAMAGE", "STORM_DAMAGE", "FORCED_ENTRY", "STRUCTURAL_DAMAGE"],
  VEHICLE: ["COLLISION_DAMAGE", "VANDALISM_DAMAGE", "GLASS_DAMAGE"],
  CARGO: ["TRANSIT_DAMAGE", "SHORT_DELIVERY", "WATER_INGRESS"],
  BUSINESS_INTERRUPTION: ["PREMISES_DAMAGE_CLOSURE", "ACCESS_OBSTRUCTED"],
};
const RULES = ["SCENE_PHOTO", "DAMAGE_PHOTO", "IDENTIFIER_PHOTO", "BEFORE_PHOTO", "INCIDENT_REPORT", "REPAIR_ESTIMATE",
               "DELIVERY_RECORD", "CLOSURE_NOTICE"];
const WEI = 10n ** 18n;

interface Draft {
  title: string;
  category: Category;
  event_kind: string;
  definition: string;
  exclusions: string;
  criteria: string[];
  rules: Record<string, number>;
  benefit: string;
  bond: string;
  filing_days: string;
  evidence_days: string;
  appeal_hours: string;
  period_hours: string;
  max_appeals: string;
  assessors: string;
  assessor_required: boolean;
  reserve: string;
}

function fromVersion(v?: TypeVersion): Draft {
  const rules: Record<string, number> = {};
  for (const r of v?.evidence_requirements ?? [{ type: "SCENE_PHOTO", min_count: 1 }, { type: "DAMAGE_PHOTO", min_count: 1 }]) {
    if (r.type !== "ASSESSOR_REPORT") rules[r.type] = r.min_count;
  }
  const g = (wei?: string) => (wei ? gen(wei, false).replace(/,/g, "") : "");
  return {
    title: v?.title ?? "",
    category: v?.category ?? "PROPERTY",
    event_kind: v?.event_kind ?? "WATER_DAMAGE",
    definition: v?.definition ?? "",
    exclusions: v?.exclusions ?? "",
    criteria: v?.criteria.map((c) => c.text) ?? ["", ""],
    rules,
    benefit: g(v?.benefit_wei) || "2",
    bond: g(v?.bond_wei) || "0.1",
    filing_days: String(v?.filing_window_days ?? 30),
    evidence_days: String(v?.evidence_days ?? 14),
    appeal_hours: String((v?.appeal_window_seconds ?? 86_400) / 3600),
    period_hours: String((v?.evidence_period_seconds ?? 86_400) / 3600),
    max_appeals: String(v?.max_appeals ?? 1),
    assessors: (v?.assessors ?? []).join("\n"),
    assessor_required: v?.assessor_required ?? false,
    reserve: "5",
  };
}

/** The JSON the contract reads, or a sentence saying what to fix. */
export function buildType(d: Draft): { json: string; reserveWei: bigint } | string {
  const benefit = parseGen(d.benefit);
  const bond = parseGen(d.bond || "0");
  const reserve = parseGen(d.reserve || "0");
  if (d.title.trim().length < 4) return "Give the event type a title.";
  if (d.definition.trim().length < 30) return "The definition needs at least 30 characters: say what counts as this event.";
  const criteria = d.criteria.map((c) => c.trim()).filter(Boolean);
  if (criteria.length < 1 || criteria.length > 8) return "State between one and eight criteria.";
  if (criteria.some((c) => c.length < 10)) return "Each criterion needs at least 10 characters.";
  if (benefit === null || benefit < 10n ** 16n || benefit > 1000n * WEI) return "The benefit must be between 0.01 and 1,000 GEN.";
  if (bond === null || bond > benefit) return "The bond must be between zero and the benefit.";
  if (reserve === null) return "The opening reserve must be an amount of GEN.";
  const hours = (h: string) => Math.round(Number(h) * 3600);
  const appeal = hours(d.appeal_hours);
  const period = hours(d.period_hours);
  if (!(appeal >= 600 && appeal <= 30 * 86_400) || !(period >= 600 && period <= 30 * 86_400)) {
    return "The appeal window and evidence period must each be between ten minutes and thirty days.";
  }
  const assessors = d.assessors.split(/[\s,]+/).map((a) => a.trim()).filter(Boolean);
  if (assessors.some((a) => !/^0x[0-9a-fA-F]{40}$/.test(a))) return "Each assessor must be a wallet address.";
  if (d.assessor_required && !assessors.length) return "An event type that requires an assessor must name at least one.";
  const json = JSON.stringify({
    title: d.title.trim(), category: d.category, event_kind: d.event_kind, definition: d.definition.trim(),
    exclusions: d.exclusions.trim(), criteria,
    evidence_requirements: Object.entries(d.rules).filter(([, n]) => n > 0).map(([type, n]) => ({ type, min_count: n })),
    benefit_wei: benefit.toString(), bond_wei: bond.toString(),
    filing_window_days: Number(d.filing_days), evidence_days: Number(d.evidence_days),
    appeal_window_seconds: appeal, evidence_period_seconds: period, max_appeals: Number(d.max_appeals),
    assessors, assessor_required: d.assessor_required,
  });
  return { json, reserveWei: reserve };
}

export function TypeForm({ base, tid }: { base?: TypeVersion; tid?: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => fromVersion(base));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const versioning = !!tid;
  const built = buildType(d);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <SectionHead title="The event" />
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Title"><input className="field" value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className="field" value={d.category} disabled={versioning}
                      onChange={(e) => { const c = e.target.value as Category; setD((x) => ({ ...x, category: c, event_kind: KINDS[c][0]! })); }}>
                {(Object.keys(KINDS) as Category[]).map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}
              </select>
            </Field>
            <Field label="Event kind">
              <select className="field" value={d.event_kind} disabled={versioning} onChange={(e) => set("event_kind", e.target.value)}>
                {KINDS[d.category].map((k) => <option key={k} value={k}>{eventKind(k)}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <Field label="Definition" hint="What counts as this event, in plain words. Validators judge every claim against it.">
          <textarea className="field" value={d.definition} maxLength={2000} onChange={(e) => set("definition", e.target.value)} />
        </Field>
        <Field label="Exclusions" hint="Optional. What does not count.">
          <textarea className="field" value={d.exclusions} maxLength={2000} onChange={(e) => set("exclusions", e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-6">
        <SectionHead title="Criteria" aside={`${d.criteria.filter((c) => c.trim()).length} of 8`} />
        <p className="t-small measure-wide text-graphite">
          Checkable statements the evidence must establish. Validators rate each one on its own, beside three checks
          the contract always asks: the right subject, a consistent cause, and documents that agree with the photographs.
        </p>
        {d.criteria.map((c, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="t-label mt-3 w-8 text-smoke">C{i + 1}</span>
            <input className="field" value={c} maxLength={300}
                   onChange={(e) => set("criteria", d.criteria.map((x, j) => (j === i ? e.target.value : x)))} />
            {d.criteria.length > 1 ? (
              <Button variant="secondary" onClick={() => set("criteria", d.criteria.filter((_, j) => j !== i))}>Remove</Button>
            ) : null}
          </div>
        ))}
        {d.criteria.length < 8 ? (
          <div><Button variant="secondary" onClick={() => set("criteria", [...d.criteria, ""])}>Add a criterion</Button></div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <SectionHead title="Evidence a claim must carry" />
        <p className="t-small measure-wide text-graphite">
          Checked in code before any validator is asked. A claim missing one is refused in words, and nothing is spent on
          judgment.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {RULES.map((r) => (
            <label key={r} className="flex items-center justify-between gap-4 border-b border-[#d9d9d9] py-2">
              <span className="t-small">{requirementType(r).charAt(0).toUpperCase() + requirementType(r).slice(1)}</span>
              <select className="field w-24" value={d.rules[r] ?? 0}
                      onChange={(e) => set("rules", { ...d.rules, [r]: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? "None" : n}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <SectionHead title="Cover and windows" />
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Benefit, GEN" hint="Committed from the reserve the moment a claim is filed.">
            <input className="field" inputMode="decimal" value={d.benefit} onChange={(e) => set("benefit", e.target.value)} />
          </Field>
          <Field label="Claimant's bond, GEN" hint="Returned unless the event is found not established.">
            <input className="field" inputMode="decimal" value={d.bond} onChange={(e) => set("bond", e.target.value)} />
          </Field>
          <Field label="Appeals per claim">
            <select className="field" value={d.max_appeals} onChange={(e) => set("max_appeals", e.target.value)}>
              {["0", "1", "2"].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Filing window, days" hint="From the event date.">
            <input className="field" inputMode="numeric" value={d.filing_days} onChange={(e) => set("filing_days", e.target.value)} />
          </Field>
          <Field label="Evidence period, days" hint="From filing, before the claim lapses.">
            <input className="field" inputMode="numeric" value={d.evidence_days} onChange={(e) => set("evidence_days", e.target.value)} />
          </Field>
          <Field label="Appeal window, hours">
            <input className="field" inputMode="decimal" value={d.appeal_hours} onChange={(e) => set("appeal_hours", e.target.value)} />
          </Field>
          <Field label="Appeal evidence period, hours" hint="Both sides may file before a readjudication.">
            <input className="field" inputMode="decimal" value={d.period_hours} onChange={(e) => set("period_hours", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <SectionHead title="Independent assessors" aside="Optional" />
        <Field label="Wallets, one per line" hint="Each must accept the role before a claimant can nominate it. Never the sponsor.">
          <textarea className="field t-mono" value={d.assessors} onChange={(e) => set("assessors", e.target.value)} />
        </Field>
        <label className="t-small flex items-center gap-3">
          <input type="checkbox" checked={d.assessor_required} onChange={(e) => set("assessor_required", e.target.checked)} />
          Every claim needs an accepted assessor and their report
        </label>
      </div>

      <div className="flex flex-col gap-6">
        <SectionHead title={versioning ? "Publish" : "Fund and write"} />
        {!versioning ? (
          <Field label="Opening reserve, GEN" hint="Your own capital. Anything not committed to an open claim can be withdrawn.">
            <input className="field md:w-64" inputMode="decimal" value={d.reserve} onChange={(e) => set("reserve", e.target.value)} />
          </Field>
        ) : (
          <p className="t-small measure-wide text-graphite">
            Claims already filed keep the version they were filed under. Only new claims bind this one.
          </p>
        )}
        {versioning ? (
          <Act label="Publish the version" method="publish_version"
               prepare={() => (typeof built === "string" ? built : [tid, built.json])}
               onAnswer={(a) => { if (a && !a.refused) router.push(`/types/${tid}`); }} />
        ) : (
          <Act label="Write the event type" method="create_event_type"
               value={typeof built === "string" ? 0n : built.reserveWei}
               prepare={() => (typeof built === "string" ? built : [built.json])}
               onAnswer={(a) => { if (a && !a.refused && typeof a.type_id === "string") router.push(`/types/${a.type_id}`); }} />
        )}
      </div>
    </div>
  );
}
