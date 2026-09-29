# Occurra: design

The specification, written before the contract. Every decision here names the
judges' standard it answers, so a reviewer can check the build against it.

## The question

> **Given an event type's written definition and criteria, and the evidence filed
> for one claim, does that evidence establish that the claimed event occurred as
> defined?**

Occurra decides whether an event happened. It does not decide whether anyone
deserves a payment: that is the event type's sponsor's rule, applied in code to
the determination.

## The oracle test (applied before anything else)

Could a conventional oracle or plain code answer this? For each category the
brief proposed:

| Category | Kept? | Why |
|---|---|---|
| Natural disaster (the hazard itself) | **No** | Whether a flood, quake or storm happened is published structured data (national weather and geological services). An oracle reads it; a panel adds nothing. Damage a hazard caused to a named property is kept under Property. |
| Travel and aviation | **No** | A cancellation or delay is a fact in the airline's and airports' own feeds. |
| Agriculture (weather triggers) | **No** | Rainfall and drought indices are numbers from gauges and satellites: parametric, oracle-shaped. |
| Cyber and digital | **No** | An outage is a status-page fact; a breach cannot be witnessed from filed evidence the panel can check. |
| Marine and shipping | **Folded into Cargo** | Port delays are feed data; damage to goods is kept as cargo. |
| **Property** | **Yes** | Whether this room was damaged by water, fire or forced entry is read from photographs and reports, often against each other. |
| **Vehicle** | **Yes** | Whether this vehicle shows collision or vandalism damage consistent with the account. |
| **Cargo and logistics** | **Yes** | Whether goods arrived damaged or short, read from photographs against the delivery documents. |
| **Business interruption** | **Yes** | Whether physical damage or an obstruction actually closed these premises, read from photographs and notices. |

The kept four share one property: the evidence has to be **read and weighed**,
and it can disagree with itself. That is the judgment GenLayer validators make
and ordinary code cannot. Each is a pattern earlier builds proved live:
photographs of physical work and damage judged against written criteria, with
documents read beside them.

## Decision 2: what is new here

Earlier builds judged one fixed kind of claim. Occurra's primitive is the
**event type**: a sponsor writes a definition, criteria, evidence rules and
coverage terms once, under one of the four categories. Every version is kept and
immutable; each claim binds the version in force when it was filed (S25). One
**event receipt** format serves every type, readable by any consumer through one
view.

## Decision 3: what "undetermined" means

An undetermined determination is not an answer, so it has a defined path:

1. The claimant may appeal it once inside the window, and must file new evidence during the appeal: an
   appeal is judged again only on something new, never on argument alone.
2. If the readjudication is still undetermined, or nobody appeals, the claim
   becomes **final undetermined**: the receipt says the evidence on file did not
   establish the event, the claimant's bond is returned in full, and the
   committed benefit goes back to the sponsor's reserve.
3. The claimant may file a new claim for the same event with fresh evidence and a
   fresh bond, but only inside the type's filing window, which is counted from
   the declared event date. The window bounds retries; no claim is ever left open.

## Parties, all bound to the signer (S43)

- **Sponsor**: creates an event type, funds its reserve, publishes new versions,
  pauses it, withdraws idle reserve, and may appeal an established determination.
- **Claimant**: files a claim with a bond, files evidence, asks for the
  assessment, appeals a determination against them, withdraws before assessment.
- **Independent assessor** (optional per type): named by the sponsor, accepts the
  role themselves, is never the sponsor or the claimant; a claimant may nominate
  one accepted assessor for a claim, whose observations count as independent.
- **Anyone**: finalizes after the window, closes stale claims, withdraws their own
  credit.

## Money (S3, S9, S23, S24)

- The sponsor funds a **reserve per event type**. It is the sponsor's own capital:
  idle reserve is withdrawable by the sponsor at any time.
- Filing a claim **commits the type's benefit** from the reserve at once (S23), and
  refuses if the reserve cannot cover it. Two claims can never share one benefit.
