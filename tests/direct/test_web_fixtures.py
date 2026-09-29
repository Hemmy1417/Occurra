"""The app's rule tests (web/tests/acts.test.ts) run on records this contract
actually wrote. This walk drives the real contract through every state a
page must handle and compares what the views return with the committed
fixtures, so a change to any record's shape fails here until the fixtures
are regenerated, and the app's tests are rerun against the new shape.

Regenerate:  OCCURRA_WRITE_FIXTURES=1 python -m pytest tests/direct/test_web_fixtures.py
"""
import json
import os
import pathlib

from conftest import (ASSESSOR, CLAIMANT, SPONSOR, STRANGER, as_, assess, document, jfif, judgment, open_claim,
                      photo, ratings, rejudge, set_now)


def standard_file(module, c, cid):
    """The two photographs the flagship type requires, as fixed bytes, so the
    recorded digests are the same whatever ran before."""
    photo(module, c, cid, view="SCENE", data=jfif(f"scene {cid}".encode()))
    photo(module, c, cid, view="DAMAGE_DETAIL", description="Swollen cabinet base, tide mark",
          data=jfif(f"detail {cid}".encode()))

OUT = pathlib.Path(__file__).resolve().parents[2] / "web" / "tests" / "fixtures" / "states.json"


def _walk(module, c):
    states = {}

    def snap(name, cid, extra=None):
        k = json.loads(c.get_claim(cid))
        d = json.loads(c.get_determination(k["determination_id"])) if k["determination_id"] else None
        v = json.loads(c.get_type_version(k["type_id"], k["type_version"]))
        t = json.loads(c.get_event_type(k["type_id"]))
        states[name] = {"claim": k, "determination": d, "version": v, "type": t, **(extra or {})}

    tid, a = open_claim(module, c, type_over={"assessors": [ASSESSOR], "reserve": 20 * 10**18})
    snap("open_empty", a)
    standard_file(module, c, a)
    snap("open_ready", a)
    set_now("2026-10-04T09:00:01Z")
    snap("open_lapsed", a)
    set_now("2026-09-20T09:00:00Z")

    assess(module, c, a)
    snap("determined_established", a)
    as_(module, SPONSOR)
    c.open_appeal(a, "The fitting in these photographs is outside, not under the sink.")
    photo(module, c, a, who=SPONSOR, view="SCENE", description="The garden tap", data=jfif(b"sponsor scene"))
    snap("appeal_by_sponsor", a)

    as_(module, CLAIMANT, 10**17)
    b = json.loads(c.file_claim(tid, json.dumps({
        "subject": "Ground-floor kitchen of 14 Alder Row", "subject_ref": "Policy HOME-2291",
        "event_date": "2026-09-18", "declared_cause": "A split fitting", "assessor": ASSESSOR,
        "account": "Water across the kitchen floor in the morning."})))["claim_id"]
    standard_file(module, c, b)
    document(module, c, b, who=ASSESSOR, doc_type="ASSESSOR_REPORT", text="Seen on site.")
    assess(module, c, b, judge=judgment(ratings(C1="NOT_ESTABLISHED")), basis="ev-000004")
    snap("determined_undetermined_assessed", b)
    as_(module, CLAIMANT)
    c.open_appeal(b, "A clearer photograph of the damage follows.")
    snap("appeal_by_claimant", b)
    photo(module, c, b, view="DAMAGE_DETAIL", description="A clearer photograph", data=jfif(b"appeal detail"))
    snap("appeal_by_claimant_with_evidence", b)
    rejudge(module, c, b)
    snap("readjudicated_no_appeals_left", b)
    c.finalize(b)
    snap("final", b)

    set_now("2026-09-20T12:00:00Z")
    tid2, w = open_claim(module, c, who=STRANGER)
    as_(module, STRANGER)
    c.withdraw_claim(w)
    snap("withdrawn", w)
    states["now"] = "2026-09-20T12:00:00Z"
    states["addresses"] = {"SPONSOR": SPONSOR, "CLAIMANT": CLAIMANT, "ASSESSOR": ASSESSOR, "STRANGER": STRANGER}
    return states


def test_the_app_fixtures_are_what_the_contract_writes(module, c):
    states = json.loads(json.dumps(_walk(module, c)))
    if os.environ.get("OCCURRA_WRITE_FIXTURES") == "1":
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(states, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    assert OUT.exists(), "web/tests/fixtures/states.json is missing; regenerate it (see this file's docstring)"
    assert json.loads(OUT.read_text(encoding="utf-8")) == states, \
        "the contract's records changed shape; regenerate the fixtures and rerun the app's tests"
