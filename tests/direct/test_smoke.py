import json

from conftest import (
    BENEFIT,
    BOND,
    CLAIMANT,
    GEN,
    SPONSOR,
    as_,
    assess,
    etype,
    open_claim,
    owed,
    receipt,
    set_now,
    standard_file,
)


def test_the_flagship_path(module, c):
    tid, cid = open_claim(module, c)
    standard_file(module, c, cid)
    out = assess(module, c, cid)
    assert out["determination"] == "ESTABLISHED", out
    set_now("2026-09-20T10:30:00Z")
    as_(module, SPONSOR)
    fin = json.loads(c.finalize(cid))
    assert fin["paid_wei"] == str(BENEFIT)
    assert owed(c, CLAIMANT) == BENEFIT + BOND
    assert receipt(c, cid)["final"] is True
    t = etype(c, tid)
    assert int(t["reserve_wei"]) == 10 * GEN - BENEFIT and t["committed_wei"] == "0"
