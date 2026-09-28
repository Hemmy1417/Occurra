"""The claimant's side: filing a claim with its bond, filing evidence, and the
two exits before an assessment."""
import json

import pytest
from conftest import (
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
    document,
    err,
    etype,
    exif_jpeg,
    file,
    jfif,
    open_claim,
    owed,
    photo,
    png,
    set_now,
    standard_file,
)


def test_a_claim_commits_the_benefit_and_holds_the_bond(module, c):
    tid, cid = open_claim(module, c)
    k = claim(c, cid)
    assert cid == "cl-00001" and k["state"] == "OPEN" and k["claimant"] == CLAIMANT
    assert k["bond_wei"] == str(BOND) and k["benefit_wei"] == str(BENEFIT) and k["type_version"] == 1
    assert k["evidence_ends"] == "2026-10-04T09:00:00Z"
    t = etype(c, tid)
    assert t["committed_wei"] == str(BENEFIT) and t["open_claims"] == 1 and t["claim_count"] == 1
    assert json.loads(c.claims_of(CLAIMANT, 0, 10))["claims"][0]["claim_id"] == cid
    assert json.loads(c.list_claims(tid, 0, 10))["total"] == 1


def test_two_claims_never_share_one_benefit(module, c):
    tid = create_type(module, c, reserve=3 * GEN)
    assert file(module, c, tid)["refused"] is False
    out = file(module, c, tid, who=CLAIMANT2)
    assert out["refused"] and "cannot cover" in out["reason"] and owed(c, CLAIMANT2) == BOND
    assert etype(c, tid)["open_claims"] == 1


@pytest.mark.parametrize("who,words", [(SPONSOR, "sponsor cannot claim"), (ASSESSOR, "assessor of this event type")])
def test_interested_parties_cannot_claim(module, c, who, words):
    tid = create_type(module, c, assessors=[ASSESSOR])
    out = file(module, c, tid, who=who)
    assert out["refused"] and words in out["reason"] and owed(c, who) == BOND


@pytest.mark.parametrize("bond", [0, BOND - 1, BOND + 1])
def test_the_bond_is_exact(module, c, bond):
    tid = create_type(module, c)
    out = file(module, c, tid, bond=bond)
    assert out["refused"] and "exactly" in out["reason"] and owed(c, CLAIMANT) == bond
    assert c.counters["claim"] == "0"


@pytest.mark.parametrize("over,words", [
    ({"subject": "x"}, "name the subject"),
    ({"subject_ref": ""}, "name the subject"),
    ({"declared_cause": ""}, "declared cause"),
    ({"account": "too short"}, "declared cause and an account"),
    ({"event_date": "18/09/2026"}, "YYYY-MM-DD"),
    ({"event_date": "2026-09-21"}, "in the future"),
    ({"event_date": "2026-08-20"}, "within 30 days"),
    ({"assessor": "0x12"}, "wallet address"),
    ({"assessor": ASSESSOR2}, "has accepted the role"),
])
def test_claim_fields_are_checked_in_code(module, c, over, words):
    tid = create_type(module, c, assessors=[ASSESSOR])
    out = file(module, c, tid, **over)
    assert out["refused"] and words in out["reason"], out
    assert owed(c, CLAIMANT) == BOND and etype(c, tid)["committed_wei"] == "0"


def test_the_filing_window_edge(module, c):
    tid = create_type(module, c)
    assert file(module, c, tid, event_date="2026-08-21")["refused"] is False
    assert file(module, c, tid, who=CLAIMANT2, event_date="2026-08-20")["refused"] is True


def test_claim_json_must_be_an_object(module, c):
    tid = create_type(module, c)
    as_(module, CLAIMANT, BOND)
    assert "must be JSON" in json.loads(c.file_claim(tid, "{"))["reason"]
    as_(module, CLAIMANT, BOND)
    assert "JSON object" in json.loads(c.file_claim(tid, "[]"))["reason"]
    assert owed(c, CLAIMANT) == 2 * BOND


