"use client";

/**
 * What the contract owes this wallet: a benefit, a returned bond, withdrawn
 * reserve, or the value sent with a refused write. It waits in a pull ledger
 * and leaves only in the owner's own transaction.
 */
import { useState } from "react";

import { Button } from "./bits";
import { announceConfirmed } from "./Confirmed";
import { TxPanel } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen } from "@/lib/present";
import { getCredit } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export function CreditBar() {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState(false);
  const owed = useChain(w.address ? `credit.${w.address}` : null, () => getCredit(w.address));
  const wei = BigInt(owed.data?.owed ?? "0");
  if (!w.address || wei <= 0n) return null;
  return (
    <div className="border-b border-ink bg-haze">
      <div className="page flex flex-wrap items-center justify-between gap-4 py-3">
        <p className="t-small text-obsidian">The contract holds {gen(wei)} for this wallet.</p>
        {!open ? <Button onClick={() => setOpen(true)} disabled={!kit}>Withdraw it</Button> : null}
      </div>
      {open && kit ? (
        <div className="page pb-5">
          <TxPanel kit={kit} tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "withdraw", args: [] }}
                   confirmText="Withdraw" onClose={() => setOpen(false)}
                   onDone={(o) => { if (o.successful && o.hash) announceConfirmed(o.hash, "Withdrawal"); }} />
        </div>
      ) : null}
    </div>
  );
}
