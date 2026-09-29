/**
 * The typed read layer. Every contract view returns canonical JSON; callers
 * get parsed objects, null for absent records, or a ReadError a person can
 * act on.
 *
 * Reads go straight from this browser to Studio Next, budgeted: gen_call
 * allows 30 calls per rolling minute per IP, and the wallet's fee estimates
 * spend from the same bucket. Reads run concurrently up to a rolling budget
 * with headroom left for the wallet, retry transient failures, and cache
 * what cannot change (images, evidence, snapshots, type versions) for good.
 */
import { createClient } from "genlayer-js";

import { isTransient, STUDIO_NEXT } from "./chain";
import { CONTRACT_ADDRESS, CONTRACT_CONFIGURED } from "./config";
import { sha256Hex } from "./hash";
import type {
  Claim, Config, Credit, Determination, EventsPage, EventType, Evidence, Receipt, Snapshot, Stats, TypeVersion,
} from "./types";

type ReadClient = {
  readContract(args: { address: `0x${string}`; functionName: string; args: unknown[] }): Promise<unknown>;
};

export class ReadError extends Error {
  readonly transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.name = "ReadError";
    this.transient = transient;
  }
}

let client: ReadClient | null = null;
function readClient(): ReadClient {
  if (!CONTRACT_CONFIGURED) {
    throw new ReadError("No deployment is configured for this build.", false);
  }
  // No account: reads are unsigned. Requiring a wallet to look at a public
  // record would be a fake gate.
  client ??= createClient({ chain: STUDIO_NEXT }) as unknown as ReadClient;
  return client;
}

/* ── budget: at most READ_BUDGET call starts in any rolling minute ── */

export const READ_WINDOW_MS = 60_000;
export const READ_BUDGET = 22;
const MIN_GAP_MS = 120;

/**
 * When may the next call start, given the (ascending) start times already
 * planned? Pure, so the budget is testable to the millisecond. Mutates
 * `starts`: drops starts that left the window, appends the planned one.
 */
export function planStart(starts: number[], now: number): number {
  while (starts.length && (starts[0] ?? 0) <= now - READ_WINDOW_MS) starts.shift();
  let at = Math.max(now, (starts[starts.length - 1] ?? -Infinity) + MIN_GAP_MS);
  if (starts.length >= READ_BUDGET) {
    at = Math.max(at, (starts[starts.length - READ_BUDGET] ?? 0) + READ_WINDOW_MS);
  }
  starts.push(at);
  return at;
}

// The bucket is per IP, so the starts that actually happened are shared by
// every tab and survive reloads. Plans this document has not begun yet stay
// in memory: a page someone left must not keep holding budget.
const STARTS_KEY = "occurra.read-starts";
let memoryStarts: number[] = [];
const pending: number[] = [];

function recordedStarts(): number[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STARTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number") : memoryStarts;
  } catch {
    return memoryStarts;
  }
}

function recordStart(at: number): void {
  const keep = (x: number) => x > at - READ_WINDOW_MS;
  memoryStarts = [...memoryStarts.filter(keep), at];
  try {
    const next = [...recordedStarts().filter(keep), at].sort((a, b) => a - b);
    window.localStorage.setItem(STARTS_KEY, JSON.stringify(next));
  } catch {
    /* memory only */
  }
}

/*
 * Studio Next counts every caller behind one IP address together, so another
 * tab, another app or another person on the same network spends the same 30
 * calls a minute. When the network answers "rate limited", every read in
 * every tab of this app waits out a short cooldown instead of adding to it.
 */
const COOLDOWN_KEY = "occurra.read-cooldown";
export const COOLDOWN_MS = 20_000;
let memoryCooldown = 0;

function cooldownUntil(): number {
  try {
    return Math.max(memoryCooldown, Number(window.localStorage.getItem(COOLDOWN_KEY) ?? 0) || 0);
  } catch {
    return memoryCooldown;
  }
}

function coolDown(): void {
  memoryCooldown = Date.now() + COOLDOWN_MS;
  try {
    window.localStorage.setItem(COOLDOWN_KEY, String(memoryCooldown));
  } catch {
    /* memory only */
  }
}

function paced<T>(work: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const plan = [...new Set([...recordedStarts(), ...memoryStarts, ...pending])].sort((a, b) => a - b);
  const at = Math.max(planStart(plan, now), cooldownUntil());
  pending.push(at);
  const begin = () => {
    pending.splice(pending.indexOf(at), 1);
    recordStart(Date.now());
    return work();
  };
  const wait = at - now;
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)).then(begin) : begin();
}

// Studio Next runs gen_calls in a small pool of execution slots shared by
// every visitor; one page never holds more than half of them.
export const MAX_IN_FLIGHT = 4;
let inFlight = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((r) => waiting.push(r));
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    waiting.shift()?.();
  }
}

