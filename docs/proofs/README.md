# Live proofs

Two runs, each a script whose every claim is an assertion; if the contract or the panel had behaved otherwise, the
run would have stopped and said which. Both are resumable and keep every transaction hash as it is sent.

| Run | Deployment | Script | Log | Record |
|---|---|---|---|---|
| Proofs | deployment of record `0x0F35F98559284e3fFbCe91ad522A58CeE634444E` | [scripts/proofs.mjs](../../scripts/proofs.mjs) | [proof-run.txt](proof-run.txt) | [proofs.json](proofs.json) |
| Paths | `0x7cE30a4A45D2dC34a07DDb13BB51f068D99FAf06`, the same bytes | [scripts/paths.mjs](../../scripts/paths.mjs) | [paths-run.txt](paths-run.txt) | [paths.json](paths.json) |

The long paths ran on a second deployment of the same source so that a network stall there could never block the
deployment the app writes to. Explorer: `https://explorer-studio-dev.genlayer.com/address/<address>`, and
`https://explorer-studio-dev.genlayer.com/tx/<hash>` for each transaction below.

## Proofs on the deployment of record

| Case | Determination | Transaction |
|---|---|---|
| Escape of water: the stained ceiling, the leaking trap, a plumber's estimate | **Established**, every requirement satisfied, no conflict raised | `0x66b6fb318fb312dd72f07878db26de55651889dace7c3de5e732e3f90c43a370` |
| The same photographs beside a report saying nothing is damaged | **Undetermined**: the documents check failed and a conflict naming two pieces of evidence was raised | `0x10034734d3b3a83dde9b9f57560a8403752a8a422c8c80ab79bf979a7219bd7b` |
| A red saloon filed as the claimant's white one | **Not established**, the subject check failed | `0xa005b65258d1aa0e8ddb82c63ff110c429a24c679beaced61fe734c931ead4b7` |
| A rusted, burnt-out car filed as fresh collision damage | **Undetermined**: the subject check failed, but the panel found the evidence not enough to decide, and insufficiency withholds a rejection (standard S22). Never established; the bond came back | `0x2a08b0d18f7e570c1a7b61c1d9fbd2a7487b548c92987753ddae5d010e0e5ae2` |
| A side view of a car hit from behind, then the rear view filed on appeal | **Undetermined**, then **established** on readjudication (on its second asking; the first reached no majority and recorded nothing). Linked to the determination it reviewed, which is kept as superseded; the snapshot names the photograph new on appeal | `0x68940e2c5b317b6ba9acd36a9a4421bc3697c805cce56f6c9259fb5e61060627`, `0xcce3174e84819aaeeddbb9524f9bab9716b9e7b96ffe5b1e1ccb456ad7f29456` |

Around them, each asserted:

- **Refused in code, no validator asked:** a wrong bond (returned, and the value credited back), a sponsor claiming under its own type, an assessment before the damage photograph (the refusal's words equal the app's own), a claimant appealing its own win, a finalize inside the appeal window, and a readjudication before the appeal's evidence period ended.
- **Settled:** the established claim finalized after its window (`0xcf2c4a9b47fb14c16e6d95df176917b8145061056eeeecf6e41a965c8b58322c`); the claimant was credited exactly the 1 GEN benefit and the bond, the reserve paid exactly one benefit, and the claimant withdrew to its wallet (`0x58ae92777b9319fb8b863af9e76a449d68476d138958e55e854393606e32c552`).
- **Bonds where they belong:** each other claim finalized, the bond going to the sponsor's reserve for a claim not established and back to the claimant for an undetermined one.
- **The app's own rules:** `web/lib/acts.ts`, run against chain state at twelve moments, offered each act exactly when the contract then accepted it and withheld it where the contract refuses.

On the wreck: an earlier deployment of the same rules failed this claim on the cause check with the evidence found
sufficient; this panel failed the subject check but called the evidence not enough to decide. The first run on this
deployment asserted the stricter reading and stopped; the assertion was changed to what the protocol guarantees,
that a contradicted cause is never established, and the run resumed. Both readings are kept in the log.

## Paths on the second deployment

