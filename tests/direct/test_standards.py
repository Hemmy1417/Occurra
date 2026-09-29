"""The review standards this build answers, one test each, named by the
standard. Where a standard is covered in depth elsewhere the test here is the
sharpest single case of it."""
import json

import pytest
from conftest import (rejudge, 
    ASSESSOR,
    ASSESSOR2,
    BENEFIT,
    BOND,
    CLAIMANT,
    CLAIMANT2,
    GEN,
    SPONSOR,
    STRANGER,
    as_,
    assess,
    claim,
    create_type,
    determination,
    document,
    err,
    etype,
    event_type,
    file,
    jfif,
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
)


def _decided(module, c, **kw):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    assess(module, c, cid, **kw)
    return tid, cid


def test_s5_an_outage_is_never_written_as_a_finding(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    llm(look=seen(2), judge=RuntimeError("model unavailable"))
    as_(module, CLAIMANT)
    with pytest.raises(RuntimeError, match="model unavailable"):
        c.request_assessment(cid)
    assert claim(c, cid)["state"] == "OPEN" and c.counters["determination"] == "0"


def test_s7_the_money_follows_only_what_every_validator_reproduced(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(C1="NOT_SATISFIED")),
                        v_judge=judgment(ratings(C1="NOT_SATISFIED", C2="NOT_ESTABLISHED")))
    d = determination(c, claim(c, cid)["determination_id"])
    assert d["bound"]["determination"] is True and d["bound"]["requirements"] == ["C1"]


def test_s10_views_are_paged_and_capped(module, c):
    tid = create_type(module, c, reserve=200 * GEN)
    for who in (CLAIMANT, CLAIMANT2, STRANGER):
        for _ in range(3):
            file(module, c, tid, who=who)
    assert len(json.loads(c.list_all_claims(0, 1000))["claims"]) == 9
    page = json.loads(c.list_claims(tid, 2, 3))
    assert page["total"] == 9 and [k["claim_id"] for k in page["claims"]] == ["cl-00007", "cl-00006", "cl-00005"]
    assert json.loads(c.list_claims(tid, 50, 10))["claims"] == []


def test_s13_every_window_is_wall_clock(module, c):
    tid, cid = _decided(module, c)
    as_(module, STRANGER)
    for _ in range(5):
        with pytest.raises(err(module), match="still open"):
            c.finalize(cid)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(cid)


def test_s14_s28_a_readjudication_reads_the_stored_bytes(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    before = [e["content_hash"] for e in json.loads(c.get_snapshot("snap-000001"))["evidence"]]
    as_(module, CLAIMANT)
    c.open_appeal(cid, "A clearer photograph follows here.")
    new = photo(module, c, cid, view="DAMAGE_DETAIL", description="A clearer photograph")
    llm(look=seen(2), judge=judgment(ratings()))
    rejudge(module, c, cid)
    after = {e["evidence_id"]: e["content_hash"] for e in json.loads(c.get_snapshot("snap-000002"))["evidence"]}
    assert [after[e["evidence_id"]] for e in json.loads(c.get_snapshot("snap-000001"))["evidence"]] == before
    assert new in after


def test_s17_s26_every_open_state_has_an_exit_anyone_can_take(module, c):
    tid, a = open_claim(module, c)
    b = file(module, c, tid, who=CLAIMANT2)["claim_id"]
    photo(module, c, b, who=CLAIMANT2, view="SCENE")
    photo(module, c, b, who=CLAIMANT2, view="DAMAGE_DETAIL")
    assess(module, c, b, who=CLAIMANT2, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT2)
    c.open_appeal(b, "Grounds for appeal here.")
    set_now("2026-10-30T09:00:00Z")
    as_(module, STRANGER)
    c.close_claim(a)
    c.close_claim(b)
    assert claim(c, a)["state"] == "CLOSED" and claim(c, b)["state"] == "FINAL"
    t = etype(c, tid)
    assert t["open_claims"] == 0 and t["committed_wei"] == "0"


def test_s18_s25_a_claim_binds_its_version_and_its_assessor(module, c):
    tid, cid = open_claim(module, c, type_over={"assessors": [ASSESSOR]}, assessor=ASSESSOR)
    as_(module, SPONSOR)
    c.publish_version(tid, event_type(assessors=[ASSESSOR2], criteria=["A different single criterion here"],
                                      evidence_requirements=[{"type": "BEFORE_PHOTO", "min_count": 2}]))
    standard_file(module, c, cid)
    rep = document(module, c, cid, who=ASSESSOR, doc_type="ASSESSOR_REPORT", text="On site; confirmed.")
    out = assess(module, c, cid, judge=judgment(ratings(), basis={"C1": [rep], "C2": [rep]}))
    assert out["determination"] == "ESTABLISHED"
    d = determination(c, out["determination_id"])
    assert d["type_version"] == 1 and [r["id"] for r in d["requirements"]] == ["C1", "C2", "S1", "S2", "S3"]


def test_s23_the_benefit_is_reserved_at_filing(module, c):
    tid = create_type(module, c, reserve=2 * GEN)
    assert file(module, c, tid)["refused"] is False
    assert etype(c, tid)["free_wei"] == "0"
    assert file(module, c, tid, who=CLAIMANT2)["refused"] is True
    as_(module, SPONSOR)
    with pytest.raises(err(module), match="only uncommitted reserve"):
        c.withdraw_reserve(tid, "1")


def test_s24_finalization_settles_everything_in_one_write(module, c):
    tid, cid = _decided(module, c)
    set_now("2026-09-20T10:00:01Z")
    as_(module, STRANGER)
    c.finalize(cid)
    k, t = claim(c, cid), etype(c, tid)
    assert k["state"] == "FINAL" and t["committed_wei"] == "0" and t["open_claims"] == 0
    assert owed(c, CLAIMANT) == BENEFIT + BOND and receipt(c, cid)["final"] is True


def test_s30_nothing_happens_to_a_terminal_claim(module, c):
    tid, cid = _decided(module, c)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(cid)
    frozen = c.get_claim(cid)
    for who, act in ((SPONSOR, lambda: c.open_appeal(cid, "Too late for this")), (CLAIMANT, lambda: c.finalize(cid)),
                     (CLAIMANT, lambda: c.readjudicate(cid)), (CLAIMANT, lambda: c.withdraw_claim(cid)),
                     (STRANGER, lambda: c.close_claim(cid)), (CLAIMANT, lambda: c.request_assessment(cid)),
                     (CLAIMANT, lambda: c.submit_image(cid, json.dumps({"view": "SCENE"}), jfif(b"late")))):
        as_(module, who)
        with pytest.raises(err(module)):
            act()
    assert c.get_claim(cid) == frozen
    as_(module, CLAIMANT)
    c.withdraw()
    with pytest.raises(err(module), match="nothing is owed"):
        c.withdraw()


def test_s30_two_claims_race_one_benefit(module, c):
    tid = create_type(module, c, reserve=3 * GEN)
    first = file(module, c, tid)
    second = file(module, c, tid, who=CLAIMANT2)
    assert first["refused"] is False and second["refused"] is True
    as_(module, CLAIMANT)
    c.withdraw_claim(first["claim_id"])
    assert file(module, c, tid, who=CLAIMANT2)["refused"] is False


def test_s31_labels_are_claims_and_a_mislabel_counts_against_the_filer(module, c):
    tid, cid = _decided(module, c)
    from conftest import prompts
    judge = prompts("judge", "leader")[0]["prompt"]
    assert "The labels on evidence" in judge and "counts against the filer's claim, never for it" in judge
    assert "The claimant's account and every description attached to evidence are claims" in judge


def test_s34_s42_no_adverse_finding_rests_on_the_payers_photographs_alone(module, c):
    tid, cid = _decided(module, c)
    as_(module, SPONSOR)
    c.open_appeal(cid, "The damage predates the claimed date.")
    s1 = photo(module, c, cid, who=SPONSOR, view="BEFORE", description="Our survey photo")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(S2="NOT_SATISFIED", C1="NOT_SATISFIED"),
                                                 basis={"S2": [s1], "C1": [s1]}))
    as_(module, SPONSOR)
    assert rejudge(module, c, cid)["determination"] == "UNDETERMINED"


