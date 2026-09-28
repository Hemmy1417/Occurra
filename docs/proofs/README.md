# Live proofs

Two runs, each a script whose every claim is an assertion; if the contract or the panel had behaved otherwise, the
run would have stopped and said which. Both are resumable and keep every transaction hash as it is sent.

| Run | Deployment | Script | Log | Record |
|---|---|---|---|---|
| Proofs | deployment of record `0xceCD0B81fBd1BF4e969C908D1452B26D17066E22` | [scripts/proofs.mjs](../../scripts/proofs.mjs) | [proof-run.txt](proof-run.txt) | [proofs.json](proofs.json) |
| Paths | `0x5065765380a0851C26fC30203246A58d25B9e1E5`, the same bytes | [scripts/paths.mjs](../../scripts/paths.mjs) | [paths-run.txt](paths-run.txt) | [paths.json](paths.json) |

The long paths ran on a second deployment of the same source so that a network stall there could never block the
deployment the app writes to. Explorer: `https://explorer-studio-dev.genlayer.com/address/<address>`.

## Proofs on the deployment of record

| Case | Determination | Transaction |
|---|---|---|
| Escape of water: the stained ceiling, the leaking trap, a plumber's estimate | **Established**, every requirement satisfied, no conflict raised | `0x8c0387af32a617c229575104b4694004f67d846cb42050e2e73e56d3af86a4ec` |
| The same photographs beside a report saying nothing is damaged | **Undetermined**: the documents check failed and a conflict naming two pieces of evidence was raised | `0xb99e75e9bd164f46824d60eb819441142b68482491e17fba1c0b894167172d5b` |
| A red saloon filed as the claimant's white one | **Not established**, the subject check failed | `0xfad261c475b8c84511862799906598b11ddb228feda03afb9fc5c3772b9e9395` |
| A rusted, burnt-out car filed as fresh collision damage | **Not established**, the cause check failed | `0xac0d7d18f579d4f5d4a53cd939b4abe7b57dbe3c984942de544816e3c821a4a4` |
| A side view of a car hit from behind | **Established** on its second asking (the first reached no majority and recorded nothing), so this run had no claimant appeal to make; the paths run makes one | `0x03b69e16af174aa78c578bad9717ed5b325c1a1f12e2b9fae84c2c2ade76d6a0` |

Around them, each asserted:

- **Refused in code, no validator asked:** a wrong bond (returned, and the value credited back), a sponsor claiming under its own type, an assessment before the damage photograph (the refusal's words equal the app's own), a claimant appealing its own win, and a finalize inside the appeal window.
- **Settled:** the established claim finalized after its window; the claimant was credited exactly the 1 GEN benefit and the bond, the reserve paid exactly one benefit, and the claimant withdrew to its wallet (`0xe314848f01c58315546729ec13a724a01cf57b8b6d6494566edf6341347382f4`).
- **Bonds where they belong:** each other claim finalized, the bond going to the sponsor's reserve for a claim not established and back to the claimant for an undetermined one.
- **The app's own rules:** `web/lib/acts.ts`, run against chain state at six moments, offered each act exactly when the contract then accepted it and withheld it where the contract refuses.

## Paths on the second deployment

| Case | Determinations | Transactions |
|---|---|---|
| A claimant's appeal: the leaking trap alone, then the stained ceiling filed on appeal | **Undetermined**, then **established** on readjudication; linked to the determination it reviewed, which is kept as superseded, and the snapshot names the photograph new on appeal | `0xc17276319f43261704f42b078c0d708fca7cdc4d89bda6e7dff10d3f71800add`, `0xd5680ecd34257d53059d9f55aef47556033ed7e597445a09483bd2d8b4536764` |
| A sponsor's appeal of an established event, on argument alone | **Established**, then **not established** on readjudication (the cause check); asserted that no requirement failed on the sponsor's photographs alone (it filed none). The readjudication reached a majority on its second asking | `0x2972d4c5ca4452dc8144bd3d9b10264dae9741e742b211381dfa642e22325ad9`, `0x37e41490caff6ed925cece1c1f69530f16cde5dc00ba0aeec8080e28b9ea59da` |
| An event type that requires an independent assessor | refused before any assessor accepted, and to a stranger; the named assessor accepted; the claimant's own "assessor report" refused; then **established**, every satisfied criterion citing the assessor's report | `0x5b589ca99c5a7589b2b2d36ea1427a5b99f36230e48cc2b068a63ae0c87222fd` |
| The exits and the sponsor's controls | a withdrawal returning exactly the bond; a new version leaving an open claim on the version it was filed under; a paused type refusing a claim; withdrawing more than the free reserve refused; withdrawing idle reserve credited exactly, then drawn | see [paths.json](paths.json) |

The app's own rules matched the chain at fourteen checks in this run.

## What the live runs cannot show

The lapse of an unassessed claim and the close of an appeal left undecided take days of real windows (the shortest
evidence period an event type can set is one day). Both are proved in the direct suite
(`tests/direct/test_claims.py`, `tests/direct/test_lifecycle.py`) and by the randomized walk.

## The sponsor's appeal reversed a determination on argument alone

The contested claim was established on its photographs; the sponsor appealed with no new evidence, arguing the stain
came from a slow leak over months. On readjudication every validator found the cause check not satisfied on the same
photographs. A readjudication judges the whole file afresh by design, and the argument is fenced as argument, not
evidence; this is recorded here as observed rather than smoothed over.

## Superseded deployments

The proofs are the reason for two of them: each time the run found a defect, the contract was fixed, deployed again,
and the run repeated from the start. Neither earlier deployment is the one the app reads.

| Deployment | Superseded because |
|---|---|
| `0x3c61D5ab943Ce1e21a162E7A38c22c22B118e5D9` | a claim with a photograph of a different car was recorded undetermined: the panel called the photograph against the claimant's account a conflict ([security.md](../security.md), L1) |
| `0x0c05eD7d8abeb281FDC5A17F208c014ce9E35112` | the same claim failed the subject check while the panel called the evidence insufficient ([security.md](../security.md), L2) |
