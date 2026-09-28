/**
 * The app's rules on records the contract wrote. tests/fixtures/states.json
 * is produced by tests/direct/test_web_fixtures.py driving the real contract,
 * and that test fails if the contract's shapes drift from the fixtures, so
 * these rules are never tested on shapes the chain cannot produce.
 */
import { describe, expect, it } from "vitest";

import { claimActs, filerRole, preflightGap, room, typeActs } from "@/lib/acts";
import type { Claim, Determination, EventType, TypeVersion } from "@/lib/types";

import states from "./fixtures/states.json";

type State = { claim: Claim; determination: Determination | null; version: TypeVersion; type: EventType };
const S = states as unknown as Record<string, State> & { addresses: Record<string, string> };
const A = S.addresses;
const at = (iso: string) => Date.parse(iso);
const T0 = at("2026-09-20T09:00:00Z");
const AFTER_WINDOW = at("2026-09-20T10:00:01Z");
const LAPSED = at("2026-10-04T09:00:01Z");
const STALE = at("2026-09-23T10:00:01Z");

function acts(name: string, who: string, now: number) {
  const s = S[name]!;
  return claimActs(s.claim, s.version, s.determination, who ? A[who]! : "", now);
}

describe("a claim gathering evidence", () => {
  it("names the missing evidence in the contract's own words", () => {
    const s = S.open_empty!;
    expect(preflightGap(s.version, s.claim.evidence ?? []))
      .toBe("the event type requires 1 scene photo before assessment; 0 on file");
    const a = acts("open_empty", "CLAIMANT", T0);
    expect(a.assess.ok).toBe(false);
    expect(a.assess.why).toMatch(/^The event type requires 1 scene photo/);
  });

  it("offers the assessment to the claimant alone once the file is complete", () => {
    expect(acts("open_ready", "CLAIMANT", T0).assess.ok).toBe(true);
    expect(acts("open_ready", "STRANGER", T0).assess.ok).toBe(false);
    expect(acts("open_ready", "SPONSOR", T0).assess.ok).toBe(false);
    expect(acts("open_ready", "CLAIMANT", LAPSED).assess.ok).toBe(false);
  });

  it("lets only the claim's parties file, and only inside the period", () => {
    expect(acts("open_empty", "CLAIMANT", T0).fileImage.ok).toBe(true);
    expect(acts("open_empty", "SPONSOR", T0).fileImage.ok).toBe(false);
    expect(acts("open_empty", "STRANGER", T0).fileDocument.ok).toBe(false);
    expect(acts("open_empty", "CLAIMANT", LAPSED).fileImage.ok).toBe(false);
  });

  it("allows withdrawal up to the deadline and closing only after it", () => {
    expect(acts("open_empty", "CLAIMANT", T0).withdraw.ok).toBe(true);
    expect(acts("open_empty", "STRANGER", T0).withdraw.ok).toBe(false);
    expect(acts("open_lapsed", "CLAIMANT", LAPSED).withdraw.ok).toBe(false);
    expect(acts("open_empty", "STRANGER", T0).close.ok).toBe(false);
    expect(acts("open_lapsed", "STRANGER", LAPSED).close.ok).toBe(true);
  });
});

describe("a standing determination", () => {
  it("is appealed by the party it went against, inside the window", () => {
    expect(acts("determined_established", "SPONSOR", T0).appeal.ok).toBe(true);
    expect(acts("determined_established", "CLAIMANT", T0).appeal.ok).toBe(false);
    expect(acts("determined_undetermined_assessed", "CLAIMANT", T0).appeal.ok).toBe(true);
    expect(acts("determined_undetermined_assessed", "SPONSOR", T0).appeal.ok).toBe(false);
    expect(acts("determined_established", "SPONSOR", AFTER_WINDOW).appeal.ok).toBe(false);
  });

  it("is finalized by anyone once no appeal can be filed", () => {
    expect(acts("determined_established", "STRANGER", T0).finalize.ok).toBe(false);
    expect(acts("determined_established", "STRANGER", AFTER_WINDOW).finalize.ok).toBe(true);
    expect(acts("readjudicated_no_appeals_left", "STRANGER", T0).finalize.ok).toBe(true);
    expect(acts("readjudicated_no_appeals_left", "CLAIMANT", T0).appeal.ok).toBe(false);
  });

  it("takes no new evidence and cannot be closed", () => {
    const a = acts("determined_established", "CLAIMANT", T0);
    expect(a.fileImage.ok).toBe(false);
    expect(a.close.ok).toBe(false);
    expect(a.withdraw.ok).toBe(false);
  });
});