def test_s35_the_assessor_is_independent_of_both_parties(module, c):
    as_(module, SPONSOR, GEN)
    assert json.loads(c.create_event_type(event_type(assessors=[SPONSOR])))["refused"] is True
    tid = create_type(module, c, assessors=[ASSESSOR])
    assert file(module, c, tid, who=ASSESSOR)["refused"] is True


def test_s36_the_snapshot_names_what_was_new_on_appeal(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(C1="NOT_ESTABLISHED")))
    as_(module, CLAIMANT)
    c.open_appeal(cid, "A clearer photograph follows here.")
    new = photo(module, c, cid, view="DAMAGE_DETAIL")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings()))
    as_(module, CLAIMANT)
    rejudge(module, c, cid)
    snap = json.loads(c.get_snapshot("snap-000002"))
    assert {e["evidence_id"]: e["new_on_appeal"] for e in snap["evidence"]} == \
        {"ev-000001": False, "ev-000002": False, new: True}


def test_s39_evidence_is_hashed_by_the_contract_where_it_enters(module, c):
    import hashlib
    tid, cid = open_claim(module, c)
    raw = jfif(b"entered")
    eid = photo(module, c, cid, data=raw)
    assert json.loads(c.get_evidence(eid))["content_hash"] == hashlib.sha256(raw).hexdigest()


def test_s41_s43_accounts_are_the_signer_in_checksum_form(module, c):
    tid, cid = open_claim(module, c)
    k = claim(c, cid)
    assert k["claimant"] == CLAIMANT and k["sponsor"] == SPONSOR
    assert json.loads(c.claims_of(CLAIMANT.lower(), 0, 5))["total"] == 1
    assert json.loads(c.get_credit(CLAIMANT.lower())) == json.loads(c.get_credit(CLAIMANT))
    eid = photo(module, c, cid)
    assert json.loads(c.get_evidence(eid))["submitter"] == CLAIMANT


def test_s44_the_conflict_flag_is_recorded_with_its_note(module, c):
    tid, cid = _decided(module, c, judge=judgment(ratings(), conflicts=True,
                                                   note="ev-000001 shows a tiled floor, ev-000002 carpet"))
    d = determination(c, claim(c, cid)["determination_id"])
    assert d["conflicts_detected"] is True and d["determination"] == "UNDETERMINED"
    assert d["notes"]["conflict_note"] == "ev-000001 shows a tiled floor, ev-000002 carpet"