def test_a_nominated_assessor_must_have_accepted(module, c):
    tid = create_type(module, c, assessors=[ASSESSOR], accept=False)
    out = file(module, c, tid, assessor=ASSESSOR)
    assert out["refused"] and "accepted the role" in out["reason"]
    as_(module, ASSESSOR)
    c.accept_assessor_role(tid)
    out = file(module, c, tid, assessor=ASSESSOR.lower())
    assert out["refused"] is False and claim(c, out["claim_id"])["assessor"] == ASSESSOR
    assert json.loads(c.claims_of(ASSESSOR, 0, 10))["total"] == 1


def test_a_required_assessor_must_be_nominated(module, c):
    tid = create_type(module, c, assessors=[ASSESSOR], assessor_required=True)
    out = file(module, c, tid)
    assert out["refused"] and "requires an accepted independent assessor" in out["reason"]
    assert file(module, c, tid, assessor=ASSESSOR)["refused"] is False


# ── evidence ─────────────────────────────────────────────────────────────────

def test_evidence_is_stored_hashed_and_labelled(module, c):
    tid, cid = open_claim(module, c)
    raw = jfif(b"scene")
    eid = photo(module, c, cid, data=raw)
    it = json.loads(c.get_evidence(eid))
    assert it["role"] == "CLAIMANT" and it["view"] == "SCENE" and it["submitter"] == CLAIMANT
    assert it["bytes"] == len(raw) and it["during_appeal"] is False
    assert c.get_evidence_image(eid) == raw
    did = document(module, c, cid)
    assert json.loads(c.get_evidence(did))["doc_type"] == "REPAIR_ESTIMATE"
    assert "compression fitting" in c.get_evidence_text(did)
    with pytest.raises(err(module), match="not an image"):
        c.get_evidence_image(did)
    with pytest.raises(err(module), match="not a document"):
        c.get_evidence_text(eid)
    assert [e["evidence_id"] for e in claim(c, cid)["evidence"]] == [eid, did]


@pytest.mark.parametrize("who", [STRANGER, SPONSOR, ASSESSOR2])
def test_only_the_claim_parties_file(module, c, who):
    tid, cid = open_claim(module, c)
    with pytest.raises(err(module), match="only the claimant"):
        photo(module, c, cid, who=who)


def test_image_rules(module, c):
    tid, cid = open_claim(module, c)
    as_(module, CLAIMANT)
    with pytest.raises(err(module), match="say which view"):
        c.submit_image(cid, json.dumps({"view": "SELFIE"}), jfif())
    with pytest.raises(err(module), match="empty"):
        c.submit_image(cid, json.dumps({"view": "SCENE"}), b"")
    with pytest.raises(err(module), match="PNG and JFIF"):
        c.submit_image(cid, json.dumps({"view": "SCENE"}), exif_jpeg())
    with pytest.raises(err(module), match="at most 400,000 bytes"):
        c.submit_image(cid, json.dumps({"view": "SCENE"}), jfif(size=400_001))
    with pytest.raises(err(module), match="must be JSON"):
        c.submit_image(cid, "{", jfif())
    assert json.loads(c.submit_image(cid, json.dumps({"view": "SCENE"}), jfif(size=400_000)))["evidence_id"]
    assert photo(module, c, cid, data=png(b"p"))


def test_the_same_bytes_count_once(module, c):
    tid, cid = open_claim(module, c)
    raw = jfif(b"same")
    eid = photo(module, c, cid, data=raw)
    with pytest.raises(err(module), match=f"already on file as {eid}"):
        photo(module, c, cid, view="DAMAGE_DETAIL", data=raw)
    document(module, c, cid, text="Same words")
    with pytest.raises(err(module), match="already on file"):
        document(module, c, cid, doc_type="INCIDENT_REPORT", text="Same words")


def test_quotas_per_role(module, c):
    tid, cid = open_claim(module, c)
    for _ in range(6):
        photo(module, c, cid)
    with pytest.raises(err(module), match="all the photographs"):
        photo(module, c, cid)
    for i in range(4):
        document(module, c, cid, text=f"Note {i}")
    with pytest.raises(err(module), match="all the documents"):
        document(module, c, cid, text="One more")


