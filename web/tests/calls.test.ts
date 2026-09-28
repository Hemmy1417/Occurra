/**
 * The app against the deployed contract's own schema (lib/contract-schema.json,
 * fetched with gen_getContractSchema from the deployment of record). A contract
 * call is an untyped array, so neither the typechecker nor the behaviour tests
 * would notice a write nobody can reach or value sent to the wrong method.
 * Argument counts are read off the live pages by the browser bench
 * (docs/proofs/ui-bench.md); this pins what can be pinned statically.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import schema from "@/lib/contract-schema.json";

const ROOT = join(__dirname, "..");
type Method = { params: unknown[]; readonly: boolean; payable?: boolean };
const methods = (schema as { methods: Record<string, Method> }).methods;
const writes = Object.entries(methods).filter(([, m]) => !m.readonly).map(([k]) => k);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}
const code = [...sources(join(ROOT, "app")), ...sources(join(ROOT, "components"))]
  .map((f) => readFileSync(f, "utf8")).join("\n");

// Every <Act method="…"> and every raw kit write names its method as a string literal.
const named = new Set([...code.matchAll(/method(?:=|: )"([a-z_]+)"/g)].map((m) => m[1]!));

describe("the app and the contract agree on the writes", () => {
  it("every method the app names is a write the contract has", () => {
    for (const m of named) expect(writes, `${m} is not a contract write`).toContain(m);
  });

  it("every write the contract has is reachable from some page", () => {
    for (const w of writes) expect([...named], `${w} is never offered`).toContain(w);
  });

  it("value is sent only to the payable writes", () => {
    const payable = writes.filter((w) => methods[w]!.payable);
    expect(payable.sort()).toEqual(["create_event_type", "file_claim", "fund_reserve"]);
    const withValue = [...code.matchAll(/method="([a-z_]+)"[^>]*?\bvalue=\{/gs)].map((m) => m[1]);
    for (const m of withValue) expect(payable).toContain(m);
  });
});