const isRateLimited = (e: unknown) => /rate limit|429|-32029/i.test(String((e as Error)?.message ?? e));

/**
 * The contract's own sentence from a refused read. genlayer-js surfaces
 * gen_call refusals as a generic viem error; the contract's text rides
 * base64-encoded (one tag byte first) at `cause.data.receipt.result`.
 */
export function contractRefusal(e: unknown): string | null {
  let x: unknown = e;
  for (let depth = 0; x && depth < 8; depth++) {
    const node = x as { data?: { receipt?: { result?: unknown } }; message?: unknown; cause?: unknown };
    const b64 = node.data?.receipt?.result;
    if (typeof b64 === "string") {
      try {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        let start = 0;
        while (start < decoded.length && decoded.charCodeAt(start) < 0x20) start++;
        const text = decoded.slice(start).trim();
        if (text) return text;
      } catch {
        /* not base64: keep walking */
      }
    }
    if (typeof node.message === "string" && node.message.includes("[EXPECTED]")) return node.message;
    x = node.cause;
  }
  return null;
}

async function call(functionName: string, args: unknown[], tries = 3): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await withSlot(() => paced(() =>
        readClient().readContract({ address: CONTRACT_ADDRESS, functionName, args }),
      ));
    } catch (e) {
      lastErr = e;
      const refusal = contractRefusal(e);
      if (refusal) {
        throw new ReadError(refusal.split("[EXPECTED]").pop()?.trim() || refusal, false);
      }
      if (isRateLimited(e)) coolDown();
      if (!isTransient(e) || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, (isRateLimited(e) ? 5_000 : 2_500) * (i + 1)));
    }
  }
  throw new ReadError(
    isTransient(lastErr)
      ? "Studio Next is not answering right now; it usually recovers in a moment."
      : "The chain could not answer this read. Reload in a moment; if it persists, the record may not exist.",
    isTransient(lastErr),
  );
}

async function view<T>(functionName: string, args: unknown[]): Promise<T> {
  return JSON.parse(String(await call(functionName, args))) as T;
}

/* ── caches ── */

const TTL = 20_000;
const STASH = `occurra.${CONTRACT_ADDRESS}.`;
const memo = new Map<string, { at: number; value: unknown; forever?: boolean }>();

function cached<T>(key: string): T | undefined {
  const hit = memo.get(key);
  if (hit && (hit.forever || Date.now() - hit.at < TTL)) return hit.value as T;
  try {
    const raw = window.sessionStorage.getItem(STASH + key);
    if (raw) {
      const { at, value, forever } = JSON.parse(raw) as { at: number; value: T; forever?: boolean };
      if (forever || Date.now() - at < TTL) {
        memo.set(key, { at, value, forever });
        return value;
      }
    }
  } catch {
    /* no session storage: memory only */
  }
  return undefined;
}

function remember<T>(key: string, value: T, forever = false): T {
  const at = Date.now();
  memo.set(key, { at, value, forever });
  try {
    window.sessionStorage.setItem(STASH + key, JSON.stringify({ at, value, forever }));
  } catch {
    /* memory only */
  }
  return value;
}

/** Forget every changeable read after a write; immutable records stay. */
export function invalidateReads(): void {
  for (const [k, v] of memo) if (!v.forever) memo.delete(k);
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const k = window.sessionStorage.key(i);
      if (!k?.startsWith(STASH)) continue;
      const raw = window.sessionStorage.getItem(k);
      if (raw && !(JSON.parse(raw) as { forever?: boolean }).forever) window.sessionStorage.removeItem(k);
    }
  } catch {
    /* memory only */
  }
}

const sameRecord = new Map<string, Promise<unknown>>();

/** One request per record at a time: parts of a page asking for the same record share it. */
function shared<T>(key: string, work: () => Promise<T>): Promise<T> {
  const running = sameRecord.get(key) as Promise<T> | undefined;
  if (running) return running;
  const flight = work().finally(() => sameRecord.delete(key));
  sameRecord.set(key, flight);
  return flight;
}

async function cachedView<T>(key: string, fn: string, args: unknown[], fresh: boolean): Promise<T> {
  if (!fresh) {
    const hit = cached<T>(key);
    if (hit !== undefined) return hit;
  }
  return shared(key, async () => remember(key, await view<T>(fn, args)));
}

async function forever<T>(key: string, fn: string, args: unknown[]): Promise<T | null> {
  const hit = cached<T>(key);
  if (hit !== undefined) return hit;
  const v = await orNull(view<T>(fn, args));
  return v === null ? null : remember(key, v, true);
}

