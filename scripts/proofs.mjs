/**
 * Live proofs on an Occurra deployment. Every claim here is an assertion; if
 * the contract or the panel behaves otherwise, the run stops and says which.
 * Resumable: each step is kept by name with its transaction hash in
 * .data/proofs-<address>.json, and a rerun skips what already landed.
 *
 *   node --experimental-strip-types scripts/proofs.mjs 0x…
 *
 * The story, on two event types (escape of water to a home; collision damage
 * to a car) and six public photographs (fixtures/ATTRIBUTION.md):
 *   the enforced half refused in code, no validator asked;
 *   an escape of water established on a photograph of the stained ceiling, the
 *     leaking trap and a plumber's estimate, then settled to the claimant;
 *   the same photographs beside a report that contradicts them, not established;
 *   a car claim filed with a photograph of a different car, the subject check fails;
 *   a collision claim filed with a burnt-out wreck, the cause check fails;
 *   a collision claim undetermined on a side view, appealed with the rear view.
 * At every step the app's own rules (web/lib/acts.ts) are run against chain
 * state and must offer exactly what the contract accepts.
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, rpc, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node --experimental-strip-types scripts/proofs.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/proofs-${ADDRESS}.json`, import.meta.url));
const IMG = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}.jpg`, import.meta.url))));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {} };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });
const { claimActs, typeActs, preflightGap } = await import("../web/lib/acts.ts");

function assert(cond, message) {
  if (!cond) {
    say(`ASSERTION FAILED: ${message}`);
    process.exit(2);
  }
}

function jsonFrom(text) {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
}

async function read(fn, args) {
  for (let i = 0; i < 6; i++) {
    try {
      return await reader.readContract({ address: ADDRESS, functionName: fn, args });
    } catch (e) {
      if (i === 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}
const readJson = async (fn, args) => JSON.parse(await read(fn, args));
const credit = async (role) => BigInt((await readJson("get_credit", [KEYS[role].addr])).owed);
const balance = async (role) => BigInt((await rpc("eth_getBalance", [KEYS[role].addr, "latest"])).result ?? "0x0");

const ROUNDS = new Set(["request_assessment", "readjudicate"]);
const ROUND_ATTEMPTS = 4;

/**
 * One signed write, remembered by name so a rerun skips what already landed.
 * The hash is saved the moment it is sent. A round that reaches no majority
 * recorded nothing, so it is asked again, and each such attempt is kept in
 * run.no_consensus so the log reports every round that failed.
 */
