"""Both sides of every limit and every deadline."""
import json

import pytest
from conftest import (rejudge, 
    BOND,
    CLAIMANT,
    GEN,
    SPONSOR,
    STRANGER,
    as_,
    assess,
    claim,
    create_type,
    err,
    event_type,
    file,
    judgment,
    llm,
    open_claim,
    owed,
    photo,
    ratings,
    seen,
    set_now,
    standard_file,
)


def _create(module, c, **over):
    as_(module, SPONSOR, GEN)
    return json.loads(c.create_event_type(event_type(**over)))


@pytest.mark.parametrize("field,ok,bad", [
    ("benefit_wei", str(10**16), str(10**16 - 1)),
    ("benefit_wei", str(10**21), str(10**21 + 1)),
    ("appeal_window_seconds", 600, 599),
    ("appeal_window_seconds", 30 * 86400, 30 * 86400 + 1),
    ("evidence_period_seconds", 600, 599),
    ("filing_window_days", 365, 366),
    ("filing_window_days", 1, 0),
    ("evidence_days", 60, 61),
    ("evidence_days", 1, 0),
    ("max_appeals", 2, 3),
    ("max_appeals", 0, -1),
])
def test_type_limits_both_sides(module, c, field, ok, bad):
    extra = {"bond_wei": "0"} if field == "benefit_wei" else {}
    assert _create(module, c, **{field: ok}, **extra)["refused"] is False
    assert _create(module, c, **{field: bad}, **extra)["refused"] is True


def test_the_bond_may_be_zero_or_equal_to_the_benefit(module, c):
    assert _create(module, c, bond_wei="0")["refused"] is False
    assert _create(module, c, bond_wei=str(2 * GEN))["refused"] is False
    tid = "et-00001"
    as_(module, CLAIMANT, 0)
    assert json.loads(c.file_claim(tid, json.dumps({
        "subject": "Ground-floor kitchen", "subject_ref": "HOME-1", "event_date": "2026-09-19",
        "declared_cause": "Burst pipe", "account": "Water across the floor in the morning."})))["refused"] is True


def test_eight_criteria_are_allowed(module, c):
    assert _create(module, c, criteria=[f"Criterion number {i} is met" for i in range(8)])["refused"] is False


def test_the_event_date_may_be_today(module, c):
    tid = create_type(module, c)
    assert file(module, c, tid, event_date="2026-09-20")["refused"] is False


def test_the_request_closes_with_the_evidence_period(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    set_now("2026-10-04T09:00:01Z")
    with pytest.raises(err(module), match="can only be closed"):
        assess(module, c, cid)
    set_now("2026-10-04T09:00:00Z")
    assert assess(module, c, cid)["determination"] == "ESTABLISHED"


def test_the_appeal_window_edge(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    assess(module, c, cid, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    set_now("2026-09-20T10:00:00Z")
    as_(module, CLAIMANT)
    assert json.loads(c.open_appeal(cid, "Last second appeal"))["claim_id"] == cid


def test_the_readjudication_edge_for_strangers(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    assess(module, c, cid, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    c.open_appeal(cid, "Grounds for this appeal")
    photo(module, c, cid, view="DAMAGE_DETAIL", description="A clearer close-up")
    llm(look=seen(2), judge=judgment(ratings()))
    set_now("2026-09-20T10:00:00Z")
    for who in (CLAIMANT, STRANGER):
        as_(module, who)
        with pytest.raises(err(module), match="both sides can still file"):
            c.readjudicate(cid)
    set_now("2026-09-20T10:00:01Z")
    as_(module, STRANGER)
    assert json.loads(c.readjudicate(cid))["determination"] == "ESTABLISHED"


def test_a_second_appeal_when_the_type_allows_two(module, c):
    tid, cid = open_claim(module, c, type_over={"max_appeals": 2})
    standard_file(module, c, cid)
    assess(module, c, cid, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    c.open_appeal(cid, "First appeal grounds")
    photo(module, c, cid, view="DAMAGE_DETAIL")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings()))
    as_(module, CLAIMANT)
    rejudge(module, c, cid)
    d = json.loads(c.get_determination("det-000002"))
    assert d["appeals_left"] == 1 and d["appeal_window_ends"] == "2026-09-20T11:00:01Z"
    as_(module, SPONSOR)
    c.open_appeal(cid, "The sponsor now appeals the established result")
    photo(module, c, cid, who=SPONSOR, view="SCENE", description="The sponsor's own photograph")
    assert claim(c, cid)["appeal"]["by"] == "SPONSOR" and claim(c, cid)["appeal"]["mark"] == 3
    llm(look=[seen(2), seen(1)], judge=judgment(ratings()))
    as_(module, SPONSOR)
    rejudge(module, c, cid)
    k = claim(c, cid)
    assert k["appeals_used"] == 2 and json.loads(c.get_determination("det-000003"))["appeals_left"] == 0
    c.finalize(cid)
    assert owed(c, CLAIMANT) == 2 * GEN + BOND