- The claimant posts a **bond** at filing, tracked to the claim.
- **Finalization is atomic** (S24) and credits a pull ledger:
  - established: benefit and bond to the claimant;
  - not established: the bond to the sponsor's reserve, the benefit back to the reserve;
  - undetermined, or withdrawn before assessment and before the evidence
    deadline: the bond to the claimant, the benefit back to the reserve;
  - lapsed (never assessed, never withdrawn, closed after the evidence deadline):
    the bond to the sponsor's reserve, the benefit back to the reserve. A claim
    holds a benefit committed, so holding it must never be free: withdrawing
    returns the bond in full, but only while the claim can still be pursued.
- A wallet holds at most three open claims under one event type, so one wallet
  cannot tie up a reserve by filing claims it never pursues.
- Value leaves only through `withdraw`, a pull transfer to the caller's own wallet.
- A payable write never raises after taking value: a refusal credits the value
  back (Studio Next credits a refused payable write's value).

## States, and who moves each one (S17, S26)

| State | Moved by | If nobody acts |
|---|---|---|
| OPEN | claimant: assess, or withdraw before the evidence deadline | anyone closes it after the evidence deadline: benefit back, bond forfeited to the reserve |
| DETERMINED | the losing party appeals inside the window | anyone finalizes after the window |
| UNDER_APPEAL | anyone readjudicates once the evidence period ends, so both sides can answer first, provided the appellant filed new evidence | anyone closes it as soon as the evidence period ends if the appellant filed nothing new, or three days after it otherwise: the appealed determination stands and finalizes |
| FINAL | terminal | credits wait in the ledger for their owners |
| WITHDRAWN, CLOSED | terminal | same |

## The determination (S7, S16, S21, S22, S34, S42)

Validators rate every requirement in scope:

- each **criterion** of the event type (the definition, split into checkable statements);
- **S1 subject**: nothing in the evidence shows a different property, vehicle,
  consignment or premises from the one the claim names;
- **S2 cause**: the damage or disruption shown is consistent with the declared
  cause (water, not fire; collision, not wear);
- **S3 documents**: the filed documents agree with what the photographs show.

Ratings: SATISFIED, NOT_SATISFIED, NOT_ESTABLISHED (S2 and S3 may be
NOT_APPLICABLE, decided in code from the file). Code then derives:

```text
conflicting evidence, or evidence insufficient to decide   -> UNDETERMINED
any requirement NOT_SATISFIED                              -> NOT_ESTABLISHED
any requirement NOT_ESTABLISHED                            -> UNDETERMINED
otherwise                                                  -> ESTABLISHED
```

- **Grounding in code**: a rating stands only on a photograph or the independent
  assessor's report. Paperwork can neither prove nor disprove the event.
- **Interested parties, mirrored (S42)**: the sponsor files photographs only on its
  own appeal, against the claim, so they can ground NOT_SATISFIED only beside a
  claimant photograph or the assessor's observation; on a claim with an accepted
  assessor, the claimant's photographs can ground SATISFIED on a criterion only
  beside the assessor's observation.
- **Equivalence**: an established determination must be each validator's own; a
  rejection must be reproduced on each requirement it fails; doubt stands unless a
  validator would establish. The record says which ratings were bound (S21).
- **What validators check is what is recorded.** Each validator applies the
  record's own rules (shape, grounding on the leader's cited basis and seen
  photographs, flags read strictly) to the leader's answer and must stand behind
  that result as well as the raw one. A leader cannot send an answer that reads
  as doubt to the validators and as an established event on the record, or the
  reverse.
- **A photograph a node cannot see counts for nothing for it.** Every node
  reports which photographs it saw; a file the model gateway rejects is simply
  unseen. A validator refuses a leader that left out a photograph the validator
  saw, or whose list holds anything but this claim's photographs, but a
  validator that saw fewer judges from what it saw, and every finding it agrees
  to must still be its own. So an unreadable file, or one only some models can
  read, can never block a round, and a leader cannot drop a photograph by
  calling it unseen. A round in which a node saw no photograph of the scene
  records nothing (S5).
