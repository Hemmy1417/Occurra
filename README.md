<p align="center"><img src="https://raw.githubusercontent.com/Hemmy1417/Occurra/main/web/app/icon.svg" width="120" alt="Occurra"/></p>

# Occurra - Decentralized verification of real-world events

**Did it happen? The evidence decides, and no single party reads it.**

A sponsor, such as an insurer, a logistics desk or a fund, writes down one kind of event: its definition, the
criteria the evidence must establish, and the evidence a claim must carry. A claimant says the event happened and
files photographs and documents, stored and hashed on chain. Independent GenLayer validators each examine the
photographs and rate every requirement, and the contract records whether the evidence establishes that the event
occurred as defined. Whether anyone is paid follows from that in code.

## What it is

- **Event types.** A sponsor's written definition of one kind of event, with criteria, evidence rules, a benefit, a bond and a funded reserve. Every version is kept; a claim binds the version in force when it was filed.
- **Only events that must be read from evidence.** Property damage, vehicle damage, cargo loss or damage, and business interruption. Hazards, flight status and weather indices are published data an oracle reads, so they are not offered ([docs/design.md](docs/design.md)).
- **Evidence on chain.** Photographs and documents are stored and hashed when filed, and every validator judges the same bytes. Every determination records a snapshot of the evidence it was decided on.
- **A fixed rule, applied in code.** Validators rate each requirement; code grounds each rating in what was actually seen and derives the outcome. The same ratings always give the same outcome.
- **One receipt for any consumer.** `get_receipt(claim_id)` says what was decided, for which event type and version, and whether it is final.

## How it works

### For sponsors

1. Write an event type: definition, exclusions, up to eight criteria, the evidence a claim must carry, the benefit, the claimant's bond, the windows, and optionally independent assessors.
2. Fund its reserve in the same act. It is your capital: anything not committed to an open claim can be withdrawn.
3. Each claim commits its benefit from the reserve when it is filed, so two claims never share one benefit.
4. Appeal an established determination once, inside its window, with your own evidence if you have any.
5. Publish new versions or pause new claims; open claims keep the version they were filed under.

### For claimants

1. File a claim under an event type: the subject, its identifier, the date, the declared cause, your account, and the bond.
2. File the photographs and documents the event type requires. Anything missing is named before any validator is asked.
3. Ask for the assessment. Each validator examines the photographs itself, before it reads what anyone says about them.
4. Appeal a determination that went against you once; both sides answer before it is judged again.
5. Once final, withdraw what the ledger owes you: the benefit and your bond if the event was established.

## Outcomes

| Outcome | When | Money |
|---|---|---|
| `ESTABLISHED` | every requirement satisfied on evidence the validators saw, the evidence enough to decide, no contradiction between two pieces of evidence | the claimant is credited the benefit and the bond |
| `NOT_ESTABLISHED` | at least one requirement shown not met, on evidence found enough to decide | the bond goes to the sponsor's reserve |
| `UNDETERMINED` | anything not established either way, evidence not enough to decide, or two pieces of evidence that contradict each other | the bond comes back; no benefit is paid |

The requirements are the event type's criteria and three checks the contract always asks: the right subject, a
consistent cause, and documents that agree with the photographs.

## Lifecycle

```text
file_claim ─► OPEN ── evidence filed ── request_assessment (preflight in code, then GenLayer)
  (bond)       │  │                                 │
               │  │ withdraw_claim                  ▼
               │  └─ (before the deadline) ─►   DETERMINED ◄─────────────────────┐
               │      WITHDRAWN, bond back          │ open_appeal               │ readjudicate
               │                                    ▼ (the party it went        │ (anyone, after the
               │ close_claim                   UNDER_APPEAL   against)          │  evidence period;
               │ (evidence deadline passed)         │ ──────────────────────────┘  a new, linked
               ▼                                    │ close_claim, 3 days after     determination)
            CLOSED                                  │ the evidence period: the appealed
     bond forfeited to the reserve                  │ determination stands
                                                    ▼
                                       finalize (window passed, or no appeal left)
                                                    │
                                                  FINAL ── established: benefit and bond to the claimant
                                                        ── not established: bond to the sponsor's reserve
                                                        ── undetermined: bond back to the claimant
```

| State | Who moves it next | If nobody acts |
|---|---|---|
| `OPEN` | the claimant files evidence and asks for the assessment, or withdraws before the evidence deadline | anyone closes it after the deadline; the benefit returns to the reserve and the bond is forfeited to it |
| `DETERMINED` | the party the determination went against appeals inside the window | anyone finalizes once the window has passed |
| `UNDER_APPEAL` | both sides may add bounded evidence during the evidence period; then anyone asks for the readjudication | anyone closes it three days after the evidence period: the appealed determination stands and becomes final |
| `FINAL`, `WITHDRAWN`, `CLOSED` | none: terminal | every amount waits in the ledger for its owner's `withdraw` |

A determination runs `APPEALABLE`, then `APPEALED` and `SUPERSEDED` by its readjudication (and kept exactly as
recorded), or `FINAL`. See [docs/design.md](docs/design.md).

