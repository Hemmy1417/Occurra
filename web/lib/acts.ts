/**
 * What each wallet may do next, decided by the same rules the contract
 * enforces. Every rule here mirrors a guard in contracts/occurra.py, and
 * every act that is not available carries the reason in words, so a page
 * never shows a button the chain would refuse and never hides one without
 * saying why. The live proofs run these rules against chain state at every
 * step (scripts/proofs.mjs), and tests/acts.test.ts pins them on records
 * shaped exactly as the contract writes them.
 *
 * Pure: no React, no network. Time is passed in as milliseconds.
 */
import type { Claim, Determination, EventType, Evidence, RequirementType, Role, TypeVersion } from "./types";

export const MAX_VERSIONS = 8;
export const MAX_OPEN_PER_CLAIMANT = 3;
export const STALE_APPEAL_MS = 3 * 86_400_000;
export const QUOTAS: Record<Role, { IMAGE: number; TEXT: number }> = {
  CLAIMANT: { IMAGE: 6, TEXT: 4 },
  ASSESSOR: { IMAGE: 3, TEXT: 2 },
  SPONSOR: { IMAGE: 2, TEXT: 2 },
};
export const APPEAL_ADDITIONS = { IMAGE: 2, TEXT: 2 };
export const ASSESSOR_DOCUMENTS = ["ASSESSOR_REPORT"];

export interface Can {
  ok: boolean;
  /** Why not, in words; empty when ok. */
  why: string;
}

const yes: Can = { ok: true, why: "" };
const no = (why: string): Can => ({ ok: false, why });
const first = (...checks: [boolean, string][]): Can => {
  for (const [fails, why] of checks) if (fails) return no(why);
  return yes;
};

export const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const seq = (eid: string) => Number(String(eid).split("-").pop()) || 0;
const big = (v: string | number | undefined) => BigInt(v ?? 0);

/* ── evidence rules ───────────────────────────────────────────────────── */

type Item = Pick<Evidence, "kind" | "view" | "doc_type" | "role">;

export function meets(item: Item, rtype: RequirementType): boolean {
  switch (rtype) {
    case "SCENE_PHOTO": return item.kind === "IMAGE" && item.view === "SCENE";
    case "DAMAGE_PHOTO": return item.kind === "IMAGE" && item.view === "DAMAGE_DETAIL";
    case "IDENTIFIER_PHOTO": return item.kind === "IMAGE" && item.view === "IDENTIFIER";
    case "BEFORE_PHOTO": return item.kind === "IMAGE" && item.view === "BEFORE";
    default:
      if (ASSESSOR_DOCUMENTS.includes(rtype)) {
        return item.kind === "DOCUMENT" && item.doc_type === rtype && item.role === "ASSESSOR";
      }
      return item.kind === "DOCUMENT" && item.doc_type === rtype;
  }
}

/** The first evidence rule the file does not meet, in the contract's own words, or "". */
export function preflightGap(version: Pick<TypeVersion, "evidence_requirements">, items: Item[]): string {
  for (const r of version.evidence_requirements) {
    const have = items.filter((it) => meets(it, r.type)).length;
    if (have < r.min_count) {
      const what = r.type.toLowerCase().replace(/_/g, " ");
      return `the event type requires ${r.min_count} ${what}${r.min_count === 1 ? "" : "s"} before assessment; ${have} on file`;
    }
  }
  return "";
}

/** A photograph of the scene: an image that is not a photographed document. */
export const isScenePhoto = (it: Item) => it.kind === "IMAGE" && it.view !== "DOCUMENT_SCAN";

/* ── the event type ───────────────────────────────────────────────────── */

export interface TypeActs {
  fund: Can;
  publish: Can;
  pause: Can;
  resume: Can;
  withdrawReserve: Can;
  acceptAssessor: Can;
  fileClaim: Can;
}

/**
 * @param openMine how many open claims this wallet already holds under the type
 */
export function typeActs(type: EventType, version: TypeVersion, addr: string, openMine = 0): TypeActs {
  const sponsor = same(addr, type.sponsor);
  const named = version.assessors.some((a) => same(a, addr));
  const accepted = (type.accepted_assessors ?? []).some((a) => same(a, addr));
  const free = big(type.reserve_wei) - big(type.committed_wei);
  const notSponsor = "Only the event type's sponsor can do this.";
  return {
    fund: first([!addr, "Connect a wallet."], [!sponsor, notSponsor]),
    publish: first([!addr, "Connect a wallet."], [!sponsor, notSponsor],
                   [type.version >= MAX_VERSIONS, `An event type keeps at most ${MAX_VERSIONS} versions.`]),
    pause: first([!sponsor, notSponsor], [type.state !== "ACTIVE", "The event type is already paused."]),
    resume: first([!sponsor, notSponsor], [type.state !== "PAUSED", "The event type is already active."]),
    withdrawReserve: first([!sponsor, notSponsor], [free <= 0n, "Every unit of the reserve is committed to open claims."]),
    acceptAssessor: first([!addr, "Connect a wallet."],
                          [!named, "Only a wallet the event type names as an assessor takes up the role."],
                          [accepted, "This wallet has already accepted the role."]),
    fileClaim: first(
      [!addr, "Connect a wallet to file a claim."],
      [type.state !== "ACTIVE", "The event type is paused and takes no new claims."],
      [sponsor, "The sponsor cannot claim under its own event type."],
      [named, "An assessor of this event type cannot claim under it."],
      [free < big(version.benefit_wei), "The sponsor's reserve cannot cover this benefit now."],
      [version.assessor_required && (type.accepted_assessors ?? []).length === 0,
       "This event type needs an accepted assessor on every claim, and none has accepted yet."],
      [openMine >= MAX_OPEN_PER_CLAIMANT,
       `A wallet holds at most ${MAX_OPEN_PER_CLAIMANT} open claims under one event type.`],
    ),
  };
}

