/** The read budget and the retry schedule: what keeps a page inside Studio Next's per-IP limit. */
import { describe, expect, it } from "vitest";

import { planStart, READ_BUDGET, READ_WINDOW_MS } from "@/lib/read";
import { retryDelay } from "@/lib/useChain";

describe("the read budget", () => {
  it("never plans more than the budget in any rolling minute", () => {
    const starts: number[] = [];
    const planned = Array.from({ length: 60 }, () => planStart(starts, 0));
    for (const t of planned) {
      const inWindow = planned.filter((x) => x >= t && x < t + READ_WINDOW_MS).length;
      expect(inWindow).toBeLessThanOrEqual(READ_BUDGET);
    }
    expect(READ_BUDGET).toBeLessThan(30);
  });

  it("forgets starts that left the window", () => {
    const starts = Array.from({ length: READ_BUDGET }, (_, i) => i);
    expect(planStart(starts, READ_WINDOW_MS + 100)).toBe(READ_WINDOW_MS + 100);
  });
});

describe("reading again after a transient failure", () => {
  it("backs off and never gives up", () => {
    expect([0, 1, 2, 3, 9].map(retryDelay)).toEqual([10_000, 20_000, 40_000, 60_000, 60_000]);
  });
});
