"""The sponsor's side: writing an event type, its versions, its reserve, its
assessors. Every countable rule is refused in code, in words."""
import json

import pytest
from conftest import (
    ASSESSOR,
    BENEFIT,
    BOND,
    CLAIMANT,
    GEN,
    SPONSOR,
    SPONSOR2,
    STRANGER,
    as_,
    claim,
    create_type,
    err,
    etype,
    event_type,
    events,
    file,
    open_claim,
    owed,
    transfers,
)


def _create(module, c, value=5 * GEN, who=SPONSOR, **over):
    as_(module, who, value)
    return json.loads(c.create_event_type(event_type(**over)))


def test_a_type_is_written_funded_and_versioned(module, c):
    out = _create(module, c)
    assert out == {"refused": False, "type_id": "et-00001"}
    t = etype(c, "et-00001")
    assert t["sponsor"] == SPONSOR and t["state"] == "ACTIVE" and t["version"] == 1
    assert t["reserve_wei"] == t["funded_wei"] == str(5 * GEN) and t["free_wei"] == str(5 * GEN)
    v = json.loads(c.get_type_version("et-00001", 1))
    assert [x["id"] for x in v["criteria"]] == ["C1", "C2"]
    assert v["category"] == "PROPERTY" and v["event_kind"] == "WATER_DAMAGE"
    assert events(c, "et-00001") == ["TYPE_CREATED", "RESERVE_FUNDED"]
    assert json.loads(c.types_of(SPONSOR.lower(), 0, 10))["total"] == 1


@pytest.mark.parametrize("category", ["NATURAL_DISASTER", "TRAVEL", "AVIATION", "AGRICULTURE", "CYBER",
                                      "MARINE", ""])
def test_categories_that_fail_the_oracle_test_do_not_exist(module, c, category):
    out = _create(module, c, category=category)
    assert out["refused"] is True and "property, vehicle, cargo or business interruption" in out["reason"]
    assert owed(c, SPONSOR) == 5 * GEN
    assert c.counters["type"] == "0"


def test_the_config_names_only_the_four_categories(module, c):
    cfg = json.loads(c.get_config())
    assert set(cfg["categories"]) == {"PROPERTY", "VEHICLE", "CARGO", "BUSINESS_INTERRUPTION"}
    assert [s["id"] for s in cfg["system_requirements"]] == ["S1", "S2", "S3"]


def test_the_kind_must_belong_to_the_category(module, c):
    out = _create(module, c, category="PROPERTY", event_kind="COLLISION_DAMAGE")
    assert out["refused"] and "not an event kind of property" in out["reason"]


@pytest.mark.parametrize("over,words", [
    ({"title": "ab"}, "needs a title"),
    ({"definition": "Too short."}, "at least 30 characters"),
    ({"criteria": []}, "between 1 and 8 criteria"),
    ({"criteria": ["x" * 20] * 9}, "between 1 and 8 criteria"),
    ({"criteria": ["short"]}, "criterion 1 needs at least 10"),
    ({"benefit_wei": str(10**16 - 1)}, "the benefit must be between"),
    ({"benefit_wei": str(10**21 + 1)}, "the benefit must be between"),
    ({"benefit_wei": 2.5}, "whole number"),
    ({"benefit_wei": True}, "whole number"),
    ({"bond_wei": str(3 * GEN)}, "the bond must be between"),
    ({"evidence_requirements": [{"type": "VIBES", "min_count": 1}]}, "not an evidence requirement"),
    ({"evidence_requirements": [{"type": "SCENE_PHOTO"}, {"type": "SCENE_PHOTO"}]}, "twice"),
    ({"evidence_requirements": [{"type": "SCENE_PHOTO", "min_count": 5}]}, "count must be between 1 and 4"),
    ({"assessors": [SPONSOR]}, "cannot be one of its own"),
    ({"assessors": ["not-an-address"]}, "must be a wallet address"),
    ({"assessors": [STRANGER] * 6}, "at most 5 assessors"),
    ({"assessor_required": True}, "must name at least one"),
    ({"appeal_window_seconds": 599}, "appeal window"),
    ({"evidence_period_seconds": 30 * 86400 + 1}, "evidence period"),
    ({"filing_window_days": 0}, "filing window"),
    ({"evidence_days": 61}, "evidence period in days"),
    ({"max_appeals": 3}, "appeals per claim"),
])
def test_every_countable_rule_is_refused_in_words(module, c, over, words):
    out = _create(module, c, **over)
    assert out["refused"] is True and words in out["reason"], out
    assert "credited back" in out["reason"] and owed(c, SPONSOR) == 5 * GEN


def test_a_refusal_without_value_credits_nothing(module, c):
    out = _create(module, c, value=0, title="x")
    assert out["refused"] and "credited" not in out["reason"] and owed(c, SPONSOR) == 0


def test_type_json_that_is_not_json_is_refused_and_credited(module, c):
    as_(module, SPONSOR, GEN)
    out = json.loads(c.create_event_type("{nope"))
    assert out["refused"] and "must be JSON" in out["reason"] and owed(c, SPONSOR) == GEN