/* ── the claim ────────────────────────────────────────────────────────── */

/** The role this wallet files evidence as on this claim right now, or null. */
export function filerRole(c: Claim, addr: string): Role | null {
  if (same(addr, c.claimant)) return "CLAIMANT";
  if (c.assessor && same(addr, c.assessor)) return "ASSESSOR";
  if (c.appeal && c.appeal.by === "SPONSOR" && same(addr, c.sponsor)) return "SPONSOR";
  return null;
}

/** How many more items of a kind this role may file now. */
export function room(c: Claim, role: Role, bucket: "IMAGE" | "TEXT"): number {
  const mine = (c.evidence ?? []).filter((e) => e.role === role
    && (bucket === "IMAGE" ? e.kind === "IMAGE" : e.kind !== "IMAGE"));
  if (c.state === "UNDER_APPEAL" && c.appeal) {
    const added = mine.filter((e) => seq(e.evidence_id) > c.appeal!.mark).length;
    return Math.max(0, APPEAL_ADDITIONS[bucket] - added);
  }
  return Math.max(0, QUOTAS[role][bucket] - mine.length);
}

export interface ClaimActs {
  role: Role | null;
  fileImage: Can;
  fileDocument: Can;
  assess: Can;
  appeal: Can;
  readjudicate: Can;
  finalize: Can;
  close: Can;
  withdraw: Can;
  /** The first unmet evidence rule, in the contract's words, or "". */
  gap: string;
}

export function claimActs(c: Claim, version: TypeVersion, d: Determination | null, addr: string, now: number): ClaimActs {
  const role = filerRole(c, addr);
  const claimant = same(addr, c.claimant);
  const items = c.evidence ?? [];
  const gap = preflightGap(version, items);
  const evidenceOpen = c.state === "OPEN" ? now <= t(c.evidence_ends)
    : c.state === "UNDER_APPEAL" && !!c.appeal ? now <= t(c.appeal.evidence_ends) : false;
  const windowWhy = c.state === "OPEN" || c.state === "UNDER_APPEAL"
    ? (c.state === "OPEN" ? "The claim's evidence period has ended." : "The appeal's evidence period has ended.")
    : "Evidence is filed while the claim is open or during an appeal.";
  const noRole = "Only the claimant, the claim's assessor, or the sponsor during its own appeal files evidence.";

  const fileImage = first([!addr, "Connect a wallet."], [!role, noRole], [!evidenceOpen, windowWhy],
                          [!!role && room(c, role, "IMAGE") === 0, "This party has filed all the photographs it may."]);
  const fileDocument = first([!addr, "Connect a wallet."], [!role, noRole], [!evidenceOpen, windowWhy],
                             [!!role && room(c, role, "TEXT") === 0, "This party has filed all the documents it may."]);

  const assess = first(
    [!claimant, "Only the claimant asks for the assessment."],
    [c.state !== "OPEN", "An assessment is asked for once, while the claim is open."],
    [now > t(c.evidence_ends), "The claim's evidence period has ended; the claim can only be closed."],
    [gap !== "", gap ? gap.charAt(0).toUpperCase() + gap.slice(1) + "." : ""],
    [!items.some(isScenePhoto), "At least one photograph of the scene is needed."],
  );

  const appellant = d?.determination === "ESTABLISHED" ? same(addr, c.sponsor) : claimant;
  const appeal = first(
    [c.state !== "DETERMINED" || !d, "Only a standing determination is appealed."],
    [!!d && d.appeals_left <= 0, "No appeal is left on this claim."],
    [!!d && now > t(d.appeal_window_ends), "The appeal window has closed."],
    [!appellant, d?.determination === "ESTABLISHED"
      ? "Only the sponsor appeals an established event."
      : "Only the claimant appeals a determination that did not establish the event."],
  );

  const readjudicate = first(
    [!addr, "Connect a wallet."],
    [c.state !== "UNDER_APPEAL" || !c.appeal, "Only a claim under appeal is readjudicated."],
    [!!c.appeal && now <= t(c.appeal.evidence_ends), "The appeal's evidence period is still open, so both sides can still file."],
  );

  const finalize = first(
    [!addr, "Connect a wallet."],
    [c.state !== "DETERMINED" || !d, "Only a standing determination is finalized."],
    [!!d && d.appeals_left > 0 && now <= t(d.appeal_window_ends), "The appeal window is still open."],
  );

  let close: Can;
  if (!addr) close = no("Connect a wallet.");
  else if (c.state === "OPEN") {
    close = now > t(c.evidence_ends) ? yes : no("The claim's evidence period has not ended.");
  } else if (c.state === "UNDER_APPEAL" && c.appeal) {
    close = now > t(c.appeal.evidence_ends) + STALE_APPEAL_MS
      ? yes : no("An appeal closes only if undecided three days after its evidence period.");
  } else close = no("Only an open claim or a stale appeal is closed.");

  const withdraw = first(
    [!claimant, "Only the claimant withdraws a claim."],
    [c.state !== "OPEN", "A claim is withdrawn only before its assessment."],
    [now > t(c.evidence_ends), "The evidence period has ended; the claim can only be closed."],
  );

  return { role, fileImage, fileDocument, assess, appeal, readjudicate, finalize, close, withdraw, gap };
}

/** Document types this role may file on this claim. */
export function documentTypesFor(role: Role | null, all: string[]): string[] {
  if (!role) return [];
  return all.filter((d) => !ASSESSOR_DOCUMENTS.includes(d) || role === "ASSESSOR");
}
