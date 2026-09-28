"""Invariants checked after every act of a randomized walk: value conserved to
the wei, commitments matching open claims, counters matching states, versions,
determinations, snapshots and evidence immutable once written, and no benefit
paid without a final established determination."""
import json
import random

from conftest import (
    ASSESSOR,
    CLAIMANT,
    CLAIMANT2,
    GEN,
    SPONSOR,
    SPONSOR2,
    STRANGER,
    as_,
    claim_json,
    event_type,
    jfif,
    judgment,
    llm,
    seen,
    set_now,
    transfers,
)

ACTORS = (SPONSOR, SPONSOR2, CLAIMANT, CLAIMANT2, ASSESSOR, STRANGER)
CLOCK = ["2026-09-20T09:00:00Z", "2026-09-20T09:40:00Z", "2026-09-20T10:30:00Z", "2026-09-21T09:00:00Z",
         "2026-09-24T12:00:00Z", "2026-10-05T09:00:00Z", "2026-10-09T09:00:00Z"]
OPEN = ("OPEN", "DETERMINED", "UNDER_APPEAL")
IDS = ["C1", "C2", "S1", "S2", "S3"]


class World:
    def __init__(self, module, c):
        self.module, self.c = module, c
        self.types, self.claims = [], []
        self.sent = 0
        self.frozen = {}
        self.states = set()
        self.outcomes = set()

    def freeze(self, key, value):
        assert self.frozen.setdefault(key, value) == value, f"{key} changed after it was fixed"

    def check(self):
        c = self.c
        reserves = held_bonds = 0
        paid_out = sum(t["wei"] for t in transfers())
        owed = sum(int(json.loads(c.get_credit(a))["owed"]) for a in ACTORS)
        claims = [json.loads(c.get_claim(cid)) for cid in self.claims]
        for tid in self.types:
            t = json.loads(c.get_event_type(tid))
            res, com = int(t["reserve_wei"]), int(t["committed_wei"])
            reserves += res
            assert 0 <= com <= res, f"{tid}: committed {com} over reserve {res}"
            assert int(t["funded_wei"]) + int(t["forfeited_wei"]) == res + int(t["paid_wei"]) + int(t["withdrawn_wei"])
            mine = [k for k in claims if k["type_id"] == tid]
            live = [k for k in mine if k["state"] in OPEN]
            assert com == sum(int(k["benefit_wei"]) for k in live), f"{tid} commitment drifted"
            assert t["open_claims"] == len(live) and t["claim_count"] == len(mine)
            assert int(t["paid_wei"]) == sum(int(k["final"]["paid_wei"]) for k in mine if k["final"])
            assert int(t["forfeited_wei"]) == sum(int(k["bond_wei"]) for k in mine
                                                  if k["bond_to"] == "SPONSOR_RESERVE")
            for who in (CLAIMANT, CLAIMANT2, SPONSOR):
                n = sum(1 for k in live if k["claimant"] == who)
                assert int(c.counters.get(f"open|{tid}|{who}") or "0") == n <= 3
            for v in range(1, t["version"] + 1):
                self.freeze(f"{tid}|v{v}", c.get_type_version(tid, v))
            for k in mine:
                self.states.add(k["state"])
                if k["state"] in OPEN:
                    held_bonds += int(k["bond_wei"])
                assert (k["bond_to"] is None) == (k["state"] in OPEN)
                if k["final"]:
                    self.outcomes.add(k["final"]["determination"])
                    d = json.loads(c.get_determination(k["final"]["determination_id"]))
                    assert d["lifecycle"] == "FINAL" and d["determination"] == k["final"]["determination"]
                    assert (int(k["final"]["paid_wei"]) > 0) == (d["determination"] == "ESTABLISHED")
                    self.freeze(k["claim_id"] + "|final", k["final"])
                for did in k["determinations"]:
                    d = json.loads(c.get_determination(did))
                    assert d["type_version"] == k["type_version"]
                    core = {x: d[x] for x in ("determination", "requirements", "snapshot_id", "appeal_of",
                                              "decided_at", "bound", "kind")}
                    self.freeze(did, core)
                    self.freeze(d["snapshot_id"], c.get_snapshot(d["snapshot_id"]))
                for it in k["evidence"]:
                    self.freeze(it["evidence_id"], it)
        assert reserves + held_bonds + owed + paid_out == self.sent, "value was created or destroyed"


def _landed(w, value):
    w.sent += value


