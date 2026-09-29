// Mutation sweep for the app's rules (pnpm mutate): break one rule at a time
// in web/lib, run the tests that cover it, and require a failure. Every rule
// in lib/acts.ts mirrors a guard in contracts/occurra.py; each mutant here
// breaks one mirror. Every file is restored in a finally block, and the run
// ends by comparing each one against its contents before the sweep.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const NODE = process.execPath;
const VITEST = join(WEB, "node_modules/vitest/vitest.mjs");

const M = [
  ["acts", "addresses compare case-sensitively",
   "export const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();",
   "export const same = (a?: string | null, b?: string | null) => !!a && !!b && a === b;"],
  ["acts", "the missing evidence is not counted", "    if (have < r.min_count) {", "    if (false) {"],
  ["acts", "anyone's assessor report counts",
   '        return item.kind === "DOCUMENT" && item.doc_type === rtype && item.role === "ASSESSOR";',
   '        return item.kind === "DOCUMENT" && item.doc_type === rtype;'],
  ["acts", "the sponsor files outside its own appeal",
   '  if (c.appeal && c.appeal.by === "SPONSOR" && same(addr, c.sponsor)) return "SPONSOR";',
   '  if (c.appeal && same(addr, c.sponsor)) return "SPONSOR";'],
  ["acts", "appeal additions are not counted", "    return Math.max(0, APPEAL_ADDITIONS[bucket] - added);",
   "    return Math.max(0, QUOTAS[role][bucket] - mine.length);"],
  ["acts", "evidence after the deadline", '  const evidenceOpen = c.state === "OPEN" ? now <= t(c.evidence_ends)',
   '  const evidenceOpen = c.state === "OPEN" ? true'],
  ["acts", "anyone asks for the assessment", '    [!claimant, "Only the claimant asks for the assessment."],', ""],
  ["acts", "an assessment with evidence missing", '    [gap !== "", gap ? gap.charAt(0).toUpperCase() + gap.slice(1) + "." : ""],', ""],
  ["acts", "an assessment after the deadline",
   '    [now > t(c.evidence_ends), "The claim\'s evidence period has ended; the claim can only be closed."],\n    [gap',
   "    [gap"],
  ["acts", "the wrong party appeals",
   '  const appellant = d?.determination === "ESTABLISHED" ? same(addr, c.sponsor) : claimant;',
   "  const appellant = !!addr;"],
  ["acts", "an appeal after its window", '    [!!d && now > t(d.appeal_window_ends), "The appeal window has closed."],', ""],
  ["acts", "appeals without limit", '    [!!d && d.appeals_left <= 0, "No appeal is left on this claim."],', ""],
  ["acts", "a readjudication before both sides answer",
   '    [!!c.appeal && now <= t(c.appeal.evidence_ends), "The appeal\'s evidence period is still open, so both sides can still file."],', ""],
  ["acts", "finalize inside the window",
   '    [!!d && d.appeals_left > 0 && now <= t(d.appeal_window_ends), "The appeal window is still open."],', ""],
  ["acts", "an appeal with nothing new is judged again",
   '    [!!c.appeal && !brought(c), "The appellant filed no new evidence, so there is nothing to judge again; the appeal can be closed."],', ""],
  ["acts", "only the appellant's evidence counts, or anyone's", "  return (c.evidence ?? []).some((e) => seq(e.evidence_id) > a.mark && e.role === a.by);",
   "  return (c.evidence ?? []).some((e) => seq(e.evidence_id) > a.mark);"],
  ["acts", "an empty appeal waits three days to close", "    else if (!brought(c)) close = yes;", ""],
  ["acts", "an open claim closes early", '    close = now > t(c.evidence_ends) ? yes : no("The claim\'s evidence period has not ended.");',
   "    close = yes;"],
  ["acts", "an appeal closes as stale at once", "    else close = now > t(c.appeal.evidence_ends) + STALE_APPEAL_MS",
   "    else close = now > t(c.appeal.evidence_ends)"],
  ["acts", "a lapsing claim is withdrawn",
   '    [now > t(c.evidence_ends), "The evidence period has ended; the claim can only be closed."],\n  );\n\n  return',
   "  );\n\n  return"],
  ["acts", "the sponsor claims under its own type", '      [sponsor, "The sponsor cannot claim under its own event type."],', ""],
  ["acts", "an assessor claims", '      [named, "An assessor of this event type cannot claim under it."],', ""],
  ["acts", "a claim the reserve cannot cover", '      [free < big(version.benefit_wei), "The sponsor\'s reserve cannot cover this benefit now."],', ""],
  ["acts", "the open-claim cap is ignored", "      [openMine >= MAX_OPEN_PER_CLAIMANT,", "      [false,"],
  ["acts", "a stranger funds the reserve", '    fund: first([!addr, "Connect a wallet."], [!sponsor, notSponsor]),',
   '    fund: first([!addr, "Connect a wallet."]),'],
  ["acts", "anyone accepts the assessor role",
   '                          [!named, "Only a wallet the event type names as an assessor takes up the role."],', ""],
  ["acts", "the role is accepted twice", '                          [accepted, "This wallet has already accepted the role."]),',
   "                          ),"],
  ["acts", "pause offered when already paused", '    pause: first([!sponsor, notSponsor], [type.state !== "ACTIVE", "The event type is already paused."]),',
   "    pause: first([!sponsor, notSponsor]),"],
  ["present", "validators' evidence ids reach the page",
   String.raw`    .replace(/ev-0*(\d+)/gi, (_m, d: string) => ` + "`evidence ${parseInt(d, 10)}`)", ""],
  ["present", "fractions of GEN vanish", '  if (frac > 0n) text += `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;', ""],
  ["present", "a raw requirement id reaches the page", '  id.startsWith("C") ? `Criterion ${id.slice(1)}` : CHECKS[id] ?? id;', "  id;"],
  ["receipt", "a round the validators rejected reads as confirmed", '  return resultName === "MAJORITY_AGREE" || resultName === "AGREE";', "  return true;"],
];