def test_document_rules(module, c):
    tid, cid = open_claim(module, c, type_over={"assessors": [ASSESSOR]}, assessor=ASSESSOR)
    with pytest.raises(err(module), match="not recognised"):
        document(module, c, cid, doc_type="POEM")
    with pytest.raises(err(module), match="only the claim's accepted assessor"):
        document(module, c, cid, doc_type="ASSESSOR_REPORT")
    with pytest.raises(err(module), match="empty"):
        document(module, c, cid, text="   ")
    with pytest.raises(err(module), match="at most 6,000 characters"):
        document(module, c, cid, text="x" * 6001)
    assert document(module, c, cid, text="x" * 6000)
    eid = document(module, c, cid, who=ASSESSOR, doc_type="ASSESSOR_REPORT", text="Inspected on site.")
    assert json.loads(c.get_evidence(eid))["role"] == "ASSESSOR"


def test_evidence_closes_with_the_evidence_period(module, c):
    tid, cid = open_claim(module, c)
    set_now("2026-10-04T09:00:00Z")
    assert photo(module, c, cid)
    set_now("2026-10-04T09:00:01Z")
    with pytest.raises(err(module), match="evidence period has ended"):
        photo(module, c, cid)


def test_no_evidence_after_the_determination(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    assess(module, c, cid)
    with pytest.raises(err(module), match="while the claim is open or during an appeal"):
        photo(module, c, cid)


# ── the exits before an assessment ───────────────────────────────────────────

def test_the_claimant_withdraws_before_assessment(module, c):
    tid, cid = open_claim(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the claimant withdraws"):
        c.withdraw_claim(cid)
    as_(module, CLAIMANT)
    c.withdraw_claim(cid)
    assert claim(c, cid)["state"] == "WITHDRAWN" and owed(c, CLAIMANT) == BOND
    t = etype(c, tid)
    assert t["committed_wei"] == "0" and t["open_claims"] == 0 and t["reserve_wei"] == str(10 * GEN)
    with pytest.raises(err(module), match="only before its assessment"):
        c.withdraw_claim(cid)


def test_a_claim_is_withdrawn_up_to_its_evidence_deadline(module, c):
    tid, cid = open_claim(module, c)
    set_now("2026-10-04T09:00:00Z")
    as_(module, CLAIMANT)
    c.withdraw_claim(cid)
    assert owed(c, CLAIMANT) == BOND and claim(c, cid)["bond_to"] == "CLAIMANT"


def test_a_wallet_holds_at_most_three_open_claims_per_type(module, c):
    tid = create_type(module, c, reserve=20 * GEN)
    cids = [file(module, c, tid)["claim_id"] for _ in range(3)]
    out = file(module, c, tid)
    assert out["refused"] and "at most 3 open claims" in out["reason"] and owed(c, CLAIMANT) == BOND
    assert file(module, c, tid, who=CLAIMANT2)["refused"] is False
    as_(module, CLAIMANT)
    c.withdraw_claim(cids[0])
    assert file(module, c, tid)["refused"] is False
    other = create_type(module, c)
    assert file(module, c, other)["refused"] is False


def test_an_unassessed_claim_lapses_after_its_evidence_period(module, c):
    tid, cid = open_claim(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="has not ended"):
        c.close_claim(cid)
    set_now("2026-10-04T09:00:01Z")
    c.close_claim(cid)
    k = claim(c, cid)
    assert k["state"] == "CLOSED" and k["close_reason"] == "lapsed unassessed" and k["bond_to"] == "SPONSOR_RESERVE"
    t = etype(c, tid)
    assert owed(c, CLAIMANT) == 0 and t["committed_wei"] == "0" and t["open_claims"] == 0
    assert t["reserve_wei"] == str(10 * GEN + BOND) and t["forfeited_wei"] == str(BOND)
    with pytest.raises(err(module), match="finalized, not closed"):
        c.close_claim(cid)


def test_a_determined_claim_is_finalized_not_closed(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    assess(module, c, cid)
    set_now("2026-11-01T09:00:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="finalized, not closed"):
        c.close_claim(cid)
