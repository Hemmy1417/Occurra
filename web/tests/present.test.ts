/** Words on the page: no raw enums, no ids in reading flow, dates spelled by hand. */
import { describe, expect, it } from "vitest";

import {
  claimState, day, gen, outcome, parseGen, prose, refusal, requirementName, span, when, writeOut,
} from "@/lib/present";

describe("the words a page uses", () => {
  it("never shows a raw enum", () => {
    expect(claimState("UNDER_APPEAL")).toBe("Under appeal");
    expect(outcome("NOT_ESTABLISHED")).toBe("Not established");
    expect(requirementName("S2")).toBe("Consistent cause");
    expect(requirementName("C3")).toBe("Criterion 3");
  });

  it("writes out ids a validator cited", () => {
    expect(writeOut("ev-000012 shows the ceiling; C1 and S1 hold.")).toBe(
      "Evidence 12 shows the ceiling; criterion 1 and the subject check hold.");
  });

  it("spells dates in UTC by hand", () => {
    expect(when("2026-09-28T10:04:59Z")).toBe("28 September 2026, 10:04 UTC");
    expect(day("2026-09-18")).toBe("18 September 2026");
    expect(when("not a date")).toBe("");
    expect(span(86_400)).toBe("1 day");
    expect(span(5400)).toBe("90 minutes");
  });

  it("formats and parses GEN without float drift", () => {
    expect(gen("2000000000000000000")).toBe("2 GEN");
    expect(gen("100000000000000000")).toBe("0.1 GEN");
    expect(parseGen("0.1")).toBe(10n ** 17n);
    expect(parseGen("1.5")).toBe(15n * 10n ** 17n);
    expect(parseGen("abc")).toBe(null);
  });

  it("keeps the contract's refusal and a party's words as they are", () => {
    expect(refusal("[EXPECTED] the appeal window has closed")).toBe("The appeal window has closed.");
    expect(prose("  Water\tacross  the floor ")).toBe("Water across the floor");
  });
});
