"""The domain half of the harness: the flagship event type, a claim under it,
and the model answers an adjudication reads."""
import json

GEN = 10**18
BENEFIT = 2 * GEN
BOND = GEN // 10
EVENT_DATE = "2026-09-18"

CRITERIA = [
    "The photographs show water damage to interior surfaces: staining, swelling, or standing water.",
    "The water came from an internal pipe, fitting or appliance, not from rain or flooding outside.",
]


def event_type(**over):
    t = {
        "title": "Escape of water from internal plumbing",
        "category": "PROPERTY",
        "event_kind": "WATER_DAMAGE",
        "definition": "Sudden damage to the insured home caused by water escaping from a fixed internal "
                      "pipe, fitting, tank or appliance.",
        "exclusions": "Gradual leaks, damp, condensation, and water entering from outside the building.",
        "criteria": CRITERIA,
        "evidence_requirements": [{"type": "SCENE_PHOTO", "min_count": 1},
                                  {"type": "DAMAGE_PHOTO", "min_count": 1}],
        "benefit_wei": str(BENEFIT),
        "bond_wei": str(BOND),
        "filing_window_days": 30,
        "evidence_days": 14,
        "appeal_window_seconds": 3600,
        "evidence_period_seconds": 3600,
        "max_appeals": 1,
        "assessors": [],
        "assessor_required": False,
    }
    t.update(over)
    return json.dumps(t)


def claim_json(**over):
    c = {
        "subject": "Ground-floor kitchen of 14 Alder Row",
        "subject_ref": "Policy HOME-2291",
        "location": "14 Alder Row, Leeds",
        "event_date": EVENT_DATE,
        "declared_cause": "A compression fitting under the kitchen sink split overnight",
        "account": "I came down in the morning to water across the kitchen floor. The fitting under the "
                   "sink had split; I shut off the stopcock and called a plumber.",
        "assessor": "",
    }
    c.update(over)
    return json.dumps(c)


# ── model answers ────────────────────────────────────────────────────────────

def seen(n=2, shows="A kitchen floor with standing water under an open sink cabinet; the cabinet base is "
                    "swollen.", seen_flag=True, doubts="", text=None):
    return {"images": [{"n": i + 1, "seen": seen_flag, "shows": shows if seen_flag else "",
                        "text": text if text is not None else [], "subject_doubts": doubts, "change": ""}
                       for i in range(n)]}


def judgment(ratings, basis=None, sufficient=True, conflicts=False, note=None):
    """A model's answer. A conflict names two pieces of evidence, as the
    contract requires, unless a test passes its own note."""
    b = basis or {}
    if note is None:
        note = "ev-000001 and ev-000002 contradict each other" if conflicts else ""
    return {"reasoning": "Weighed the photographs and documents against each requirement.",
            "requirements": [{"id": k, "status": v, "basis": b.get(k, ["*"]), "note": ""}
                             for k, v in ratings.items()],
            "evidence_sufficient": sufficient, "conflicts_detected": conflicts, "conflict_note": note}


def all_ids(criteria=("C1", "C2")):
    return list(criteria) + ["S1", "S2", "S3"]


def ratings(status="SATISFIED", **over):
    r = {i: status for i in all_ids()}
    r.update(over)
    return r
