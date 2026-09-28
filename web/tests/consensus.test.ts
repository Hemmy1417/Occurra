/**
 * A finalized transaction is a write only if the validators agreed. Found in
 * the browser run: a readjudication that reached no majority finalized with
 * the leader's execution successful, and the panel called it confirmed.
 */
import { describe, expect, it } from "vitest";

import { consensusAgreed } from "@/lib/receipt";

describe("the panel's verdict", () => {
  it("counts only an agreeing result as a recorded write", () => {
    expect(consensusAgreed("MAJORITY_AGREE")).toBe(true);
    expect(consensusAgreed("AGREE")).toBe(true);
    for (const r of ["MAJORITY_DISAGREE", "NO_MAJORITY", "TIMEOUT", "DETERMINISTIC_VIOLATION", "", undefined, null]) {
      expect(consensusAgreed(r)).toBe(false);
    }
  });
});
