"use client";

/**
 * One act on the chain: a button that opens the signing panel for one frozen
 * transaction, or, when the rules say the act is not available, the reason in
 * words instead of a dead button.
 *
 * A payable write the contract refuses still finalizes: it returns the
 * refusal and credits the value back to the sender's pull credit. So a
 * confirmed payable write is followed by the contract's own answer, and a
 * refusal is shown as one.
 */
import { useState, type ReactNode } from "react";

import { Button } from "./bits";
import { announceConfirmed } from "./Confirmed";
import { TxPanel, type TxOutcome } from "./TxPanel";
import type { Can } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { refusal } from "@/lib/present";
import { returnedJson } from "@/lib/receipt";
import { useWallet } from "@/lib/wallet";

export type Answer = Record<string, unknown> & { refused?: boolean; reason?: string };

export function Act({
  label, method, args, value, confirm, working, variant = "primary", can, prepare, onAnswer, children,
}: {
  label: string;
  method: string;
  args?: unknown[];
  value?: bigint;
  confirm?: string;
  working?: string;
  variant?: "primary" | "secondary";
  /** The rules' verdict for this wallet; an unavailable act shows its reason. */
  can?: Can;
  /** Build the arguments at the moment of opening; return a sentence to refuse locally. */
  prepare?: () => unknown[] | string;
  onAnswer?: (answer: Answer | null, outcome: TxOutcome) => void;
  children?: ReactNode;
}) {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState<unknown[] | null>(null);
  const [problem, setProblem] = useState("");
  const [answer, setAnswer] = useState("");

  if (!w.address) {
    return <p className="t-small text-smoke">Connect a wallet to {label.charAt(0).toLowerCase() + label.slice(1)}.</p>;
  }
  if (can && !can.ok) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" disabled>{label}</Button>
        <p className="t-small text-smoke">{can.why}</p>
      </div>
    );
  }

  const start = () => {
    setAnswer("");
    const built = prepare ? prepare() : args ?? [];
    if (typeof built === "string") {
      setProblem(built);
      return;
    }
    setProblem("");
    setOpen(built);
  };

  return (
    <div className="flex flex-col gap-4">
      {children}
      {!open ? (
        <div>
          <Button variant={variant} disabled={!kit} onClick={start}>{label}</Button>
          {!kit ? <p className="t-small mt-2 text-smoke">Switch the wallet to Studio Next to sign.</p> : null}
        </div>
      ) : kit ? (
        <TxPanel
          kit={kit}
          tx={{ kind: "write", address: CONTRACT_ADDRESS, method, args: open }}
          value={value}
          confirmText={confirm ?? label}
          working={working}
          onClose={() => setOpen(null)}
          onDone={(outcome) => {
            if (!outcome.hash || !outcome.successful) {
              onAnswer?.(null, outcome);
              return;
            }
            const hash = outcome.hash;
            // Only a payable write can be refused without failing (it returns the
            // refusal and credits the value back); every other confirmed write is
            // announced at once, without waiting on another read of the network.
            if (value === undefined || value === 0n) announceConfirmed(hash, label);
            void returnedJson<Answer>(hash).then((a) => {
              if (a?.refused) setAnswer(refusal(String(a.reason ?? "")));
              else if (value !== undefined && value > 0n) announceConfirmed(hash, label);
              onAnswer?.(a, outcome);
            }).catch(() => {
              if (value !== undefined && value > 0n) announceConfirmed(hash, label);
              onAnswer?.(null, outcome);
            });
          }}
        />
      ) : null}
      {problem ? <p className="t-small text-obsidian">{problem}</p> : null}
      {answer ? (
        <p className="t-small hair p-4">
          The contract refused it: {answer} Anything you sent is waiting as credit under Your record.
        </p>
      ) : null}
    </div>
  );
}