## GenLayer consensus functions

| Function | Kind | What runs under consensus |
|---|---|---|
| `request_assessment` | write, nondeterministic | each node examines the photographs two at a time and a party's only beside its own, rates every requirement, and the leader's result is accepted only if each validator stands behind it both as sent and as it would be recorded |
| `readjudicate` | write, nondeterministic | the same, on the whole stored file plus the evidence filed during the appeal |
| everything else | write or view, deterministic | windows, bonds, reserve, evidence rules, the ledger |

## Contract

| | |
|---|---|
| Network | GenLayer Studio Next, chain 61997, `https://studio-next.genlayer.com/api` |
| Contract (deployment of record) | [`0xceCD0B81fBd1BF4e969C908D1452B26D17066E22`](https://explorer-studio-dev.genlayer.com/address/0xceCD0B81fBd1BF4e969C908D1452B26D17066E22) |
| Source | [`contracts/occurra.py`](contracts/occurra.py), sha256 `73632543ef19a41d729c8f1dcef6a4dc8ca766f26e54f714fdd60d53b1c17792`, byte-for-byte identical to the deployed code (`node scripts/deploy.mjs verify`) |
| Runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Ruleset | `occurra-rules-1` |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `create_event_type` | anyone, as sponsor | yes | the value funds the reserve; a refusal credits it back |
| `fund_reserve` | the sponsor | yes | |
| `publish_version` | the sponsor | | keeps category and kind; open claims keep their version |
| `set_type_state` | the sponsor | | pause or resume new claims |
| `withdraw_reserve` | the sponsor | | only the uncommitted reserve, credited to the ledger |
| `accept_assessor_role` | a wallet the type names | | never the sponsor |
| `file_claim` | anyone but the sponsor and its assessors | yes | the exact bond; commits the benefit; at most three open claims per wallet per type |
| `submit_image`, `submit_document` | the claimant, the claim's assessor, the sponsor during its own appeal | | quotas per party; PNG or JFIF, at most 400 KB; the same bytes never twice |
| `request_assessment` | the claimant | | once, before the evidence deadline, with the evidence rules met |
| `open_appeal` | the party the determination went against | | inside the window, while appeals remain |
| `readjudicate` | anyone | | after the appeal's evidence period |
| `finalize`, `close_claim` | anyone | | once no appeal can be filed; lapsed claims and undecided appeals |
| `withdraw_claim` | the claimant | | before assessment and before the evidence deadline |
| `withdraw` | anyone owed credit | | the pull transfer to the caller's own wallet |

### Read methods

`get_config`, `get_stats`, `list_event_types`, `types_of`, `get_event_type`, `get_type_version`, `list_claims`,
`list_all_claims`, `claims_of`, `get_claim`, `get_determination`, `get_snapshot`, `get_receipt`, `get_evidence`,
`get_evidence_text`, `get_evidence_image`, `get_events`, `get_credit`. Every list is paged at 50.

### Consensus guarantees

- An established event is every validator's own finding; a requirement recorded as failed was failed by every validator, each finding the evidence enough to decide.
- A rating stands only on a photograph the nodes saw or the independent assessor's report. Paperwork, including a photographed document, can neither prove nor disprove an event.
- No finding rests on the photographs of the party it favours alone: the sponsor's can fail a requirement only beside a claimant's photograph or the assessor's observation, and past an accepted assessor the claimant's can satisfy a criterion only beside the assessor's observation.
- A photograph a node cannot see counts for nothing for it and can never block a round; a leader cannot drop one a validator saw.
- A conflict counts only when it names two pieces of evidence on the claim.
- Every field a party wrote, and all text read off a photograph, is fenced as content in the prompt.

## Verified end to end

| | |
|---|---|
| Contract tests | 226 direct tests: every rule, the determination rule, grounding, both interested-party floors, validator dissent on raw and settled results, the audit regressions, one test per judges' standard, and a randomized walk that asserts value conserved to the wei after every action and reaches every state and outcome |
| Contract sweep | every mutant killed, control passes ([docs/proofs/sweep.txt](docs/proofs/sweep.txt)) |
| App tests | the action rules run on records the contract wrote (a direct test fails if those records drift), every contract write reachable from a page, value sent only to payable writes, and a write signed by the connected wallet |
| Pre-deployment review | two adversarial reviews found fifteen defects before the deployment of record; the live proofs found two more. All fixed and pinned ([docs/security.md](docs/security.md)) |

Live proofs ran on the deployment of record, `0xceCD0B81fBd1BF4e969C908D1452B26D17066E22`, and the appeals,
the assessor and the exits on a second deployment of the same bytes, with six public photographs ([fixtures/ATTRIBUTION.md](fixtures/ATTRIBUTION.md)). Every transaction is in
[docs/proofs](docs/proofs/README.md).

| Case | Evidence | Outcome on chain |
|---|---|---|
| The enforced half | a wrong bond, a sponsor claiming under its own type, an assessment before the damage photograph, a claimant appealing its own win, an early finalize | refused in the contract's own words, no validator asked; the refused bond credited back |
| Escape of water | the stained ceiling, the leaking trap, a plumber's estimate | **Established**, every requirement satisfied and no conflict raised (the conflict flag's negative control); finalized after its window; the claimant credited exactly the 1 GEN benefit and the bond, then withdrew them |
| A report that contradicts the photographs | the same photographs, and a plumber's report saying nothing is damaged | **Undetermined**: the documents check failed and a conflict naming the two pieces of evidence was raised; the bond came back |
| A different car | a red saloon filed as the claimant's white one | **Not established**, the subject check failed; the bond went to the reserve |
| A wreck, not a collision | a rusted, burnt-out car filed as fresh collision damage | **Not established**, the cause check failed; the bond went to the reserve |
| A claimant's appeal | the leaking trap alone, then the stained ceiling filed on appeal | **Undetermined**, then **established** on readjudication, linked to the determination it reviewed, which is kept as superseded |
| A sponsor's appeal | an established claim, contested on argument alone | **Not established** on readjudication (the cause check); no requirement failed on the sponsor's photographs, as it filed none. Recorded as observed in [docs/proofs](docs/proofs/README.md) |
| An independent assessor | a type that requires one; the assessor accepts and files a report | refused before acceptance and to a stranger; then **established**, every satisfied criterion citing the assessor's report |
| The exits and controls | withdrawal, a new version, a pause, reserve withdrawal | the bond returned exactly; the open claim kept its version; the paused type refused a claim; idle reserve credited exactly and drawn |
| The app's own rules | `web/lib/acts.ts`, run against chain state | matched the chain at every check |

