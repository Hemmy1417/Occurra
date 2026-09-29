"use client";

import Link from "next/link";

import { Empty, Loading, Outcome, ReadFailure, Row, Section, SectionHead } from "@/components/bits";
import { claimName, claimState, gen, outcome, prose, typeState } from "@/lib/present";
import { claimsOf, getCredit, typesOf } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function Mine() {
  const w = useWallet();
  const claims = useChain(w.address ? `claimsof.${w.address}` : null, (f) => claimsOf(w.address, 0, 50, f));
  const types = useChain(w.address ? `typesof.${w.address}` : null, (f) => typesOf(w.address, 0, 50, f));
  const credit = useChain(w.address ? `credit.${w.address}` : null, () => getCredit(w.address));

  if (!w.address) {
    return (
      <Section>
        <h1 className="t-display">Your record</h1>
        <p className="t-body measure mt-4 text-graphite">
          Connect a wallet to see the claims it filed or assesses, the event types it sponsors, and the credit waiting
          for it.
        </p>
      </Section>
    );
  }

  const asClaimant = (claims.data?.claims ?? []).filter((c) => c.claimant.toLowerCase() === w.address.toLowerCase());
  const asAssessor = (claims.data?.claims ?? []).filter((c) => c.assessor && c.assessor.toLowerCase() === w.address.toLowerCase());

  return (
    <Section className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <p className="t-label text-smoke">Your record</p>
        <h1 className="t-display">What this wallet holds and is owed</h1>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="Credit" />
        {credit.data ? (
          <div className="md:w-[480px]">
            <Row label="Waiting to be withdrawn">{gen(credit.data.owed)}</Row>
            <Row label="Withdrawn so far">{gen(credit.data.paid)}</Row>
          </div>
        ) : <Loading what="your credit" />}
        <p className="t-small measure-wide text-graphite">
          Benefits, returned bonds, withdrawn reserve and value sent with a refused write all wait here. When there is
          any, the bar under the header offers to withdraw it.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="Claims you filed" />
        {claims.error ? <ReadFailure what="your claims" retrying={claims.retrying} /> : !claims.data ? <Loading what="your claims" /> : asClaimant.length ? (
          <ul>
            {asClaimant.map((c) => (
              <li key={c.claim_id}>
                <Link href={`/claims/${c.claim_id}`}
                      className="grid gap-1 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_200px_180px] md:gap-6 md:px-2">
                  <span className="t-small">{prose(c.subject)} <span className="text-smoke">· {claimName(c.claim_id)}</span></span>
                  <span className="t-small text-graphite">{claimState(c.state)}</span>
                  <span className="t-small">
                    {c.final ? <Outcome value={c.final.determination}>{outcome(c.final.determination)}</Outcome> : <span className="text-smoke">Not final</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty>This wallet has not filed a claim.</Empty>}
      </div>

      {asAssessor.length ? (
        <div className="flex flex-col gap-4">
          <SectionHead title="Claims you assess" />
          <ul>
            {asAssessor.map((c) => (
              <li key={c.claim_id}>
                <Link href={`/claims/${c.claim_id}`} className="grid gap-1 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_200px] md:px-2">
                  <span className="t-small">{prose(c.subject)}</span>
                  <span className="t-small text-graphite">{claimState(c.state)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <SectionHead title="Event types you sponsor" />
        {types.error ? <ReadFailure what="your event types" retrying={types.retrying} /> : !types.data ? <Loading what="your event types" /> : types.data.event_types.length ? (
          <ul>
            {types.data.event_types.map((t) => (
              <li key={t.type_id}>
                <Link href={`/types/${t.type_id}`}
                      className="grid gap-1 border-b border-[#d9d9d9] py-4 hover:bg-haze md:grid-cols-[1fr_200px_160px] md:gap-6 md:px-2">
                  <span className="t-small">{prose(t.title)}</span>
                  <span className="t-small">{gen(t.reserve_wei)} held</span>
                  <span className="t-small text-graphite">{typeState(t.state)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty>This wallet sponsors no event type.</Empty>}
      </div>
    </Section>
  );
}