- **Parties are examined apart.** A party's photographs are examined only beside
  that party's own, and text visible in an image is content, never an
  instruction.
- **A conflict is two pieces of evidence, named.** The flag counts only when its
  note names two items on this claim; a photograph that contradicts the
  claimant's account is a requirement it fails, not a conflict. Evidence that
  shows a requirement unmet is enough to decide.
- **A rejection needs sufficiency too.** A validator stands behind a finding
  that the event is not established only if it also finds the evidence enough
  to decide.
- **A photographed document is paperwork.** It is examined and its text is read,
  but it is not an observation of the scene and cannot ground a rating.
- **Party text stays content.** Every field a party writes, and all text read off
  a photograph, is fenced on its own; fence markers are neutralised whatever
  their case, and a fence can only close with characters party text never
  contains.
- **Shape (S16)**: every recorded rating obeys the rules whoever wrote it.
- **The examination sees the photograph, not the claim about it.** Descriptions
  are weighed afterwards, as claims: a model shown the claim first can repeat it
  instead of looking.

## Evidence (S8, S14, S18, S28, S35, S36, S39)

- Photographs and documents are **stored on chain and hashed** when filed; the
  panel reads those bytes, never a URL. The same bytes cannot be filed twice on
  one claim (S35). A photograph must carry a full PNG signature or a JFIF JPEG
  header, the only formats validators read.
- Every assessment records a **snapshot**: each item's hash and whether it was new
  on appeal (S36). A readjudication reads the same stored bytes plus the new items
  (S14, S28), so what each panel saw is provable.
- Labels (photo view, document type) are the filer's claims; the panel is told a
  label a photograph does not bear out counts against the filer (S31).
- **Evidence rules are bound at filing** (S18): the claim binds the type version,
  and preflight checks that version's rules in code before any validator is asked.

## Clock (S1, S13)

Every window is wall clock from the transaction's own datetime: filing window
from the declared event date (a calendar date in UTC), the evidence deadline,
the appeal window, the evidence period, the stale-appeal close.

## Trade-offs, stated

- A claim holds its benefit committed from filing (S23), so a claimant can hold a
  reserve for up to the evidence period and withdraw for the bond before the
  deadline. The sponsor bounds this with the bond it sets, the evidence period it
  chooses and the three-open-claims cap per wallet.
- Doubt stands: a leader that reports undetermined where a validator would find
  the event not established is followed, since undetermined is the outcome no
  party can be harmed by beyond the return of a bond.
- The sponsor names the assessors and the claimant chooses among those who
  accepted; an assessor's observation counts as independent of both.

## The app (S6, S32, S40, S45)

One Next.js app, reads from the chain, every write signed by the connected
wallet. Every act a party can perform is reachable from a page; an unavailable
act is shown with its reason. The availability rules live in one pure module
mirroring the contract's guards, tested on shapes the contract writes and run
against the chain by the live proofs. The transaction panel reports success only
when the validators agreed: a round with no majority records nothing, even when
the leader's own execution succeeded.

## Proof plan (S38, S44)

Live, on the deployment of record, asserted by script:

- **established**: a property water-damage claim with matching photographs and a
  repair estimate, settled to the claimant exactly;
- **not established**: a claim whose photographs show a different cause from the
  one declared (positive control for S2);
- **wrong subject**: photographs of a different vehicle than the one named
  (positive control for S1);
- **contradiction**: a document stating a fact the photograph refutes (positive
  control for the conflict flag), with the established claim as the negative control;
- **appeal**: an undetermined claim appealed with the missing photograph;
- **sponsor appeal**: a sponsor contests an established claim with its own
  photograph, and no requirement fails on it alone (S42);
- **exits**: a withdrawn claim, a claim that lapsed unassessed, a sponsor withdrawing
  idle reserve, and the app's own action rules checked against the chain at each
  stage (S45);
- the whole path again **through the pages** in a browser.