const files = { acts: "lib/acts.ts", present: "lib/present.ts", receipt: "lib/receipt.ts" };
const tests = { acts: "tests/acts.test.ts", present: "tests/present.test.ts", receipt: "tests/consensus.test.ts" };

const [MAJOR, MINOR] = process.versions.node.split(".").map(Number);
const NEEDS_FLAG = MAJOR < 22 || (MAJOR === 22 && MINOR < 12);
const ENV = NEEDS_FLAG
  ? { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --experimental-require-module`.trim() }
  : process.env;

function run(testFiles) {
  const r = spawnSync(NODE, [VITEST, "run", ...testFiles.split(" ")], { cwd: WEB, encoding: "utf8", env: ENV });
  const tail = `${r.stdout}${r.stderr}`.match(/Tests\s+[^\n]+/)?.[0] ?? "no summary";
  return { ok: r.status === 0, tail: tail.replace(/\s+/g, " ").trim() };
}

const snapshot = Object.fromEntries(Object.values(files).map((f) => [f, readFileSync(join(WEB, f), "utf8")]));

let killed = 0;
const survivors = [];
for (const [area, name, from, to] of M) {
  const path = join(WEB, files[area]);
  const original = readFileSync(path, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(`BAD      ${name}: pattern found ${count} times`);
    survivors.push(name);
    continue;
  }
  try {
    writeFileSync(path, original.replace(from, to));
    const r = run(tests[area]);
    if (r.ok) {
      survivors.push(name);
      console.log(`SURVIVED ${name}  (${r.tail})`);
    } else {
      killed++;
      console.log(`killed   ${name}  (${r.tail})`);
    }
  } finally {
    writeFileSync(path, original);
  }
}

const control = run("tests");
console.log(`control, the code as written: ${control.ok ? "passes" : "FAILS"} (${control.tail})`);
const changed = Object.entries(snapshot).filter(([f, text]) => readFileSync(join(WEB, f), "utf8") !== text).map(([f]) => f);
console.log(`files after restore: ${changed.length ? `CHANGED ${changed.join(", ")}` : "as they were"}`);
console.log(`${killed}/${M.length} mutants killed${survivors.length ? `; survivors: ${survivors.join(", ")}` : ""}`);
if (survivors.length || !control.ok || changed.length) process.exit(1);
