/**
 * Every word a person reads passes through here. The contract speaks in
 * SCREAMING_SNAKE because a state machine should; a page should not.
 * Identifiers, addresses, digests and raw enum names never appear in reading
 * flow; they belong on the verification views, where a reader has asked to
 * see exactly what was recorded.
 */

export function humanize(value: string): string {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const spaced = t.replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function label(map: Record<string, string>, key: string | null | undefined): string {
  const k = String(key ?? "").trim();
  if (!k) return "";
  return map[k] ?? humanize(k);
}

export const category = (s: string) => label({
  PROPERTY: "Property", VEHICLE: "Vehicle", CARGO: "Cargo", BUSINESS_INTERRUPTION: "Business interruption",
}, s);

export const eventKind = (s: string) => label({
  WATER_DAMAGE: "Water damage", FIRE_DAMAGE: "Fire damage", STORM_DAMAGE: "Storm damage",
  FORCED_ENTRY: "Forced entry", STRUCTURAL_DAMAGE: "Structural damage", COLLISION_DAMAGE: "Collision damage",
  VANDALISM_DAMAGE: "Vandalism damage", GLASS_DAMAGE: "Glass damage", TRANSIT_DAMAGE: "Damage in transit",
  SHORT_DELIVERY: "Short delivery", WATER_INGRESS: "Water ingress",
  PREMISES_DAMAGE_CLOSURE: "Closure after damage to the premises", ACCESS_OBSTRUCTED: "Access obstructed",
}, s);

export const typeState = (s: string) => label({ ACTIVE: "Taking claims", PAUSED: "Paused" }, s);

export const claimState = (s: string) => label({
  OPEN: "Gathering evidence", DETERMINED: "Determined", UNDER_APPEAL: "Under appeal", FINAL: "Final",
  WITHDRAWN: "Withdrawn", CLOSED: "Closed",
}, s);

export const outcome = (s: string | null | undefined) => label({
  ESTABLISHED: "Established", NOT_ESTABLISHED: "Not established", UNDETERMINED: "Undetermined",
}, s);

export const outcomeHeadline = (s: string | null | undefined) => label({
  ESTABLISHED: "The event is established",
  NOT_ESTABLISHED: "The event is not established",
  UNDETERMINED: "The evidence did not settle it",
}, s);

export const rating = (s: string) => label({
  SATISFIED: "Satisfied", NOT_SATISFIED: "Not satisfied", NOT_ESTABLISHED: "Not established",
  NOT_APPLICABLE: "Does not apply",
}, s);

export const lifecycle = (s: string) => label({
  APPEALABLE: "Open to appeal", APPEALED: "Under appeal", SUPERSEDED: "Superseded on appeal", FINAL: "Final",
}, s);

export const role = (s: string) => label({ CLAIMANT: "Claimant", ASSESSOR: "Assessor", SPONSOR: "Sponsor" }, s);

export const view = (s: string) => label({
  SCENE: "Scene photograph", DAMAGE_DETAIL: "Damage close-up", IDENTIFIER: "Identifier photograph",
  BEFORE: "Before photograph", DOCUMENT_SCAN: "Photographed document",
}, s);

export const docType = (s: string) => label({
  INCIDENT_REPORT: "Incident report", REPAIR_ESTIMATE: "Repair estimate", DELIVERY_RECORD: "Delivery record",
  CLOSURE_NOTICE: "Closure notice", CLAIMANT_STATEMENT: "Claimant statement", ASSESSOR_REPORT: "Assessor's report",
}, s);

const REQ: Record<string, [string, string]> = {
  SCENE_PHOTO: ["scene photograph", "scene photographs"],
  DAMAGE_PHOTO: ["damage close-up", "damage close-ups"],
  IDENTIFIER_PHOTO: ["identifier photograph", "identifier photographs"],
  BEFORE_PHOTO: ["before photograph", "before photographs"],
  INCIDENT_REPORT: ["incident report", "incident reports"],
  REPAIR_ESTIMATE: ["repair estimate", "repair estimates"],
  DELIVERY_RECORD: ["delivery record", "delivery records"],
  CLOSURE_NOTICE: ["closure notice", "closure notices"],
  ASSESSOR_REPORT: ["assessor's report", "assessor's reports"],
};
export function requirementType(type: string, n = 1): string {
  const pair = REQ[type];
  return pair ? pair[n === 1 ? 0 : 1] : humanize(type).toLowerCase();
}
export const evidenceRule = (r: { type: string; min_count: number }) =>
  `${r.min_count} ${requirementType(r.type, r.min_count)}`;

export function evidenceKind(e: { kind: string; view?: string; doc_type?: string }): string {
  return e.kind === "IMAGE" ? view(e.view ?? "") : docType(e.doc_type ?? "");
}

const EVENT: Record<string, string> = {
  TYPE_CREATED: "Event type written", RESERVE_FUNDED: "Reserve funded", VERSION_PUBLISHED: "New version published",
  TYPE_PAUSED: "Paused", TYPE_ACTIVE: "Taking claims again", RESERVE_WITHDRAWN: "Reserve withdrawn",
  ASSESSOR_ACCEPTED: "Assessor accepted the role", CLAIM_FILED: "Claim filed", EVIDENCE_FILED: "Evidence filed",
  DETERMINATION_RECORDED: "Determination recorded", APPEAL_OPENED: "Appeal opened", CLAIM_FINAL: "Claim final",
  CLAIM_CLOSED: "Claim closed", CLAIM_WITHDRAWN: "Claim withdrawn",
};
export const chainEvent = (s: string) => label(EVENT, s);

export const settledHow = (s: string) => label({
  finalized: "Finalized after the appeal window", "appeal left undecided": "Finalized when the appeal went undecided",
}, s);

const tail = (id: string) => String(id ?? "").split("-").pop()?.replace(/^0+/, "") || "";
export const numberOf = (id: string) => tail(id);
export const typeName = (tid: string) => `Event type ${tail(tid)}`;
export const claimName = (cid: string) => `Claim ${tail(cid)}`;
export const evidenceName = (eid: string) => `Evidence ${tail(eid)}`;
export const determinationName = (did: string) => `Determination ${tail(did)}`;
export const snapshotName = (sid: string) => `Snapshot ${tail(sid)}`;

const CHECKS: Record<string, string> = {
  S1: "Right subject", S2: "Consistent cause", S3: "Documents agree",
};
/** C2 reads "Criterion 2"; the three checks the contract always asks read by name. */
export const requirementName = (id: string) =>
  id.startsWith("C") ? `Criterion ${id.slice(1)}` : CHECKS[id] ?? id;

/** Validators cite items and requirements by id; a page writes them out. Their words are kept. */
export function writeOut(text: string | null | undefined): string {
  const written = prose(text)
    .replace(/ev-0*(\d+)/gi, (_m, d: string) => `evidence ${parseInt(d, 10)}`)
    .replace(/\bC(\d{1,2})\b/g, (_m, d: string) => `criterion ${d}`)
    .replace(/\bS1\b/g, "the subject check")
    .replace(/\bS2\b/g, "the cause check")
    .replace(/\bS3\b/g, "the documents check");
  return written.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/**
 * Text a party wrote, shown as a quotation. Control characters are dropped
 * and runs of spaces closed up, and nothing else: rewriting a party's words
 * would be editing the record.
 */
export function prose(text: string | null | undefined): string {
  return Array.from(String(text ?? ""), (ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 && ch !== "\n" ? " " : ch;
  }).join("").replace(/[ \t]+/g, " ").trim();
}

/** The contract's own sentence from a refused write, tidied into one sentence, never replaced. */
export function refusal(text: string): string {
  const body = String(text ?? "")
    .replace(/\[EXPECTED\]|\[LLM_ERROR\]/g, "")
    .replace(/^[\s:]+/, "")
    .trim();
  if (!body) return "The contract refused this action.";
  const sentence = body[0]!.toUpperCase() + body.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

const GEN_WEI = 10n ** 18n;

/** GEN with up to four decimals, trailing zeros trimmed: "2 GEN", "0.05 GEN". */
export function gen(wei: string | bigint | number | null | undefined, unit = true): string {
  let v: bigint;
  try {
    v = BigInt(typeof wei === "number" ? Math.trunc(wei) : (wei ?? 0));
  } catch {
    return unit ? "0 GEN" : "0";
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / GEN_WEI;
  const frac = ((v % GEN_WEI) * 10_000n) / GEN_WEI;
  let text = whole.toLocaleString("en-GB");
  if (frac > 0n) text += `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;
  return `${neg ? "-" : ""}${text}${unit ? " GEN" : ""}`;
}

/** Parse a GEN amount a person typed ("2", "0.05") into wei; null if unreadable. */
export function parseGen(text: string): bigint | null {
  const t = String(text ?? "").trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const [whole = "0", frac = ""] = t.split(".");
  if (frac.length > 18) return null;
  try {
    return BigInt(whole) * GEN_WEI + BigInt((frac + "0".repeat(18)).slice(0, 18));
  } catch {
    return null;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                "November", "December"];

/** "28 September 2026, 10:04 UTC", spelled by hand so every browser reads it alike. */
export function when(iso: string | null | undefined): string {
  const ms = Date.parse(String(iso ?? ""));
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** "18 September 2026", for a calendar date. */
export function day(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date ?? ""));
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "in 3 hours", "12 minutes ago": for windows that are running now. */
export function relative(iso: string | null | undefined, now: number): string {
  const ms = Date.parse(String(iso ?? ""));
  if (Number.isNaN(ms) || !now) return "";
  const diff = ms - now;
  const abs = Math.abs(diff);
  const unit = abs >= 86_400_000 ? ["day", 86_400_000] as const
    : abs >= 3_600_000 ? ["hour", 3_600_000] as const : ["minute", 60_000] as const;
  const n = Math.max(1, Math.round(abs / unit[1]));
  const text = `${n} ${unit[0]}${n === 1 ? "" : "s"}`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** "1 hour", "2 days": a window's length in seconds, in words. */
export function span(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const [n, u] = s >= 86_400 && s % 86_400 === 0 ? [s / 86_400, "day"]
    : s >= 3_600 && s % 3_600 === 0 ? [s / 3_600, "hour"] : [Math.round(s / 60), "minute"];
  return `${n} ${u}${n === 1 ? "" : "s"}`;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
