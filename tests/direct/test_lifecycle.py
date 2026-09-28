"""From a standing determination to a final one: appeals from each side,
readjudication, finalization, the stale-appeal close, and what each outcome
settles to."""
import json

import pytest
from conftest import (rejudge, 
    ASSESSOR,
    BENEFIT,
    BOND,
    CLAIMANT,
    GEN,
    SPONSOR,
    STRANGER,
    as_,
    assess,
    claim,
    determination,
    err,
    etype,
    events,
    file,
    judgment,
    llm,
    open_claim,
    owed,
    photo,
    ratings,
    receipt,
    seen,
    set_now,
    standard_file,
    transfers,
)

AFTER_WINDOW = "2026-09-20T10:00:01Z"


def _decided(module, c, judge=None, type_over=None, **kw):
    tid, cid = open_claim(module, c, type_over=type_over)
    standard_file(module, c, cid)
    assess(module, c, cid, judge=judge, **kw)
    return tid, cid


# ── finalization and what it settles ────────────────────────────────────────

def test_finalize_waits_for_the_window_then_anyone_may(module, c):
    tid, cid = _decided(module, c)
    as_(module, STRANGER)
    set_now("2026-09-20T10:00:00Z")
    with pytest.raises(err(module), match="appeal window is still open"):
        c.finalize(cid)
    set_now(AFTER_WINDOW)
    c.finalize(cid)
    k = claim(c, cid)
    assert k["state"] == "FINAL" and k["final"]["how"] == "finalized" and k["final"]["paid_wei"] == str(BENEFIT)
    with pytest.raises(err(module), match="only a standing determination is finalized"):
        c.finalize(cid)


def test_established_pays_the_benefit_and_returns_the_bond(module, c):
    tid, cid = _decided(module, c)
    set_now(AFTER_WINDOW)
    c.finalize(cid)
    assert owed(c, CLAIMANT) == BENEFIT + BOND
    t = etype(c, tid)
    assert t["reserve_wei"] == str(10 * GEN - BENEFIT) and t["paid_wei"] == str(BENEFIT)
    assert t["committed_wei"] == "0" and t["open_claims"] == 0
    assert json.loads(c.get_stats())["established"] == 1 and json.loads(c.get_stats())["paid_wei"] == BENEFIT
    assert determination(c, "det-000001")["lifecycle"] == "FINAL"
    as_(module, CLAIMANT)
    c.withdraw()
    assert transfers() == [{"to": CLAIMANT, "wei": BENEFIT + BOND}]


def test_not_established_forfeits_the_bond_to_the_reserve(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(S2="NOT_SATISFIED")))
    set_now(AFTER_WINDOW)
    as_(module, SPONSOR)
    out = json.loads(c.finalize(cid))
    assert out == {"claim_id": cid, "state": "FINAL", "determination": "NOT_ESTABLISHED", "paid_wei": "0",
                   "bond_to": "SPONSOR_RESERVE"}
    t = etype(c, tid)
    assert t["reserve_wei"] == str(10 * GEN + BOND) and t["forfeited_wei"] == str(BOND)
    assert t["committed_wei"] == "0" and owed(c, CLAIMANT) == 0


def test_undetermined_returns_the_bond_and_releases_the_benefit(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(), sufficient=False))
    set_now(AFTER_WINDOW)
    c.finalize(cid)
    assert owed(c, CLAIMANT) == BOND
    t = etype(c, tid)
    assert t["reserve_wei"] == str(10 * GEN) and t["committed_wei"] == "0" and t["free_wei"] == str(10 * GEN)
    r = receipt(c, cid)
    assert r["final"] is True and r["determination"] == "UNDETERMINED" and r["finalized_at"] == AFTER_WINDOW[:19] + "Z"


def test_a_final_undetermined_claim_can_be_filed_again_inside_the_window(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(), sufficient=False))
    set_now(AFTER_WINDOW)
    c.finalize(cid)
    assert file(module, c, tid)["refused"] is False
    set_now("2026-10-19T09:00:00Z")
    out = file(module, c, tid)
    assert out["refused"] and "within 30 days" in out["reason"]


def test_with_no_appeals_the_determination_is_final_at_once(module, c):
    tid, cid = _decided(module, c, type_over={"max_appeals": 0})
    d = determination(c, "det-000001")
    assert d["appeals_left"] == 0 and d["appeal_window_ends"] == d["decided_at"]
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="no appeal is left"):
        c.open_appeal(cid, "I dispute this")
    c.finalize(cid)
    assert claim(c, cid)["state"] == "FINAL"


# ── appeals ─────────────────────────────────────────────────────────────────