async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier (${run.steps[name].hash})`);
    return run.steps[name];
  }
  run.pending ??= {};
  const attempts = ROUNDS.has(fn) ? ROUND_ATTEMPTS : 1;
  let hash, t, secs;
  for (let ask = 1; ; ask++) {
    hash = run.pending[name];
    if (hash) {
      say(`${name}: waiting again on ${hash}, sent earlier`);
    } else {
      for (let attempt = 0; ; attempt++) {
        try {
          const client = clientFor(role);
          const fees = transfer
            ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
            : await plainFees(client);
          hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value, fees });
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          say(`${name}: send failed (${String(e.message).slice(0, 80)}), retrying`);
          await sleep(8000 * (attempt + 1));
        }
      }
      run.pending[name] = hash;
      save();
      say(`${name}: ${role} ${fn} ${hash}`);
    }
    const t0 = Date.now();
    try {
      t = await waitFinal(hash, { label: name, tries: ROUNDS.has(fn) ? 450 : 150 });
      secs = Math.round((Date.now() - t0) / 1000);
    } catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      t = null;
    }
    const agreed = t && (t.result_name === "MAJORITY_AGREE" || t.result_name === "AGREE");
    if (t && (agreed || !ROUNDS.has(fn))) break;
    delete run.pending[name];
    (run.no_consensus ??= []).push({ name, hash, result: t?.result_name ?? "UNDETERMINED", at: new Date().toISOString() });
    save();
    if (ask >= attempts) throw new Error(`${name}: no majority after ${attempts} askings`);
    say(`${name}: no majority, so nothing was recorded; asking again (${ask + 1} of ${attempts})`);
    await sleep(15000);
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s`);
  if (refused) {
    assert(!ok, `${name} should have been refused`);
    assert(text.includes(refused), `${name} refusal should say "${refused}", said "${text.slice(0, 200)}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
  const rec = { name, role, fn, hash, secs, ok, result: t.result_name, text: text.slice(0, 600),
                explorer: `${EXPLORER}/tx/${hash}`, rotations: t.consensus_history?.consensus_results?.length ?? null };
  run.steps[name] = rec;
  save();
  return rec;
}

async function waitUntil(iso, label) {
  const target = Date.parse(iso) + 5000;
  while (Date.now() < target) {
    say(`waiting for ${label} (${Math.ceil((target - Date.now()) / 1000)} s)`);
    await sleep(Math.min(60000, target - Date.now()));
  }
}

/** Ask for a determination and read it back, with every node's vote kept. */
async function decide(key, fn, cid, role) {
  const rec = await step(key, role, fn, [cid]);
  const d = await readJson("get_determination", [jsonFrom(rec.text).determination_id]);
  if (!run.steps[key].nodes) {
    const { nodes } = await dumpReceipt(rec.hash, ["[ASSESS]", "[DISSENT]"]);
    run.steps[key].nodes = nodes.map((n) => ({ rotation: n.rotation, from: n.from, vote: n.vote, model: n.model,
                                               lines: n.lines.map((l) => l.slice(0, 300)) }));
    save();
  }
  const rs = Object.fromEntries(d.requirements.map((r) => [r.id, r.status]));
  say(`${key}: ${d.determination} ${JSON.stringify(rs)} sufficient=${d.evidence_sufficient} conflicts=${d.conflicts_detected}`);
  (run.determinations ??= {})[key] = { determination_id: d.determination_id, tx: rec.hash, outcome: d.determination,
                                        ratings: rs, conflicts: d.conflicts_detected, sufficient: d.evidence_sufficient };
  save();
  return d;
}

/** The app's own rule for one act, run on chain state; it must match what the chain then does. */
async function offered(label, cid, role, act, expected) {
  if (run.app?.[label]) return;
  const c = await readJson("get_claim", [cid]);
  const v = await readJson("get_type_version", [c.type_id, c.type_version]);
  const d = c.determination_id ? await readJson("get_determination", [c.determination_id]) : null;
  const got = claimActs(c, v, d, KEYS[role].addr, Date.parse(c.now))[act];
  (run.app ??= {})[label] = { role, act, expected, got: got.ok, why: got.why };
  save();
  assert(got.ok === expected, `the app ${expected ? "does not offer" : "offers"} ${act} to ${role} at ${label}: ${got.why}`);
}

async function claimFor(key, role, tid, claim, bond) {
  const rec = await step(`${key}.file`, role, "file_claim", [tid, JSON.stringify(claim)], { value: bond });
  const out = jsonFrom(rec.text);
  assert(out && out.refused === false && out.claim_id, `${key}: the claim was not filed: ${rec.text}`);
  return out.claim_id;
}

async function image(key, role, cid, file, view, description) {
  const meta = JSON.stringify({ view, description, capture_note: "" });
  return jsonFrom((await step(key, role, "submit_image", [cid, meta, IMG(file)])).text)?.evidence_id;
}

async function doc(key, role, cid, doc_type, title, text) {
  return jsonFrom((await step(key, role, "submit_document", [cid, JSON.stringify({ doc_type, title }), text])).text)?.evidence_id;
}

// ── the two event types ─────────────────────────────────────────────────────

const BENEFIT = GEN;
const BOND = GEN / 10n;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const EVENT_DATE = run.event_date ?? (run.event_date = daysAgo(2));
save();

const WATER = JSON.stringify({
  title: "Escape of water from internal plumbing (demonstration)",
  category: "PROPERTY", event_kind: "WATER_DAMAGE",
  definition: "Sudden damage to the insured home caused by water escaping from a fixed internal pipe, fitting, tank "
    + "or appliance, such as a leaking trap or a split fitting.",
  exclusions: "Gradual damp, condensation, and water entering from outside the building.",
  criteria: ["The photographs show fresh water damage to interior surfaces of the home: staining, swelling or standing water.",
             "The photographs show an internal pipe, fitting or appliance leaking, consistent with the damage shown."],
  evidence_requirements: [{ type: "SCENE_PHOTO", min_count: 1 }, { type: "DAMAGE_PHOTO", min_count: 1 }],
  benefit_wei: BENEFIT.toString(), bond_wei: BOND.toString(), filing_window_days: 30, evidence_days: 14,
  appeal_window_seconds: 600, evidence_period_seconds: 600, max_appeals: 1, assessors: [], assessor_required: false,
});

const COLLISION = JSON.stringify({
  title: "Collision damage to a private car (demonstration)",
  category: "VEHICLE", event_kind: "COLLISION_DAMAGE",
  definition: "Fresh damage to the body of the insured car caused by a collision with another vehicle or an object, "
    + "such as a rear-end impact in traffic.",
  exclusions: "Wear, rust and corrosion, fire, and damage from before cover began.",
  criteria: ["A photograph shows the named car with fresh body damage from an impact.",
             "The damage shown is where the declared collision would have caused it."],
  evidence_requirements: [{ type: "SCENE_PHOTO", min_count: 1 }],
  benefit_wei: BENEFIT.toString(), bond_wei: BOND.toString(), filing_window_days: 30, evidence_days: 14,
  appeal_window_seconds: 600, evidence_period_seconds: 600, max_appeals: 1, assessors: [], assessor_required: false,
});

say(`proofs on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "occurra-rules-1", `unexpected ruleset ${cfg.ruleset}`);

const wr = await step("types.water", "SPONSOR", "create_event_type", [WATER], { value: 4n * GEN });
const P = jsonFrom(wr.text)?.type_id;
assert(P && jsonFrom(wr.text).refused === false, `the water type was not written: ${wr.text}`);
const cr = await step("types.collision", "SPONSOR", "create_event_type", [COLLISION], { value: 4n * GEN });
const V = jsonFrom(cr.text)?.type_id;
assert(V && jsonFrom(cr.text).refused === false, `the collision type was not written: ${cr.text}`);

// ── 1. the enforced half: refused in code, no validator asked ───────────────

{
  const before = run.steps["enforced.wrong_bond"] ? null : await credit("CLAIMANT");
  const rec = await step("enforced.wrong_bond", "CLAIMANT", "file_claim", [P, JSON.stringify({
    subject: "Kitchen of 3 Birch Lane", subject_ref: "Policy HOME-0001", event_date: EVENT_DATE,
    declared_cause: "A split fitting", account: "Water on the kitchen floor in the morning." })], { value: BOND / 2n });
  const out = jsonFrom(rec.text);
  assert(out?.refused === true && out.reason.includes("exactly"), `a wrong bond was not refused: ${rec.text}`);
  if (before !== null) assert((await credit("CLAIMANT")) - before === BOND / 2n, "the refused bond was not credited back");
}
{
  const t = await readJson("get_event_type", [P]);
  const v = await readJson("get_type_version", [P, 1]);
  assert(typeActs(t, v, KEYS.SPONSOR.addr).fileClaim.ok === false, "the app offers the sponsor a claim on its own type");
  const rec = await step("enforced.sponsor_claims", "SPONSOR", "file_claim", [P, JSON.stringify({
    subject: "Kitchen of 3 Birch Lane", subject_ref: "Policy HOME-0001", event_date: EVENT_DATE,
    declared_cause: "A split fitting", account: "Water on the kitchen floor in the morning." })], { value: BOND });
  assert(jsonFrom(rec.text)?.refused === true && rec.text.includes("sponsor cannot claim"), `the sponsor's claim was not refused: ${rec.text}`);
}

// ── 2. an escape of water, established and settled ──────────────────────────

const A = await claimFor("water", "CLAIMANT", P, {
  subject: "Ground-floor bathroom of 7 Wren Close", subject_ref: "Policy HOME-4417", location: "7 Wren Close",
  event_date: EVENT_DATE, declared_cause: "The trap under the first-floor bathroom basin leaked through the floor overnight",
  account: "In the morning the ceiling panel of the ground-floor bathroom was stained brown and damp. Upstairs, water "
    + "was dripping from the trap under the basin. I shut off the water and called a plumber.",
}, BOND);
await image("water.scene", "CLAIMANT", A, "ceiling-stain", "SCENE", "The stained ceiling panel in the ground-floor bathroom");
await offered("water.assess_before_detail", A, "CLAIMANT", "assess", false);
{
  const c = await readJson("get_claim", [A]);
  const gap = preflightGap(await readJson("get_type_version", [P, 1]), c.evidence);
  await step("enforced.preflight", "CLAIMANT", "request_assessment", [A], { refused: gap });
}
await image("water.detail", "CLAIMANT", A, "trap-leak", "DAMAGE_DETAIL", "The leaking trap under the first-floor basin");
await doc("water.estimate", "CLAIMANT", A, "REPAIR_ESTIMATE", "Plumber's estimate",
  "Attended 7 Wren Close. The PVC trap under the first-floor bathroom basin was leaking at its slip joint; water had "
  + "run through the floor and stained one ceiling panel in the bathroom below. Replace the trap and the stained "
  + "ceiling panel. Estimate 380 pounds.");
await offered("water.assess_ready", A, "CLAIMANT", "assess", true);
await offered("water.stranger_cannot_assess", A, "STRANGER", "assess", false);
const dA = await decide("water.assess", "request_assessment", A, "CLAIMANT");
assert(dA.determination === "ESTABLISHED", `the escape of water should be established, was ${dA.determination}`);
assert(dA.conflicts_detected === false, "a consistent file raised a conflict (the flag's negative control)");
await offered("water.claimant_cannot_appeal", A, "CLAIMANT", "appeal", false);
await step("enforced.claimant_appeals_own_win", "CLAIMANT", "open_appeal", [A, "I would like a second look."],
           { refused: "only the sponsor appeals an established event" });
await offered("water.not_final_yet", A, "STRANGER", "finalize", false);
await step("enforced.finalize_early", "STRANGER", "finalize", [A], { refused: "appeal window is still open" });

// ── 3. the same photographs beside a report that contradicts them ───────────

const B = await claimFor("contradicted", "CLAIMANT2", P, {
  subject: "Ground-floor bathroom of 12 Larch Road", subject_ref: "Policy HOME-5520", location: "12 Larch Road",
  event_date: EVENT_DATE, declared_cause: "The trap under the first-floor basin leaked through the floor",
  account: "The bathroom ceiling downstairs was stained by water from the basin upstairs, and the trap was dripping.",
}, BOND);
await image("contradicted.scene", "CLAIMANT2", B, "ceiling-stain", "SCENE", "The stained bathroom ceiling");
await image("contradicted.detail", "CLAIMANT2", B, "trap-leak", "DAMAGE_DETAIL", "The leaking trap");
await doc("contradicted.report", "CLAIMANT2", B, "REPAIR_ESTIMATE", "Plumber's visit",
  "Attended 12 Larch Road. No ceiling in the property is stained or damp, and no pipe, trap or fitting is leaking. "
  + "The only damage found is a cracked kitchen floor tile from a dropped pan. No plumbing work is needed.");
const dB = await decide("contradicted.assess", "request_assessment", B, "CLAIMANT2");
assert(dB.determination !== "ESTABLISHED", "a file whose own report contradicts its photographs was established");
assert(dB.conflicts_detected === true || dB.requirements.find((r) => r.id === "S3")?.status === "NOT_SATISFIED",
       "the contradiction was neither flagged nor failed on the documents check");

// ── 4. a different car from the one named ───────────────────────────────────

const C = await claimFor("wrongcar", "CLAIMANT", V, {
  subject: "White Changan Alsvin saloon", subject_ref: "Registration A123BC77", location: "Smolenskaya Square, Moscow",
  event_date: EVENT_DATE, declared_cause: "Rear-ended by a light truck at the traffic lights",
  account: "A light truck ran into the back of my white Changan Alsvin at the lights; the rear bumper and boot are crushed.",
}, BOND);
await image("wrongcar.scene", "CLAIMANT", C, "red-sedan-front", "SCENE", "My white Changan Alsvin after the collision");
const dC = await decide("wrongcar.assess", "request_assessment", C, "CLAIMANT");
assert(dC.determination === "NOT_ESTABLISHED", `a different car should fail the claim, was ${dC.determination}`);
assert(dC.requirements.find((r) => r.id === "S1")?.status === "NOT_SATISFIED", "the subject check did not fail on a different car");

// ── 5. a wreck, not a collision ─────────────────────────────────────────────

const D = await claimFor("wreck", "CLAIMANT2", V, {
  subject: "Silver Vauxhall Corsa hatchback", subject_ref: "Registration YX07KLM", location: "Middleton, Leeds",
  event_date: EVENT_DATE, declared_cause: "Rear-ended by a van in traffic yesterday",
  account: "Yesterday a van hit the back of my Corsa in slow traffic and crumpled the rear of the car.",
}, BOND);
await image("wreck.scene", "CLAIMANT2", D, "burnt-hatchback", "SCENE", "My Corsa the day after the collision");
const dD = await decide("wreck.assess", "request_assessment", D, "CLAIMANT2");
assert(dD.determination === "NOT_ESTABLISHED", `a burnt-out wreck should fail a fresh collision claim, was ${dD.determination}`);
assert(dD.requirements.find((r) => r.id === "S2")?.status === "NOT_SATISFIED", "the cause check did not fail on a burnt-out wreck");

// ── 6. undetermined on a side view, appealed with the rear view ─────────────

const E = await claimFor("appeal", "CLAIMANT", V, {
  subject: "White Changan Alsvin saloon", subject_ref: "Registration A123BC77", location: "Smolenskaya Square, Moscow",
  event_date: EVENT_DATE, declared_cause: "Rear-ended by a light truck at the traffic lights",
  account: "A light truck ran into the back of my car at the lights and crushed the rear bumper and boot lid.",
}, BOND);
await image("appeal.side", "CLAIMANT", E, "sedan-side", "SCENE", "My car after it was hit from behind");
const dE1 = await decide("appeal.assess", "request_assessment", E, "CLAIMANT");
let dE2 = null;
if (dE1.determination === "ESTABLISHED") {
  say("appeal: the side view was enough to establish it on the first asking, so there is nothing to appeal");
  run.appeal_path = "established on the first asking";
} else {
  await offered("appeal.claimant_may_appeal", E, "CLAIMANT", "appeal", true);
  await offered("appeal.sponsor_may_not", E, "SPONSOR", "appeal", false);
  await step("appeal.open", "CLAIMANT", "open_appeal",
             [E, "The first photograph was taken from the side. The rear photograph shows the crushed bumper."]);
  await offered("appeal.sponsor_cannot_file", E, "SPONSOR", "fileImage", false);
  await image("appeal.rear", "CLAIMANT", E, "sedan-rear", "SCENE", "The rear of my car, crushed by the truck");
  await offered("appeal.too_early_to_rejudge", E, "STRANGER", "readjudicate", false);
  await step("enforced.readjudicate_early", "CLAIMANT", "readjudicate", [E], { refused: "both sides can still file" });
  run.appeal_path = "appealed";
}
save();

// ── 7. finality, settlement and every bond where it belongs ─────────────────

await waitUntil(dA.appeal_window_ends, "the established claim's appeal window");
await offered("water.final_now", A, "STRANGER", "finalize", true);
const owedBefore = run.steps["water.finalize"] ? null : await credit("CLAIMANT");
await step("water.finalize", "STRANGER", "finalize", [A]);
if (owedBefore !== null) {
  assert((await credit("CLAIMANT")) - owedBefore === BENEFIT + BOND, "the claimant was not credited exactly the benefit and the bond");
}
const tP = await readJson("get_event_type", [P]);
assert(BigInt(tP.paid_wei) === BENEFIT, "the reserve did not pay exactly one benefit");

for (const [key, cid] of [["contradicted", B], ["wrongcar", C], ["wreck", D]]) {
  const c = await readJson("get_claim", [cid]);
  const d = await readJson("get_determination", [c.determination_id]);
  await waitUntil(d.appeal_window_ends, `${key}'s appeal window`);
  await step(`${key}.finalize`, "STRANGER", "finalize", [cid]);
  const after = await readJson("get_claim", [cid]);
  const expected = d.determination === "NOT_ESTABLISHED" ? "SPONSOR_RESERVE" : "CLAIMANT";
  assert(after.state === "FINAL" && after.bond_to === expected, `${key}: the bond went to ${after.bond_to}, not ${expected}`);
}

if (run.appeal_path === "appealed") {
  const c = await readJson("get_claim", [E]);
  await waitUntil(c.appeal.evidence_ends, "the appeal's evidence period");
  await offered("appeal.rejudge_now", E, "STRANGER", "readjudicate", true);
  dE2 = await decide("appeal.readjudicate", "readjudicate", E, "STRANGER");
  assert(dE2.appeal_of === dE1.determination_id, "the readjudication is not linked to the determination it reviews");
  const prior = await readJson("get_determination", [dE1.determination_id]);
  assert(prior.lifecycle === "SUPERSEDED" && prior.superseded_by === dE2.determination_id, "the appealed determination was not kept as superseded");
  const snap = await readJson("get_snapshot", [dE2.snapshot_id]);
  assert(snap.evidence.some((e) => e.new_on_appeal), "the snapshot does not name the evidence new on appeal");
  say(`appeal: ${dE1.determination} -> ${dE2.determination}`);
  await offered("appeal.final_at_once", E, "STRANGER", "finalize", true);
  await step("appeal.finalize", "STRANGER", "finalize", [E]);
}

// The claimant draws what the ledger owes it, in its own transaction.
{
  const owed = await credit("CLAIMANT");
  if (!run.steps["claimant.withdraw"]) assert(owed >= BENEFIT + BOND, "the claimant is owed less than its benefit and bond");
  const before = run.steps["claimant.withdraw"] ? null : await balance("CLAIMANT");
  await step("claimant.withdraw", "CLAIMANT", "withdraw", [], { transfer: true });
  if (before !== null) assert((await balance("CLAIMANT")) > before, "the withdrawal did not reach the claimant's wallet");
  assert((await credit("CLAIMANT")) === 0n, "credit remains after the withdrawal");
}

say(`stats ${JSON.stringify(await readJson("get_stats", []))}`);
const missed = run.no_consensus ?? [];
say(missed.length ? `${missed.length} round(s) reached no majority and were asked again` : "no round had to be asked again");
say(`the app's own rules agreed with the chain at ${Object.keys(run.app ?? {}).length} checks`);
mkdirSync(fileURLToPath(new URL("../docs/proofs/", import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL("../docs/proofs/proofs.json", import.meta.url)), JSON.stringify(run, null, 2));
say("every proof passed");