| Case | Determinations | Transactions |
|---|---|---|
| A claimant's appeal: the leaking trap alone, then the stained ceiling filed on appeal | **Undetermined**, then **established** on readjudication, linked and superseded as above | `0x65991c5fd6a6bef0754904f47683d56e7b4f6cb756cd06fc8af1aad3c96082df`, `0xa41b5e1bf850ca78db346993da7243f20f1093d946cd3a5afc7143423cce3484` |
| A sponsor's appeal of an established event, with a loss adjuster's note as its new evidence | **Established**, then **undetermined** on readjudication: the cause check became not established either way. No requirement failed on the sponsor's evidence (a document can neither prove nor disprove an event), and the bond came back | `0x791b350326c83c12f1863caa8c79423ae882a0aa9b4dc40c725c25841aa85293`, `0xa98f2b98d4911b592e92083d7584f805831ec5bbc0fbe8ebcd3a06dddc205fa5` |
| An appeal that brings nothing new | **Undetermined**; the claimant appealed and filed nothing; after the evidence period the readjudication was refused and the appeal closed at once, the determination standing and the bond returned | `0xd8324a32c02c7d70a58acb0ab43d2f55e1c3a6e4f48c99e5ec7c7919b373652b`, close `0xe51393628004cf7d49bbc1a4801cdb399902d08cdcbcd67f563adfe898bb8171` |
| An event type that requires an independent assessor | refused before any assessor accepted, and to a stranger; the named assessor accepted; the claimant's own "assessor report" refused; then **established**, every satisfied criterion citing the assessor's report | `0xf3afcd7bd1c351d27ac211b06650e217b410a0924af545b176b4b584821d0806` |
| The exits and the sponsor's controls | a withdrawal returning exactly the bond (`0xbe4809c9956f7d606f8937faeb6015603b9bc2892356acff1e66c289ee271bc2`); a new version leaving an open claim on the version it was filed under (`0x14aab1412e5933dc32ec11400884ac0707bed550630e5213610c4ace09eb3038`); a paused type refusing a claim; withdrawing more than the free reserve refused; idle reserve credited exactly (`0x13ce64e41792f2ccb188fb10df9a977267f706e75c67b2067529dc39076ca8b8`) and drawn (`0x6d909aa53c38be8fd403482268fb8e882ceba8b185d026bd3841d9f4c8e86bcb`) | |

The app's own rules matched the chain at seventeen checks in this run. Three rounds reached no majority, recorded
nothing, and were asked again; the paths run was also resumed twice (Studio Next refused connections for a while,
and a resume bug in the script waited on an appeal already decided), skipping every step already on chain.

## The sponsor's appeal withheld the benefit on its own document

The adjuster's note could not fail any requirement, since paperwork neither proves nor disproves an event, but it
led the panel to find the cause no longer established either way, so the determination became undetermined: the
benefit was not paid and the bond came back. This follows the rules as written (doubt stands); it is recorded here
as observed, since it means an interested party's paperwork can create enough doubt to withhold a benefit.

## What the live runs cannot show

The lapse of an unassessed claim and the close of an appeal left undecided after bringing evidence take days of
real windows (the shortest evidence period an event type can set is one day). Both are proved in the direct suite
(`tests/direct/test_claims.py`, `tests/direct/test_lifecycle.py`) and by the randomized walk.

## Superseded deployments

Each time the runs found a defect or a gap, the contract was fixed, deployed again, and the runs repeated from the
start. None of these is the deployment the app reads.

| Deployment | Superseded because |
|---|---|
| `0x3c61D5ab943Ce1e21a162E7A38c22c22B118e5D9` | a claim with a photograph of a different car was recorded undetermined: the panel called the photograph against the claimant's account a conflict ([security.md](../security.md), L1) |
| `0x0c05eD7d8abeb281FDC5A17F208c014ce9E35112` | the same claim failed the subject check while the panel called the evidence insufficient (L2) |
| `0xceCD0B81fBd1BF4e969C908D1452B26D17066E22` | a sponsor's appeal on argument alone reversed an established claim on the same photographs; appeals now require new evidence (L3) |
| `0x6cBD92708908595d9406CDa82172479D2B8475f4` | the same source as the one the app reads; its proof run was discarded because the script had loaded a mutated copy of the app's rules while a mutation sweep was running, which voids every app check in that run |
