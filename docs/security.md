# Security review

Two fresh readers audited the contract adversarially before the deployment of
record, each writing throwaway probes against the direct-mode harness. Every
finding below was reproduced, fixed in `contracts/occurra.py`, and pinned by a
test in `tests/direct/test_audit.py` (and, where a single line carries the
fix, by a mutant in `tests/mutation/mutate.py`). Nothing listed here reached a
deployment.

## First review

| | Finding | Fix |
|---|---|---|
| F1 | A leader could rate the documents check `NOT_ESTABLISHED` on a file where it cannot apply. Its raw answer then read as undetermined to the validators, while the record, after shaping, read as established, and paid. | Validators now apply the record's own rules (shape, grounding on the leader's cited basis and the photographs it saw, strict flags) to the leader's answer and must stand behind that result as well as the raw one (`_settle_result`). |
| F1b | The same gap through a conflict flag sent as `"yes"` or `1`: truthy to the validators, false on the record. | Covered by the same check; flags are read with `is True` on both sides. |
| F2 | A leader could strip its cited basis, so grounding recorded an undetermined result where every validator found the event established. | Covered by the same check: the settled result must be one the validator stands behind. |
| F3 | A photograph whose first four bytes read `\x89PNG` passed filing but no model could read it, so every readjudication failed; three days later the stale-appeal close paid the benefit. A claimant could defeat a sponsor's appeal this way. | Full signatures are checked at filing, and a photograph no node can see counts for nothing instead of blocking the round (see V2 and V3). |
| F4 | A photographed document counted as an observation of the scene, so a claimant could ground every rating on a picture of their own paperwork. | A `DOCUMENT_SCAN` image is kind `SCAN`: examined and read, never an observation, and never enough to pass the photograph gate. |
| F5 | The appellant could readjudicate in the same minute it filed, so the other side's right to answer was empty. | Readjudication opens to anyone only after the appeal's evidence period. |
| F6 | Party fields sat outside any fence in the judge prompt. | Every field a party wrote, and every piece of text read off a photograph, is fenced on its own. |
| F7 | A claimant could withdraw after the evidence deadline, dodging the lapse forfeit and holding a benefit committed for free. | Withdrawal is open only before the evidence deadline; a lapsed claim forfeits its bond. |

## Second review, of the fixed contract

| | Finding | Fix |
|---|---|---|
| V1 | One escape pass leaves `>>>` behind in `>>>>>>`, so party text could still close its fence. | The escape repeats until no run of three is left; look-alike brackets are folded and invisible characters dropped first. |
| V2 | A photograph with a valid header and a corrupt body makes the model gateway raise rather than report it unseen, so the round failed every time. | A gateway rejection for one prompt makes those photographs unseen for that node; it never fails the round. |
| V3 | Requiring every node to see exactly the same photographs let an image some models read and others do not block any round. | A validator refuses a leader only when the leader left out a photograph the validator saw, or listed anything but this claim's photographs. A validator that saw fewer judges from what it saw; every finding it agrees to must still be its own. |
| V4 | A validator that found the evidence insufficient still agreed to "not established", forfeiting a bond. | A rejection needs the validator to find the evidence enough to decide. |
| V5 | `"seen": "false"` read as seen. | `seen` must be literally `true`. |
| V6 | A round in which only a photographed document was seen still recorded a result. | Leader and validator must each have seen a photograph of the scene. |
| V7 | Opposing parties' photographs shared one examination prompt, and the prompt did not say that text in an image is not an instruction. | A party's photographs are examined only beside its own, and the prompt says so. |

## Found by the live proofs

The proof runs are part of the review: they assert what each claim should
come to. Two claims came out wrong, and one outcome was allowed but should not
have been. Each finding meant a new deployment, and both runs were repeated
from the start on it. The
superseded deployments are listed in `docs/proofs/README.md`.

| | Finding | Fix |
|---|---|---|
| L1 | A claim filed with a photograph of a different car failed every requirement, but the leading model also called the photograph against the claimant's account a conflict, and the conflict turned a clear rejection into undetermined. With one photograph there is nothing for it to conflict with. | A conflict counts only when its note names two pieces of evidence on this claim, checked in code on every node and on the record (`_conflict_named`); the prompt says a photograph that contradicts the account is a failed requirement, not a conflict. |
| L2 | On the next deployment the same claim failed the subject check, and in the same answer the model called the evidence insufficient, so the claim was again undetermined. Insufficiency must gate every conclusive outcome (standard S22), so the rule stays. | The prompt now says what sufficient means: evidence that establishes a requirement is not met decides it. A rejection still needs every validator to find the evidence sufficient. |
| L3 | A sponsor appealed an established claim with no new evidence, only the argument that the leak was slow; a fresh panel reversed it on the same photographs. A readjudication judges afresh, so an appeal on argument alone let a second reading overturn the first. | An appeal is judged again only if the appellant files new evidence during it; otherwise anyone closes it as soon as the evidence period ends and the appealed determination stands (`_brought`). |

## What the design accepts

- A claim holds its benefit committed from filing, so a claimant can hold a
  reserve for up to the evidence period and withdraw for the bond before the
  deadline. The sponsor bounds this with the bond, the evidence period, and the
  cap of three open claims per wallet per event type.
- Doubt stands: a leader that reports undetermined where a validator would
  find the event not established is followed. Undetermined pays no benefit and
  returns a bond.
- The sponsor names the assessors and the claimant chooses among those who
  accepted; an assessor's observation counts as independent of both.
- Validators read photographs through their model gateway. What a model can
  see is outside the contract's control; the contract only guarantees that what
  one node could not see never decides anything.