def test_the_party_it_went_against_appeals(module, c):
    tid, cid = _decided(module, c)
    as_(module, CLAIMANT)
    with pytest.raises(err(module), match="only the sponsor appeals an established event"):
        c.open_appeal(cid, "Grounds enough")
    tid, cid2 = open_claim(module, c)
    standard_file(module, c, cid2)
    assess(module, c, cid2, judge=judgment(ratings(C1="NOT_SATISFIED")), basis="ev-000003")
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="only the claimant appeals"):
        c.open_appeal(cid2, "Grounds enough")


def test_an_appeal_needs_grounds_and_the_window(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    with pytest.raises(err(module), match="at least 10 characters"):
        c.open_appeal(cid, "no")
    set_now(AFTER_WINDOW)
    with pytest.raises(err(module), match="appeal window has closed"):
        c.open_appeal(cid, "The photographs were blurred")


def _claimant_appeal(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    out = json.loads(c.open_appeal(cid, "The damage photograph was blurred; a clear one follows."))
    assert out["evidence_ends"] == "2026-09-20T10:00:00Z"
    return tid, cid


def test_a_claimant_appeal_takes_new_evidence_within_its_additions(module, c):
    tid, cid = _claimant_appeal(module, c)
    k = claim(c, cid)
    assert k["state"] == "UNDER_APPEAL" and k["appeal"]["by"] == "CLAIMANT" and k["appeal"]["mark"] == 2
    assert determination(c, "det-000001")["lifecycle"] == "APPEALED"
    a = photo(module, c, cid, view="DAMAGE_DETAIL")
    photo(module, c, cid, view="SCENE")
    with pytest.raises(err(module), match="at most 2 new photographs"):
        photo(module, c, cid)
    assert json.loads(c.get_evidence(a))["during_appeal"] is True
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="only the claimant"):
        photo(module, c, cid, who=SPONSOR)
    set_now(AFTER_WINDOW)
    with pytest.raises(err(module), match="appeal's evidence period has ended"):
        photo(module, c, cid)


def test_readjudication_links_and_supersedes(module, c):
    tid, cid = _claimant_appeal(module, c)
    new = photo(module, c, cid, view="DAMAGE_DETAIL", description="A clear shot of the split fitting")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings()))
    for who in (STRANGER, CLAIMANT):
        as_(module, who)
        with pytest.raises(err(module), match="both sides can still file"):
            c.readjudicate(cid)
    out = rejudge(module, c, cid, who=CLAIMANT)
    assert out == {"determination_id": "det-000002", "determination": "ESTABLISHED", "appeal_of": "det-000001"}
    prior, d = determination(c, "det-000001"), determination(c, "det-000002")
    assert prior["lifecycle"] == "SUPERSEDED" and prior["superseded_by"] == "det-000002"
    assert prior["determination"] == "UNDETERMINED"
    assert d["kind"] == "READJUDICATION" and d["appeal_of"] == "det-000001" and d["appeals_left"] == 0
    assert d["appeal"]["by"] == "CLAIMANT" and d["appeal"]["opened_by"] == CLAIMANT
    snap = json.loads(c.get_snapshot(d["snapshot_id"]))
    assert [e["evidence_id"] for e in snap["evidence"] if e["new_on_appeal"]] == [new]
    k = claim(c, cid)
    assert k["state"] == "DETERMINED" and k["appeal"] is None and k["determinations"] == ["det-000001", "det-000002"]
    as_(module, CLAIMANT)
    with pytest.raises(err(module), match="no appeal is left"):
        c.open_appeal(cid, "Once more please")
    c.finalize(cid)
    assert owed(c, CLAIMANT) == BENEFIT + BOND


def test_anyone_readjudicates_after_the_evidence_period(module, c):
    tid, cid = _claimant_appeal(module, c)
    set_now(AFTER_WINDOW)
    llm(look=seen(2), judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, STRANGER)
    assert rejudge(module, c, cid)["determination"] == "UNDETERMINED"
    c.finalize(cid)
    k = claim(c, cid)
    assert k["final"]["determination"] == "UNDETERMINED" and k["final"]["determination_id"] == "det-000002"
    assert owed(c, CLAIMANT) == BOND