describe("an appeal", () => {
  it("lets the sponsor file only during its own appeal", () => {
    expect(filerRole(S.appeal_by_sponsor!.claim, A.SPONSOR!)).toBe("SPONSOR");
    expect(filerRole(S.appeal_by_claimant!.claim, A.SPONSOR!)).toBe(null);
    expect(filerRole(S.appeal_by_claimant!.claim, A.ASSESSOR!)).toBe("ASSESSOR");
  });

  it("counts additions since the appeal opened", () => {
    expect(room(S.appeal_by_sponsor!.claim, "SPONSOR", "IMAGE")).toBe(1);
    expect(room(S.appeal_by_sponsor!.claim, "CLAIMANT", "IMAGE")).toBe(2);
    expect(acts("appeal_by_sponsor", "CLAIMANT", T0).fileImage.ok).toBe(true);
  });

  it("is readjudicated by anyone once both sides could answer", () => {
    expect(acts("appeal_by_sponsor", "SPONSOR", T0).readjudicate.ok).toBe(false);
    expect(acts("appeal_by_sponsor", "STRANGER", AFTER_WINDOW).readjudicate.ok).toBe(true);
  });

  it("closes as undecided only three days after its evidence period", () => {
    expect(acts("appeal_by_sponsor", "STRANGER", AFTER_WINDOW).close.ok).toBe(false);
    expect(acts("appeal_by_sponsor", "STRANGER", STALE).close.ok).toBe(true);
  });
});

describe("a finished claim", () => {
  it("offers nothing", () => {
    for (const name of ["final", "withdrawn"]) {
      for (const who of ["CLAIMANT", "SPONSOR", "ASSESSOR", "STRANGER"]) {
        const a = acts(name, who, AFTER_WINDOW);
        for (const act of [a.fileImage, a.fileDocument, a.assess, a.appeal, a.readjudicate, a.finalize, a.close, a.withdraw]) {
          expect(act.ok).toBe(false);
        }
      }
    }
  });
});

describe("the event type", () => {
  const { type, version } = S.open_ready!;

  it("keeps interested parties out of claiming", () => {
    expect(typeActs(type, version, A.STRANGER!).fileClaim.ok).toBe(true);
    expect(typeActs(type, version, A.SPONSOR!).fileClaim.ok).toBe(false);
    expect(typeActs(type, version, A.ASSESSOR!).fileClaim.ok).toBe(false);
    expect(typeActs(type, version, A.STRANGER!, 3).fileClaim.why).toMatch(/at most 3 open claims/);
  });

  it("refuses a claim the free reserve cannot cover", () => {
    const poor = { ...type, reserve_wei: type.committed_wei };
    expect(typeActs(poor, version, A.STRANGER!).fileClaim.why).toMatch(/reserve cannot cover/);
  });

  it("gives the sponsor its acts and nobody else", () => {
    expect(typeActs(type, version, A.SPONSOR!).fund.ok).toBe(true);
    expect(typeActs(type, version, A.SPONSOR!).withdrawReserve.ok).toBe(true);
    expect(typeActs(type, version, A.SPONSOR!).pause.ok).toBe(true);
    expect(typeActs(type, version, A.SPONSOR!).resume.ok).toBe(false);
    expect(typeActs(type, version, A.STRANGER!).fund.ok).toBe(false);
  });

  it("offers the assessor role only to a named wallet that has not accepted", () => {
    expect(typeActs(type, version, A.ASSESSOR!).acceptAssessor.ok).toBe(false);
    expect(typeActs({ ...type, accepted_assessors: [] }, version, A.ASSESSOR!).acceptAssessor.ok).toBe(true);
    expect(typeActs({ ...type, accepted_assessors: [] }, version, A.STRANGER!).acceptAssessor.ok).toBe(false);
  });

  it("reads addresses in any case", () => {
    expect(typeActs(type, version, A.SPONSOR!.toLowerCase()).fund.ok).toBe(true);
  });
});

describe("the edges of the mirrors", () => {
  it("counts an assessor's report only when the assessor filed it", () => {
    const v = { evidence_requirements: [{ type: "ASSESSOR_REPORT" as const, min_count: 1 }] };
    expect(preflightGap(v, [{ kind: "DOCUMENT", doc_type: "ASSESSOR_REPORT", role: "CLAIMANT" }]))
      .toBe("the event type requires 1 assessor report before assessment; 0 on file");
    expect(preflightGap(v, [{ kind: "DOCUMENT", doc_type: "ASSESSOR_REPORT", role: "ASSESSOR" }])).toBe("");
  });

  it("offers pause only to an active type and resume only to a paused one", () => {
    const { type, version } = S.open_ready!;
    const paused = { ...type, state: "PAUSED" as const };
    expect(typeActs(paused, version, A.SPONSOR!).pause.ok).toBe(false);
    expect(typeActs(paused, version, A.SPONSOR!).resume.ok).toBe(true);
  });
});
