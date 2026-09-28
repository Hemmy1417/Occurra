"use client";

import { InkLink, Machine, Section, SectionHead } from "@/components/bits";
import { addressUrl, CHAIN_ID, RPC_URL } from "@/lib/chain";
import { CONTRACT_ADDRESS, IS_RECORD, REPO_URL, SOURCE_SHA256, SOURCE_URL } from "@/lib/config";

export default function Verify() {
  return (
    <Section className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <p className="t-label text-smoke">Verify</p>
        <h1 className="t-display">Check it yourself</h1>
        <p className="t-body measure-wide text-graphite">
          This is the one page where machine values are the point. Every other page shows the same record in words.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="The deployment this app reads and writes" />
        <p className="t-small text-graphite">
          {IS_RECORD ? "This is the deployment of record." : "This is not the deployment of record; treat what it shows as a test."}
        </p>
        <div className="md:w-[720px]">
          <Machine label="Contract" value={CONTRACT_ADDRESS} />
          <Machine label="Network" value={`GenLayer Studio Next, chain ${CHAIN_ID}`} />
          <Machine label="RPC" value={RPC_URL} />
          {SOURCE_SHA256 ? <Machine label="sha256 of the source it runs" value={SOURCE_SHA256} /> : null}
        </div>
        <div className="flex flex-wrap gap-6">
          <InkLink href={addressUrl(CONTRACT_ADDRESS)} external>Open it on the explorer</InkLink>
          <InkLink href={SOURCE_URL} external>Read the source</InkLink>
          <InkLink href={`${REPO_URL}/tree/main/docs/proofs`} external>Read the live proofs</InkLink>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="Compare the deployed code with the repository" />
        <p className="t-small measure-wide text-graphite">
          From a clone of the repository, this fetches the source the network holds for the contract and compares it
          byte for byte with the file in the repository.
        </p>
        <pre className="hair t-mono overflow-x-auto bg-haze p-4">{`cd scripts && pnpm install
node deploy.mjs verify ${CONTRACT_ADDRESS}`}</pre>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="Read one receipt from anywhere" />
        <p className="t-small measure-wide text-graphite">
          Any program can read a claim&apos;s event receipt through one view: the category, the event kind, whether the
          determination is final and what it says.
        </p>
        <pre className="hair t-mono overflow-x-auto bg-haze p-4">{`get_receipt("cl-00001")`}</pre>
      </div>
    </Section>
  );
}