/** The contract refuses a missing record with "no <thing> <id>". */
const MISSING = /^no (event type|event type version|claim|evidence|determination|snapshot) /i;

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ReadError && !e.transient && MISSING.test(e.message)) return null;
    throw e;
  }
}

/* ── typed getters ── */

let configFlight: Promise<Config> | null = null;

export async function getConfig(): Promise<Config> {
  const hit = cached<Config>("config");
  if (hit) return hit;
  configFlight ??= view<Config>("get_config", [])
    .then((c) => remember("config", c, true))
    .finally(() => { configFlight = null; });
  return configFlight;
}

export const getStats = (fresh = false) => cachedView<Stats>("stats", "get_stats", [], fresh);

export const listEventTypes = (skip = 0, limit = 30, fresh = false) =>
  cachedView<{ total: number; event_types: EventType[] }>(`types.${skip}.${limit}`, "list_event_types", [skip, limit], fresh);

export const typesOf = (addr: string, skip = 0, limit = 30, fresh = false) =>
  cachedView<{ total: number; event_types: EventType[] }>(`typesof.${addr}.${skip}.${limit}`, "types_of", [addr, skip, limit], fresh);

export const getEventType = (tid: string, fresh = false) =>
  orNull(cachedView<EventType>(`type.${tid}`, "get_event_type", [tid], fresh));

/** A version never changes once published: read once, keep. */
export const getTypeVersion = (tid: string, version: number) =>
  forever<TypeVersion>(`version.${tid}.${version}`, "get_type_version", [tid, version]);

export const listClaims = (tid: string, skip = 0, limit = 30, fresh = false) =>
  cachedView<{ total: number; claims: Claim[] }>(`claims.${tid}.${skip}.${limit}`, "list_claims", [tid, skip, limit], fresh);

export const listAllClaims = (skip = 0, limit = 30, fresh = false) =>
  cachedView<{ total: number; claims: Claim[] }>(`allclaims.${skip}.${limit}`, "list_all_claims", [skip, limit], fresh);

export const claimsOf = (addr: string, skip = 0, limit = 30, fresh = false) =>
  cachedView<{ total: number; claims: Claim[] }>(`claimsof.${addr}.${skip}.${limit}`, "claims_of", [addr, skip, limit], fresh);

export const getClaim = (cid: string, fresh = false) =>
  orNull(cachedView<Claim>(`claim.${cid}`, "get_claim", [cid], fresh));

/** A determination changes only in its lifecycle; it is re-read, never assumed. */
export const getDetermination = (did: string, fresh = false) =>
  orNull(cachedView<Determination>(`determination.${did}`, "get_determination", [did], fresh));

export const getReceipt = (cid: string, fresh = false) =>
  orNull(cachedView<Receipt>(`receipt.${cid}`, "get_receipt", [cid], fresh));

export const getSnapshot = (sid: string) => forever<Snapshot>(`snapshot.${sid}`, "get_snapshot", [sid]);

export const getEvidence = (eid: string) => forever<Evidence>(`evidence.${eid}`, "get_evidence", [eid]);

export const getEvents = (tid: string, skip = 0, limit = 30, fresh = false) =>
  cachedView<EventsPage>(`events.${tid}.${skip}.${limit}`, "get_events", [tid, skip, limit], fresh);

export const getCredit = (addr: string, fresh = true) => cachedView<Credit>(`credit.${addr}`, "get_credit", [addr], fresh);

/** A document's body, as it was filed. Never changes: read once, keep. */
export async function getEvidenceText(eid: string): Promise<string | null> {
  const key = `text.${eid}`;
  const hit = cached<string>(key);
  if (hit !== undefined) return hit;
  try {
    return remember(key, String(await call("get_evidence_text", [eid])), true);
  } catch (e) {
    if (e instanceof ReadError && !e.transient) return null;
    throw e;
  }
}

/* ── images: fetched once per browser, checked against the recorded digest ── */

/** genlayer-js hands calldata bytes back as a 0x hex string. */
export function bytesFrom(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (typeof raw === "string" && raw.startsWith("0x")) {
    const hex = raw.slice(2);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  throw new ReadError("The chain returned an image in a form this app does not read.", false);
}

export interface StoredImage {
  bytes: Uint8Array;
  /** sha256 of the bytes the chain returned, computed in this browser. */
  digest: string;
}

const images = new Map<string, Promise<StoredImage>>();

export function getImage(eid: string): Promise<StoredImage> {
  let flight = images.get(eid);
  if (!flight) {
    flight = call("get_evidence_image", [eid]).then(async (raw) => {
      const bytes = bytesFrom(raw);
      return { bytes, digest: await sha256Hex(bytes) };
    });
    flight.catch(() => images.delete(eid));
    images.set(eid, flight);
  }
  return flight;
}
