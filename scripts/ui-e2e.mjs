/**
 * Proves the browser walkthrough from the chain alone. Every transaction the
 * interface signed is read back by hash: who sent it, to which contract, which
 * method its calldata names, and how the validators decided. Then the records
 * the walkthrough left are read from the contract and checked against what the
 * screens said.
 *
 *   node scripts/ui-e2e.mjs
 *
 * Writes docs/proofs/ui-e2e.json. Reads only; signs nothing.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";

import { chain, leaderOf, loadKeys, rpc, sleep } from "./lib.mjs";

const ADDRESS = "0x0F35F98559284e3fFbCe91ad522A58CeE634444E";
const OUT = fileURLToPath(new URL("../docs/proofs/ui-e2e.json", import.meta.url));
const KEYS = loadKeys();
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });

const STEPS = [
  { step: "Write the event type", role: "SPONSOR", method: "create_event_type",
    hash: "0xd6c69413b6052f3efd55f2b791d3d478c0c040a59e2b11e0cea818ec277f2b4e" },
  { step: "File the claim and post the bond", role: "CLAIMANT", method: "file_claim",
    hash: "0xf80bb705e70de1a24024ef38ae686cad91869b0f7cd5ac705b47bd04bdf50a1c" },
  { step: "File the scene photograph", role: "CLAIMANT", method: "submit_image",
    hash: "0xdfd02223335fe910f16fbd0aa2e9ae27101a7d1baf21934a0379a5c8747a4145" },
  { step: "File the damage photograph", role: "CLAIMANT", method: "submit_image",
    hash: "0x4dbe02530067a04b851bab639ce4abe893b37e76fbdafc5bf9d804cc1a529dc7" },
  { step: "Ask for the assessment (first asking)", role: "CLAIMANT", method: "request_assessment",
    hash: "0xd8843fddd36a2af5113fe6b5c99ddb814919a46c6c72ec955d28e910e4ed41b7", expect: "MAJORITY_DISAGREE" },
  { step: "Ask for the assessment (asked again)", role: "CLAIMANT", method: "request_assessment",
    hash: "0x03f57e10ef5b564e8053303e72053509b4c1d685898ecfbec464b48858798ca2" },
  { step: "Finalize once the appeal window closed", role: "STRANGER", method: "finalize",
    hash: "0xe26bc3a67d8e50db74090001e2ecdf382b7373cf5a1310d2a539acd40ba5b362" },
  { step: "Withdraw the credit", role: "CLAIMANT", method: "withdraw",
    hash: "0x666742c959031cdc16aeb73850247bc7c8efdcd57f851aae5af6b39cf4899465" },
];

const failures = [];
const check = (cond, message) => { if (!cond) failures.push(message); return cond; };

async function read(fn, args) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args }));
    } catch (e) {
      if (i === 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

const same = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
const calldataNames = (hex, method) => Buffer.from(String(hex ?? "").replace(/^0x/, ""), "hex").toString("latin1").includes(method);

const txs = [];
for (const s of STEPS) {
  const t = (await rpc("eth_getTransactionByHash", [s.hash])).result;
  const expect = s.expect ?? "MAJORITY_AGREE";
  const leader = leaderOf(t);
  const row = {
    step: s.step, role: s.role, method: s.method, hash: s.hash,
    from: t?.from_address, to: t?.to_address, status: t?.status, result: t?.result_name,
    leader_execution: leader?.execution_result ?? null, created_at: t?.created_at,
    messages: (t?.messages ?? []).length,
  };
  check(t, `${s.step}: no transaction ${s.hash}`);
  check(same(t?.from_address, KEYS[s.role].addr), `${s.step}: sent by ${t?.from_address}, not the ${s.role} wallet`);
  check(same(t?.to_address, ADDRESS), `${s.step}: sent to ${t?.to_address}, not the deployment of record`);
  check(calldataNames(t?.tx_data, s.method), `${s.step}: the calldata does not name ${s.method}`);
  check(t?.status === "FINALIZED", `${s.step}: status ${t?.status}`);
  check(t?.result_name === expect, `${s.step}: ${t?.result_name}, expected ${expect}`);
  if (expect === "MAJORITY_AGREE") check(leader?.execution_result === "SUCCESS", `${s.step}: leader ${leader?.execution_result}`);
  if (s.method === "withdraw") {
    const m = (t?.messages ?? [])[0];
    row.transfer = m ? { to: m.recipient, value_wei: m.value } : null;
    check(row.messages === 1, `${s.step}: ${row.messages} transfer messages, expected 1`);
    check(same(m?.recipient, KEYS[s.role].addr), `${s.step}: the transfer goes to ${m?.recipient}`);
    check(BigInt(m?.value ?? 0) === 11n * 10n ** 17n, `${s.step}: the transfer carries ${m?.value}, expected 1.1 GEN`);
  }
  txs.push(row);
  console.log(`${row.status} ${row.result} ${s.role.padEnd(8)} ${s.method.padEnd(18)} ${s.hash}`);
}

const claim = await read("get_claim", ["cl-00006"]);
const det = await read("get_determination", [claim.determination_id]);
const type = await read("get_event_type", [claim.type_id]);
const claimantCredit = await read("get_credit", [KEYS.CLAIMANT.addr]);

check(claim.state === "FINAL", `claim state ${claim.state}`);
check(same(claim.claimant, KEYS.CLAIMANT.addr), "the claim is not the claimant wallet's");
check(claim.determination_id === "det-000007", `standing determination ${claim.determination_id}`);
check(det.determination === "ESTABLISHED", `determination ${det.determination}`);
check(det.lifecycle === "FINAL", `determination lifecycle ${det.lifecycle}`);
check(claim.final?.how === "finalized", `settled ${claim.final?.how}`);
check(BigInt(claim.final?.paid_wei ?? -1) === 10n ** 18n, `paid ${claim.final?.paid_wei}, expected 1 GEN`);
check(claim.final?.bond_to === "CLAIMANT", `the bond went to ${claim.final?.bond_to}, not the claimant`);
check(claim.type_id === "et-00003", `event type ${claim.type_id}`);
check(same(type.sponsor, KEYS.SPONSOR.addr), "the event type is not the sponsor wallet's");
check(BigInt(claimantCredit.owed) === 0n, `the claimant is still owed ${claimantCredit.owed}`);

const state = {
  claim: { id: claim.claim_id, state: claim.state, how: claim.final?.how ?? null, paid_wei: claim.final?.paid_wei ?? null,
           determination: claim.determination_id, type: claim.type_id },
  determination: { id: det.determination_id, determination: det.determination, lifecycle: det.lifecycle },
  event_type: { id: type.type_id, title: type.title, state: type.state },
  claimant_credit_after_withdrawal: claimantCredit.owed,
};
console.log(JSON.stringify(state, null, 2));

writeFileSync(OUT, JSON.stringify({ address: ADDRESS, chain_id: 61997, transactions: txs, state,
  failures }, null, 2) + "\n");
if (failures.length) {
  console.log(`FAILED:\n  ${failures.join("\n  ")}`);
  process.exit(2);
}
console.log(`all ${txs.length} transactions and the final state check out`);