def test_a_required_assessor_adds_the_report_rule(module, c):
    _create(module, c, assessors=[ASSESSOR], assessor_required=True)
    v = json.loads(c.get_type_version("et-00001", 1))
    assert {"type": "ASSESSOR_REPORT", "min_count": 1} in v["evidence_requirements"]


def test_only_the_sponsor_funds_and_a_refusal_credits_back(module, c):
    tid = create_type(module, c)
    as_(module, STRANGER, GEN)
    out = json.loads(c.fund_reserve(tid))
    assert out["refused"] and owed(c, STRANGER) == GEN
    as_(module, SPONSOR, 0)
    assert json.loads(c.fund_reserve(tid))["refused"]
    as_(module, SPONSOR, GEN)
    assert json.loads(c.fund_reserve(tid))["reserve_wei"] == str(11 * GEN)
    assert etype(c, tid)["funded_wei"] == str(11 * GEN)


def test_funding_an_unknown_type_credits_back(module, c):
    as_(module, SPONSOR, GEN)
    out = json.loads(c.fund_reserve("et-00099"))
    assert out["refused"] and owed(c, SPONSOR) == GEN


def test_a_new_version_binds_new_claims_only(module, c):
    tid, cid = open_claim(module, c)
    as_(module, SPONSOR)
    c.publish_version(tid, event_type(title="Escape of water, revised", benefit_wei=str(3 * GEN)))
    assert etype(c, tid)["version"] == 2 and etype(c, tid)["benefit_wei"] == str(3 * GEN)
    assert claim(c, cid)["type_version"] == 1 and claim(c, cid)["benefit_wei"] == str(BENEFIT)
    out = file(module, c, tid, who=STRANGER)
    assert claim(c, out["claim_id"])["type_version"] == 2
    assert claim(c, out["claim_id"])["benefit_wei"] == str(3 * GEN)
    assert json.loads(c.get_type_version(tid, 1))["benefit_wei"] == str(BENEFIT)


def test_a_version_keeps_its_category_and_kind(module, c):
    tid = create_type(module, c)
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="keeps the category and event kind"):
        c.publish_version(tid, event_type(event_kind="FIRE_DAMAGE"))
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the event type's sponsor"):
        c.publish_version(tid, event_type())


def test_versions_are_capped(module, c):
    tid = create_type(module, c)
    as_(module, SPONSOR)
    for _ in range(7):
        c.publish_version(tid, event_type())
    with pytest.raises(err(module), match="at most 8 versions"):
        c.publish_version(tid, event_type())


def test_pause_stops_new_claims_and_resume_reopens(module, c):
    tid = create_type(module, c)
    as_(module, SPONSOR)
    c.set_type_state(tid, "PAUSED")
    with pytest.raises(err(module), match="already paused"):
        c.set_type_state(tid, "PAUSED")
    with pytest.raises(err(module), match="active or paused"):
        c.set_type_state(tid, "CLOSED")
    out = file(module, c, tid)
    assert out["refused"] and "paused" in out["reason"] and owed(c, CLAIMANT) == BOND
    as_(module, SPONSOR)
    c.set_type_state(tid, "ACTIVE")
    assert file(module, c, tid)["refused"] is False


def test_only_free_reserve_is_withdrawn(module, c):
    tid, cid = open_claim(module, c, type_over={"reserve": 3 * GEN})
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="only uncommitted reserve"):
        c.withdraw_reserve(tid, str(2 * GEN))
    c.withdraw_reserve(tid, str(GEN))
    t = etype(c, tid)
    assert t["reserve_wei"] == str(2 * GEN) and t["withdrawn_wei"] == str(GEN) and t["free_wei"] == "0"
    assert owed(c, SPONSOR) == GEN
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the event type's sponsor"):
        c.withdraw_reserve(tid, "1")


def test_only_a_named_assessor_accepts_once(module, c):
    tid = create_type(module, c, assessors=[ASSESSOR], accept=False)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="names as an assessor"):
        c.accept_assessor_role(tid)
    as_(module, ASSESSOR)
    c.accept_assessor_role(tid)
    with pytest.raises(err(module), match="already accepted"):
        c.accept_assessor_role(tid)
    assert etype(c, tid)["accepted_assessors"] == [ASSESSOR]


def test_withdraw_pulls_credit_to_the_caller_only(module, c):
    _create(module, c, title="x")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="nothing is owed"):
        c.withdraw()
    as_(module, SPONSOR)
    c.withdraw()
    assert transfers() == [{"to": SPONSOR, "wei": 5 * GEN}]
    assert json.loads(c.get_credit(SPONSOR)) == {"owed": "0", "paid": str(5 * GEN)}
    with pytest.raises(err(module), match="nothing is owed"):
        c.withdraw()


def test_two_sponsors_keep_separate_reserves(module, c):
    a = create_type(module, c)
    b = create_type(module, c, sponsor=SPONSOR2, reserve=3 * GEN)
    assert etype(c, a)["reserve_wei"] == str(10 * GEN) and etype(c, b)["reserve_wei"] == str(3 * GEN)
    as_(module, SPONSOR2)
    with pytest.raises(err(module), match="sponsor"):
        c.withdraw_reserve(a, "1")
    assert json.loads(c.list_event_types(0, 10))["total"] == 2
