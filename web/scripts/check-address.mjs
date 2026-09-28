// One address everywhere: the deployment of record the app reads must be the
// one the proof run was recorded on and the one the README names. A judge
// clones and runs; a checkout whose surfaces disagree does not reproduce what
// was judged, so this fails the build rather than leaving it to be found.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const ADDRESS = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;

const config = read("../lib/config.ts").match(/RECORD_ADDRESS = "(0x[0-9a-fA-F]{40})"/)?.[1];
if (!config || /^0x0{40}$/.test(config)) {
  console.error("lib/config.ts names no deployment of record");
  process.exit(1);
}
const same = (a) => String(a).toLowerCase() === config.toLowerCase();
const problems = [];

const proofs = JSON.parse(read("../../docs/proofs/proofs.json")).address;
if (!same(proofs ?? "")) problems.push(`docs/proofs/proofs.json records ${proofs || "no address"}`);

for (const doc of ["../../README.md", "../../docs/proofs/README.md"]) {
  const text = read(doc);
  const named = (text.match(ADDRESS) ?? []).filter((a) =>
    /deployment of record|Contract|proofs? (ran )?on/i.test(text.split("\n").find((l) => l.includes(a)) ?? ""));
  if (!named.length) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} never names the deployment of record`);
  for (const a of named) if (!same(a)) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} names ${a}`);
}

if (problems.length) {
  console.error(`The deployment of record is ${config}, but:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`one address everywhere: ${config}`);
