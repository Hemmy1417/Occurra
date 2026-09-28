/**
 * Live paths on a second Occurra deployment: the appeals from each side, the
 * independent assessor, and the sponsor's controls and the exits. A second
 * deployment of the same bytes, so a stall in this long run can never block
 * the deployment of record. Every claim here is an assertion; resumable like
 * the proofs (.data/paths-<address>.json).
 *
 *   node --experimental-strip-types scripts/paths.mjs 0x…
 *
 * The lapse of an unassessed claim and the close of an appeal left undecided
 * take days of real windows (the shortest evidence period an event type can
 * set is one day), so they are proved in the direct suite, not here.
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, rpc, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node --experimental-strip-types scripts/paths.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/paths-${ADDRESS}.json`, import.meta.url));
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


// ── the event types on this deployment ──────────────────────────────────────

const BENEFIT = GEN;
const BOND = GEN / 10n;
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const EVENT_DATE = run.event_date ?? (run.event_date = daysAgo(2));
save();

const waterType = (over = {}) => JSON.stringify({
  title: "Escape of water from internal plumbing (demonstration)",
  category: "PROPERTY", event_kind: "WATER_DAMAGE",
  definition: "Sudden damage to the insured home caused by water escaping from a fixed internal pipe, fitting, tank "
    + "or appliance, such as a leaking trap or a split fitting.",
  exclusions: "Gradual damp, condensation, and water entering from outside the building.",
  criteria: ["The photographs show fresh water damage to interior surfaces of the home: staining, swelling or standing water.",
             "The photographs show an internal pipe, fitting or appliance leaking, consistent with the damage shown."],
  evidence_requirements: [{ type: "DAMAGE_PHOTO", min_count: 1 }],
  benefit_wei: BENEFIT.toString(), bond_wei: BOND.toString(), filing_window_days: 30, evidence_days: 14,
  appeal_window_seconds: 600, evidence_period_seconds: 600, max_appeals: 1, assessors: [], assessor_required: false,
  ...over,
});

say(`paths on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "occurra-rules-1", `unexpected ruleset ${cfg.ruleset}`);

const wr = await step("types.water", "SPONSOR", "create_event_type", [waterType()], { value: 5n * GEN });
const P = jsonFrom(wr.text)?.type_id;
assert(P && jsonFrom(wr.text).refused === false, `the water type was not written: ${wr.text}`);

// ── 1. a claimant's appeal: undetermined on the leak alone, then the damage ─

const U = await claimFor("undetermined", "CLAIMANT", P, {
  subject: "Ground-floor bathroom of 7 Wren Close", subject_ref: "Policy HOME-4417", location: "7 Wren Close",
  event_date: EVENT_DATE, declared_cause: "The trap under the first-floor bathroom basin leaked through the floor overnight",
  account: "Water from the leaking trap under the first-floor basin came through the floor and stained the ceiling of "
    + "the ground-floor bathroom below.",
}, BOND);
await image("undetermined.leak", "CLAIMANT", U, "trap-leak", "DAMAGE_DETAIL", "The leaking trap under the first-floor basin");
const u1 = await decide("undetermined.assess", "request_assessment", U, "CLAIMANT");
if (u1.determination === "ESTABLISHED") {
  say("undetermined: the leak alone was enough to establish it, so the claimant has nothing to appeal");
  run.claimant_appeal = "established on the first asking";
} else {
  await offered("undetermined.claimant_may_appeal", U, "CLAIMANT", "appeal", true);
  await offered("undetermined.sponsor_may_not", U, "SPONSOR", "appeal", false);
  await step("undetermined.appeal", "CLAIMANT", "open_appeal",
             [U, "The first photograph shows the leak; the stained ceiling below it is the damage, now filed."]);
  await offered("undetermined.sponsor_cannot_file", U, "SPONSOR", "fileImage", false);
  await image("undetermined.ceiling", "CLAIMANT", U, "ceiling-stain", "SCENE", "The stained ceiling panel below the basin");
  await offered("undetermined.too_early", U, "STRANGER", "readjudicate", false);
  await step("enforced.readjudicate_early", "CLAIMANT", "readjudicate", [U], { refused: "both sides can still file" });
  const c = await readJson("get_claim", [U]);
  await waitUntil(c.appeal.evidence_ends, "the appeal's evidence period");
  await offered("undetermined.rejudge_now", U, "STRANGER", "readjudicate", true);
  const u2 = await decide("undetermined.readjudicate", "readjudicate", U, "STRANGER");
  assert(u2.appeal_of === u1.determination_id, "the readjudication is not linked to the determination it reviews");
  const prior = await readJson("get_determination", [u1.determination_id]);
  assert(prior.lifecycle === "SUPERSEDED" && prior.superseded_by === u2.determination_id,
         "the appealed determination was not kept as superseded");
  const snap = await readJson("get_snapshot", [u2.snapshot_id]);
  assert(snap.evidence.some((e) => e.new_on_appeal), "the snapshot does not name the evidence new on appeal");
  say(`undetermined: ${u1.determination} -> ${u2.determination} on the claimant's appeal`);
  run.claimant_appeal = `${u1.determination} -> ${u2.determination}`;
  await offered("undetermined.final_at_once", U, "STRANGER", "finalize", true);
  await step("undetermined.finalize", "STRANGER", "finalize", [U]);
}
save();

// ── 2. a sponsor's appeal of an established event ───────────────────────────

const E = await claimFor("contested", "CLAIMANT2", P, {
  subject: "Ground-floor bathroom of 12 Larch Road", subject_ref: "Policy HOME-5520", location: "12 Larch Road",
  event_date: EVENT_DATE, declared_cause: "The trap under the first-floor basin leaked through the floor",
  account: "The bathroom ceiling downstairs was stained by water from the basin upstairs, where the trap was dripping.",
}, BOND);
await image("contested.ceiling", "CLAIMANT2", E, "ceiling-stain", "SCENE", "The stained bathroom ceiling");
await image("contested.leak", "CLAIMANT2", E, "trap-leak", "DAMAGE_DETAIL", "The leaking trap");
const e1 = await decide("contested.assess", "request_assessment", E, "CLAIMANT2");
if (e1.determination !== "ESTABLISHED") {
  say(`contested: ${e1.determination} on the first asking, so the sponsor has nothing to appeal`);
  run.sponsor_appeal = `first asking ${e1.determination}`;
} else {
  await offered("contested.sponsor_may_appeal", E, "SPONSOR", "appeal", true);
  await offered("contested.claimant_may_not", E, "CLAIMANT2", "appeal", false);
  await step("contested.appeal", "SPONSOR", "open_appeal",
             [E, "A slow leak over months, not a sudden escape of water, stained this ceiling."]);
  await offered("contested.sponsor_files", E, "SPONSOR", "fileImage", true);
  await offered("contested.claimant_answers", E, "CLAIMANT2", "fileImage", true);
  const c = await readJson("get_claim", [E]);
  await waitUntil(c.appeal.evidence_ends, "the sponsor's appeal evidence period");
  const e2 = await decide("contested.readjudicate", "readjudicate", E, "STRANGER");
  // The sponsor filed nothing of its own, so nothing can have failed on its photographs.
  const roles = Object.fromEntries((await readJson("get_snapshot", [e2.snapshot_id])).evidence.map((x) => [x.evidence_id, x.role]));
  for (const id of e2.failed) {
    const cited = e2.notes.basis[id] ?? [];
    assert(cited.some((x) => roles[x] && roles[x] !== "SPONSOR"), `${id} failed on the sponsor's photographs alone`);
  }
  say(`contested: ${e1.determination} -> ${e2.determination} on the sponsor's appeal`);
  run.sponsor_appeal = `${e1.determination} -> ${e2.determination}`;
  await step("contested.finalize", "STRANGER", "finalize", [E]);
}
save();

// ── 3. an assessor the sponsor names, who accepts, and whose report counts ──

const ar = await step("types.assessed", "SPONSOR", "create_event_type", [waterType({
  title: "Escape of water, assessor required (demonstration)",
  evidence_requirements: [{ type: "SCENE_PHOTO", min_count: 1 }],
  assessors: [KEYS.ASSESSOR.addr], assessor_required: true,
})], { value: 3n * GEN });
const A = jsonFrom(ar.text)?.type_id;
assert(A && jsonFrom(ar.text).refused === false, `the assessed type was not written: ${ar.text}`);
{
  const t = await readJson("get_event_type", [A]);
  const v = await readJson("get_type_version", [A, 1]);
  assert(typeActs(t, v, KEYS.STRANGER.addr).fileClaim.ok === false, "the app offers a claim before any assessor accepted");
  await step("enforced.no_assessor_yet", "CLAIMANT", "file_claim", [A, JSON.stringify({
    subject: "Kitchen of 3 Birch Lane", subject_ref: "Policy HOME-0001", event_date: EVENT_DATE,
    declared_cause: "A split fitting", account: "Water on the kitchen floor in the morning." })], { value: BOND });
  assert(jsonFrom(run.steps["enforced.no_assessor_yet"].text)?.refused === true, "a claim without an accepted assessor was taken");
  assert(typeActs(t, v, KEYS.ASSESSOR.addr).acceptAssessor.ok === true, "the app does not offer the named assessor the role");
  assert(typeActs(t, v, KEYS.STRANGER.addr).acceptAssessor.ok === false, "the app offers a stranger the assessor role");
}
await step("enforced.stranger_assessor", "STRANGER", "accept_assessor_role", [A], { refused: "names as an assessor" });
await step("assessor.accept", "ASSESSOR", "accept_assessor_role", [A]);
const S = await claimFor("assessed", "CLAIMANT", A, {
  subject: "Ground-floor bathroom of 7 Wren Close", subject_ref: "Policy HOME-4417", location: "7 Wren Close",
  event_date: EVENT_DATE, declared_cause: "The trap under the first-floor bathroom basin leaked through the floor overnight",
  account: "The ceiling panel of the ground-floor bathroom was stained by water from the trap under the basin upstairs.",
  assessor: KEYS.ASSESSOR.addr,
}, BOND);
await image("assessed.ceiling", "CLAIMANT", S, "ceiling-stain", "SCENE", "The stained ceiling panel");
await image("assessed.leak", "CLAIMANT", S, "trap-leak", "DAMAGE_DETAIL", "The leaking trap upstairs");
await offered("assessed.gap_without_report", S, "CLAIMANT", "assess", false);
await step("enforced.claimant_files_assessor_report", "CLAIMANT", "submit_document",
           [S, JSON.stringify({ doc_type: "ASSESSOR_REPORT", title: "My own report" }), "All in order."],
           { refused: "only the claim's accepted assessor files an assessor report" });
const report = await doc("assessed.report", "ASSESSOR", S, "ASSESSOR_REPORT", "Assessor's site visit",
  "Attended 7 Wren Close. The PVC trap under the first-floor bathroom basin was leaking at its slip joint. Directly "
  + "below, one ceiling panel in the ground-floor bathroom is stained brown and damp. The damage is recent and "
  + "consistent with water escaping from the trap.");
await offered("assessed.ready", S, "CLAIMANT", "assess", true);
const s1 = await decide("assessed.assess", "request_assessment", S, "CLAIMANT");
{
  const roles = Object.fromEntries((await readJson("get_snapshot", [s1.snapshot_id])).evidence.map((x) => [x.evidence_id, x.role]));
  for (const r of s1.requirements.filter((x) => x.id.startsWith("C") && x.status === "SATISFIED")) {
    const cited = s1.notes.basis[r.id] ?? [];
    assert(cited.some((x) => roles[x] === "ASSESSOR"), `${r.id} was satisfied without the assessor's observation`);
  }
  say(`assessed: ${s1.determination}; every satisfied criterion cites the assessor's report (${report})`);
  run.assessor_floor = { determination: s1.determination, report };
}

// ── 4. the sponsor's own controls, and the exits ────────────────────────────

const W = await claimFor("withdrawn", "CLAIMANT2", P, {
  subject: "Kitchen of 3 Birch Lane", subject_ref: "Policy HOME-0001", location: "3 Birch Lane",
  event_date: EVENT_DATE, declared_cause: "A split fitting under the sink",
  account: "Water on the kitchen floor in the morning, from the fitting under the sink.",
}, BOND);
{
  const before = run.steps["withdrawn.withdraw"] ? null : await credit("CLAIMANT2");
  await offered("withdrawn.offered", W, "CLAIMANT2", "withdraw", true);
  await offered("withdrawn.stranger_not", W, "STRANGER", "withdraw", false);
  await step("withdrawn.withdraw", "CLAIMANT2", "withdraw_claim", [W]);
  if (before !== null) assert((await credit("CLAIMANT2")) - before === BOND, "withdrawal did not return exactly the bond");
  const c = await readJson("get_claim", [W]);
  assert(c.state === "WITHDRAWN" && c.bond_to === "CLAIMANT", "the claim was not withdrawn with its bond returned");
}

// A new version binds new claims only; an open claim keeps the one it was filed under.
const open = await claimFor("versioned", "CLAIMANT2", P, {
  subject: "Utility room of 9 Elm Court", subject_ref: "Policy HOME-7710", location: "9 Elm Court",
  event_date: EVENT_DATE, declared_cause: "A leaking washing machine hose",
  account: "The washing machine hose split and water spread across the utility room floor.",
}, BOND);
await step("versions.publish", "SPONSOR", "publish_version", [P, waterType({ benefit_wei: (2n * GEN).toString() })]);
{
  const c = await readJson("get_claim", [open]);
  const t = await readJson("get_event_type", [P]);
  assert(t.version === 2 && c.type_version === 1 && c.benefit_wei === BENEFIT.toString(),
         "the open claim did not keep the version it was filed under");
}
await step("versioned.withdraw", "CLAIMANT2", "withdraw_claim", [open]);

await step("type.pause", "SPONSOR", "set_type_state", [P, "PAUSED"]);
{
  const rec = await step("enforced.paused", "CLAIMANT2", "file_claim", [P, JSON.stringify({
    subject: "Kitchen of 3 Birch Lane", subject_ref: "Policy HOME-0001", event_date: EVENT_DATE,
    declared_cause: "A split fitting", account: "Water on the kitchen floor in the morning." })], { value: BOND });
  assert(jsonFrom(rec.text)?.refused === true && rec.text.includes("paused"), "a paused type took a claim");
}
await step("type.resume", "SPONSOR", "set_type_state", [P, "ACTIVE"]);

{
  const t = await readJson("get_event_type", [P]);
  const free = BigInt(t.reserve_wei) - BigInt(t.committed_wei);
  await step("enforced.withdraw_committed", "SPONSOR", "withdraw_reserve", [P, (free + 1n).toString()],
             { refused: "only uncommitted reserve can be withdrawn" });
  const before = run.steps["reserve.withdraw"] ? null : await credit("SPONSOR");
  await step("reserve.withdraw", "SPONSOR", "withdraw_reserve", [P, GEN.toString()]);
  if (before !== null) assert((await credit("SPONSOR")) - before === GEN, "the sponsor was not credited exactly what it withdrew");
  await step("sponsor.withdraw", "SPONSOR", "withdraw", [], { transfer: true });
  assert((await credit("SPONSOR")) === 0n, "the sponsor's credit was not drawn");
}

say(`stats ${JSON.stringify(await readJson("get_stats", []))}`);
const missed = run.no_consensus ?? [];
say(missed.length ? `${missed.length} round(s) reached no majority and were asked again` : "no round had to be asked again");
say(`the app's own rules agreed with the chain at ${Object.keys(run.app ?? {}).length} checks`);
mkdirSync(fileURLToPath(new URL("../docs/proofs/", import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(new URL("../docs/proofs/paths.json", import.meta.url)), JSON.stringify(run, null, 2));
say("every path passed");