def test_a_failed_readjudication_round_changes_nothing(module, c):
    tid, cid = _claimant_appeal(module, c)
    llm(look=seen(2), judge=judgment(ratings()), v_judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    with pytest.raises(err(module), match="did not agree"):
        rejudge(module, c, cid)
    k = claim(c, cid)
    assert k["state"] == "UNDER_APPEAL" and k["appeals_used"] == 0
    assert determination(c, "det-000001")["lifecycle"] == "APPEALED"


def test_an_undecided_appeal_closes_three_days_after_its_evidence_period(module, c):
    tid, cid = _claimant_appeal(module, c)
    as_(module, STRANGER)
    set_now("2026-09-23T10:00:00Z")
    with pytest.raises(err(module), match="three days after"):
        c.close_claim(cid)
    set_now("2026-09-23T10:00:01Z")
    out = json.loads(c.close_claim(cid))
    assert out["determination"] == "UNDETERMINED"
    k = claim(c, cid)
    assert k["state"] == "FINAL" and k["final"]["how"] == "appeal left undecided" and k["appeal"] is None
    d = determination(c, "det-000001")
    assert d["lifecycle"] == "FINAL" and d["notes"]["finalized_undecided_on_appeal"] is True
    assert owed(c, CLAIMANT) == BOND and etype(c, tid)["committed_wei"] == "0"


# ── the sponsor's appeal ────────────────────────────────────────────────────

def _sponsor_appeal(module, c):
    tid, cid = _decided(module, c)
    as_(module, SPONSOR)
    c.open_appeal(cid, "The fitting in these photographs is outside, not under the sink.")
    return tid, cid


def test_the_sponsor_files_only_during_its_own_appeal(module, c):
    tid, cid = _sponsor_appeal(module, c)
    s1 = photo(module, c, cid, who=SPONSOR, view="SCENE", description="The garden tap")
    photo(module, c, cid, who=SPONSOR, view="DAMAGE_DETAIL")
    with pytest.raises(err(module), match="at most 2 new photographs"):
        photo(module, c, cid, who=SPONSOR)
    assert json.loads(c.get_evidence(s1))["role"] == "SPONSOR"
    assert photo(module, c, cid)  # the claimant may answer


def test_the_sponsors_photographs_cannot_fail_a_requirement_alone(module, c):
    tid, cid = _sponsor_appeal(module, c)
    s1 = photo(module, c, cid, who=SPONSOR, view="SCENE", description="The garden tap")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(C2="NOT_SATISFIED"), basis={"C2": [s1]}),
        basis_default="ev-000001")
    as_(module, SPONSOR)
    out = rejudge(module, c, cid)
    assert out["determination"] == "UNDETERMINED"
    d = determination(c, out["determination_id"])
    assert {r["id"]: r["status"] for r in d["requirements"]}["C2"] == "NOT_ESTABLISHED"
    assert d["appeal"]["by"] == "SPONSOR"


def test_beside_a_claimant_photograph_the_sponsors_can_fail_it(module, c):
    tid, cid = _sponsor_appeal(module, c)
    s1 = photo(module, c, cid, who=SPONSOR, view="SCENE", description="The garden tap")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(C2="NOT_SATISFIED"), basis={"C2": [s1, "ev-000002"]}))
    as_(module, SPONSOR)
    out = rejudge(module, c, cid)
    assert out["determination"] == "NOT_ESTABLISHED"
    c.finalize(cid)
    assert etype(c, tid)["forfeited_wei"] == str(BOND)


def test_the_sponsors_photographs_can_carry_a_satisfied_rating_for_the_claimant(module, c):
    tid, cid = open_claim(module, c, type_over={"assessors": [ASSESSOR]}, assessor=ASSESSOR)
    standard_file(module, c, cid)
    rep = "ev-000003"
    from conftest import document
    assert document(module, c, cid, who=ASSESSOR, doc_type="ASSESSOR_REPORT", text="Seen on site.") == rep
    assess(module, c, cid, judge=judgment(ratings(), basis={"C1": [rep], "C2": [rep]}))
    as_(module, SPONSOR)
    c.open_appeal(cid, "We think the water came from outside.")
    s1 = photo(module, c, cid, who=SPONSOR, view="SCENE", description="Our photograph")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(), basis={"C1": ["ev-000001", s1], "C2": [rep]}))
    assert rejudge(module, c, cid)["determination"] == "ESTABLISHED"


def test_the_event_log_tells_the_story(module, c):
    tid, cid = _claimant_appeal(module, c)
    llm(look=seen(2), judge=judgment(ratings()))
    as_(module, CLAIMANT)
    rejudge(module, c, cid)
    c.finalize(cid)
    assert events(c, tid) == ["TYPE_CREATED", "RESERVE_FUNDED", "CLAIM_FILED", "EVIDENCE_FILED",
                              "EVIDENCE_FILED", "DETERMINATION_RECORDED", "APPEAL_OPENED",
                              "DETERMINATION_RECORDED", "CLAIM_FINAL"]