```text
[15:19:11] water.assess: ESTABLISHED {"C1":"SATISFIED","C2":"SATISFIED","S1":"SATISFIED","S2":"SATISFIED","S3":"SATISFIED"} sufficient=true conflicts=false
[15:25:03] contradicted.assess: UNDETERMINED {"C1":"SATISFIED","C2":"SATISFIED","S1":"SATISFIED","S2":"SATISFIED","S3":"NOT_SATISFIED"} sufficient=true conflicts=true
[15:27:48] wrongcar.assess: NOT_ESTABLISHED {"C1":"NOT_SATISFIED","C2":"NOT_SATISFIED","S1":"NOT_SATISFIED","S2":"NOT_SATISFIED","S3":"NOT_APPLICABLE"} sufficient=true conflicts=false
[15:30:35] wreck.assess: NOT_ESTABLISHED {"C1":"NOT_SATISFIED","C2":"NOT_ESTABLISHED","S1":"NOT_SATISFIED","S2":"NOT_SATISFIED","S3":"NOT_APPLICABLE"} sufficient=true conflicts=false
[15:40:47] every proof passed
```

> Together these two photographs establish both water damage to interior surfaces and an identifiable internal
> fitting as the source. [...] The plumber's estimate (ev-000003) corroborates the account but is a party
> document; the photographs independently support the findings.
>
> (the leading validator's recorded reasoning on the escape of water, `det-000001`)

## Tech stack

| | |
|---|---|
| Contract | Python on GenVM, `contracts/occurra.py` |
| App | `web/`: Next.js 16, React 19, TypeScript strict, Tailwind 4, `@genlayer/transaction-kit` 0.1.0-rc.2, `genlayer-js` 2.0.0-rc.1 |
| Wallets | EIP-6963 discovery; every write signed by the connected wallet; no backend, database or server signer |
| Tests | pytest in direct mode against a strict stub of the GenLayer SDK; vitest; mutation sweeps for both |
| Scripts | `scripts/`: keys, deploy and verify, fixtures, proofs, paths |

## Repository

```text
contracts/occurra.py        the intelligent contract
docs/design.md              the specification, standard by standard
docs/security.md            every defect found before and during the proofs, and its fix
docs/proofs/                the live runs, with every transaction
fixtures/                   the demonstration photographs and their licences
scripts/                    deploy, verify, and the live proof runs
tests/direct/               the contract suite
tests/mutation/mutate.py    the contract sweep
web/                        the app
```

## Getting started

```bash
pip install -r requirements.txt
python -m pytest tests/direct -q
python tests/mutation/mutate.py
cd web && pnpm install && pnpm test && pnpm dev
```

To run the proofs on your own deployment: `node scripts/keys.mjs`, then `node scripts/deploy.mjs record`, then
`node --experimental-strip-types scripts/proofs.mjs <address>`.

## Security

- No owner, no admin, no upgrade path: the contract has no privileged role.
- Value leaves only through `withdraw`, to the caller's own wallet; every amount is tracked to its owner, and the randomized walk proves the books balance to the wei.
- A payable write never raises after taking value: a refusal credits the value back.
- The limits the design accepts are stated in [docs/security.md](docs/security.md).

## Design notes

- The oracle test was applied to every category before anything was built; four remain.
- Windows are wall-clock, from each transaction's own time.
- Every state has an exit someone other than the parties can take, so nothing is ever stranded.

## Disclaimer

Occurra runs on GenLayer Studio Next, a test network, and every amount is test GEN. The demonstration claims are
invented stories told around public photographs. Nothing here is insurance or financial advice.