def _act(w, rng):
    c, m = w.c, w.module
    roll = rng.randrange(20)
    if roll == 0 or not w.types:
        who = rng.choice((SPONSOR, SPONSOR2))
        value = rng.choice((0, 3 * GEN, 5 * GEN))
        as_(m, who, value)
        out = json.loads(c.create_event_type(event_type(assessors=[ASSESSOR], max_appeals=rng.choice((0, 1, 2)),
                                                        title=rng.choice(("Escape of water", "x")))))
        _landed(w, value)
        if not out["refused"]:
            w.types.append(out["type_id"])
            as_(m, ASSESSOR)
            c.accept_assessor_role(out["type_id"])
        return
    tid = rng.choice(w.types)
    t = json.loads(c.get_event_type(tid))
    if roll == 1:
        as_(m, rng.choice((t["sponsor"], STRANGER)), GEN)
        c.fund_reserve(tid)
        _landed(w, GEN)
        return
    if roll == 2:
        as_(m, t["sponsor"])
        c.withdraw_reserve(tid, str(rng.choice((GEN // 2, GEN, 4 * GEN))))
        return
    if roll == 3:
        as_(m, rng.choice(ACTORS))
        c.withdraw()
        return
    if roll == 4:
        as_(m, t["sponsor"])
        c.set_type_state(tid, rng.choice(("ACTIVE", "PAUSED")))
        return
    if roll in (5, 6) or not w.claims:
        who = rng.choice((CLAIMANT, CLAIMANT2, CLAIMANT, SPONSOR))
        bond = rng.choice((int(t["bond_wei"]), int(t["bond_wei"]), 1))
        as_(m, who, bond)
        out = json.loads(c.file_claim(tid, claim_json(assessor=rng.choice(("", "", ASSESSOR)),
                                                      event_date=rng.choice(("2026-09-18", "2026-09-19")))))
        _landed(w, bond)
        if not out["refused"]:
            w.claims.append(out["claim_id"])
        return
    cid = rng.choice(w.claims)
    k = json.loads(c.get_claim(cid))
    state = k["state"]
    views = [e.get("view") for e in k["evidence"] if e["kind"] == "IMAGE"]
    if state in ("OPEN", "UNDER_APPEAL") and roll in (7, 8, 9):
        who = k["claimant"]
        if state == "UNDER_APPEAL" and k["appeal"]["by"] == "SPONSOR" and rng.randrange(2):
            who = k["sponsor"]
        if k["assessor"] and rng.randrange(3) == 0:
            as_(m, k["assessor"])
            c.submit_document(cid, json.dumps({"doc_type": "ASSESSOR_REPORT"}), f"Seen {rng.random()}")
            return
        view = "SCENE" if "SCENE" not in views else rng.choice(("DAMAGE_DETAIL", "BEFORE", "SCENE"))
        as_(m, who)
        c.submit_image(cid, json.dumps({"view": view}), jfif(f"{view}{rng.random()}".encode()))
        return
    if state == "OPEN" and roll == 10:
        as_(m, k["claimant"])
        c.withdraw_claim(cid)
        return
    lapsed = state == "OPEN" and k["now"] > k["evidence_ends"] and rng.randrange(2)
    if (state in ("OPEN", "UNDER_APPEAL") and roll == 11) or lapsed:
        as_(m, STRANGER)
        c.close_claim(cid)
        return
    if state in ("OPEN", "UNDER_APPEAL"):
        rs = {i: rng.choice(["SATISFIED", "SATISFIED", "SATISFIED", "NOT_SATISFIED", "NOT_ESTABLISHED"])
              for i in IDS}
        if rng.randrange(2):
            rs = {i: "SATISFIED" for i in IDS}
        basis = [e["evidence_id"] for e in k["evidence"]]
        j = judgment(rs, basis={i: rng.sample(basis, min(len(basis), 2)) for i in IDS},
                     sufficient=rng.randrange(6) > 0, conflicts=rng.randrange(8) == 0)
        n = sum(1 for e in k["evidence"] if e["kind"] == "IMAGE")
        llm(look=seen(2), judge=j, v_judge=j if rng.randrange(5) else judgment({i: "NOT_ESTABLISHED" for i in IDS}))
        as_(m, k["claimant"] if state == "OPEN" or rng.randrange(2) else STRANGER)
        assert n >= 0
        c.request_assessment(cid) if state == "OPEN" else c.readjudicate(cid)
        return
    if state == "DETERMINED":
        d = json.loads(c.get_determination(k["determination_id"]))
        if rng.randrange(2):
            as_(m, k["sponsor"] if d["determination"] == "ESTABLISHED" else k["claimant"])
            c.open_appeal(cid, "These are the grounds of appeal.")
        else:
            as_(m, STRANGER)
            c.finalize(cid)


def _walk(module, c, seed, steps=220):
    rng = random.Random(seed)
    w = World(module, c)
    for step in range(steps):
        if step % 30 == 0:
            set_now(CLOCK[min(len(CLOCK) - 1, step // 32)])
        try:
            _act(w, rng)
        except module.gl.vm.UserError:
            pass
        w.check()
    return w


def test_invariants_hold_and_the_walks_reach_every_state_and_outcome(module, c):
    from conftest import _fresh_instance, _reset
    states, outcomes = set(), set()
    for seed in range(10):
        _reset()
        w = _walk(module, _fresh_instance(module), seed)
        states |= w.states
        outcomes |= w.outcomes
    assert states >= {"OPEN", "DETERMINED", "UNDER_APPEAL", "FINAL", "WITHDRAWN", "CLOSED"}, states
    assert outcomes == {"ESTABLISHED", "NOT_ESTABLISHED", "UNDETERMINED"}, outcomes
