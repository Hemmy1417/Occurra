# The interface, end to end

One claim taken from start to finish through the app's own pages, on the deployment of record
`0x0F35F98559284e3fFbCe91ad522A58CeE634444E`, on 29 September 2026. Nothing was sent by a script: every write
below was composed by a page, reviewed in the app's signing panel, and signed by a connected wallet.

The wallets were stand-in EIP-6963 providers that sign locally with the project's test keys (the same five roles the
live runs use), so each wallet switch was a real disconnect and reconnect in the app. Before each signature the
composed call was read off the page and compared with the act on the button.

The hashes are proved from the chain alone by [scripts/ui-e2e.mjs](../../scripts/ui-e2e.mjs), which reads each one
back and checks the sender, the contract, the method the calldata names and the validators' decision, then reads
the records the walkthrough left. Its output is [ui-e2e.json](ui-e2e.json).

```
node scripts/ui-e2e.mjs
all 8 transactions and the final state check out
```

## The walkthrough

| # | Page and act | Wallet | Composed call | Decision | Transaction |
|---|---|---|---|---|---|
| 1 | Write an event type: burst or leaking plumbing, 1 GEN benefit, 0.1 GEN bond, 3 GEN reserve, 720 second windows | Sponsor | `create_event_type` | agreed | `0xd6c69413b6052f3efd55f2b791d3d478c0c040a59e2b11e0cea818ec277f2b4e` |
| 2 | File a claim: ground-floor bathroom of 21 Rowan Terrace, bond posted | Claimant | `file_claim` | agreed | `0xf80bb705e70de1a24024ef38ae686cad91869b0f7cd5ac705b47bd04bdf50a1c` |
| 3 | File evidence: the ceiling stain, as the scene | Claimant | `submit_image` | agreed | `0xdfd02223335fe910f16fbd0aa2e9ae27101a7d1baf21934a0379a5c8747a4145` |
| 4 | File evidence: the leaking trap, as the damage | Claimant | `submit_image` | agreed | `0x4dbe02530067a04b851bab639ce4abe893b37e76fbdafc5bf9d804cc1a529dc7` |
| 5 | Ask for the assessment | Claimant | `request_assessment` | **not agreed** | `0xd8843fddd36a2af5113fe6b5c99ddb814919a46c6c72ec955d28e910e4ed41b7` |
| 6 | Ask for the assessment, again | Claimant | `request_assessment` | agreed: **established** | `0x03f57e10ef5b564e8053303e72053509b4c1d685898ecfbec464b48858798ca2` |
| 7 | Finalize, once the appeal window had closed | Stranger | `finalize("cl-00006")` | agreed | `0xe26bc3a67d8e50db74090001e2ecdf382b7373cf5a1310d2a539acd40ba5b362` |
| 8 | Withdraw it, from the credit bar | Claimant | `withdraw()` | agreed; 1.1 GEN sent to the claimant | `0x666742c959031cdc16aeb73850247bc7c8efdcd57f851aae5af6b39cf4899465` |

Step 5 is kept because it shows the panel telling the truth. The validators did not agree with the leader, so the
contract recorded nothing, and the signing panel said the validators had not agreed rather than reporting a
success. Asked again, the round agreed and recorded determination det-000007, established.

## What the chain holds afterwards

| Record | Read back |
|---|---|
| Claim cl-00006 | final, settled by finalizing once no appeal could be filed; benefit 1 GEN paid; bond returned to the claimant |
| Determination det-000007 | established, final |
| Event type et-00003 | active, the sponsor wallet's |
| Claimant's credit | 0 after the withdrawal, whose one transfer carried 1.1 GEN to the claimant's own wallet |

## The rules the pages showed on the way

Each of these was read from the page with the named wallet connected, before any act was taken.

| Moment | Wallet | What the page offered |
|---|---|---|
| Established, appeal window open | Claimant | appeal refused: only the sponsor appeals an established event; finalize refused: the appeal window is still open |
| Established, appeal window open | Sponsor | appeal offered, with the rule that new evidence must follow; finalize refused (not filed; the walkthrough goes on to finality) |
| Appeal window closed | Stranger | finalize offered to anyone; appeal refused |
| Final, credit owed | Claimant | the credit bar, "The contract holds 1.1 GEN for this wallet", then nothing once withdrawn |

## Found and fixed on the way

A confirmed write that sends no value can never be refused silently, yet its confirmation notice waited on one more
read of the network before it appeared. `web/components/Act.tsx` now announces those writes as soon as they are
confirmed, and keeps waiting for the contract's answer only on payable writes, where a refusal is still possible.
The finalize and the withdrawal in this walkthrough ran on the fix.
