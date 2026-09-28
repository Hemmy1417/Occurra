/**
 * A write leaves through the CONNECTED wallet's provider, signed as the
 * connected account: the same createClient call lib/kit.ts makes, fed a
 * provider that records what it is asked. No key exists in the app.
 */
import { createClient } from "genlayer-js";
import { describe, expect, it } from "vitest";

import { STUDIO_NEXT } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";

const ACCOUNT = "0xa040709b6A2AEF280703B116427e0f7aDcFf17Eb";
const HASH = `0x${"ab".repeat(32)}`;

function recordingProvider() {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  let markSent: () => void = () => {};
  const sendSeen = new Promise<void>((resolve) => { markSent = resolve; });
  const provider = {
    async request({ method, params = [] }: { method: string; params?: unknown[] }) {
      calls.push({ method, params });
      if (method === "eth_sendTransaction") markSent();
      switch (method) {
        case "eth_chainId": return `0x${STUDIO_NEXT.id.toString(16)}`;
        case "eth_accounts": case "eth_requestAccounts": return [ACCOUNT];
        case "eth_sendTransaction": return HASH;
        case "eth_getTransactionCount": return "0x1";
        case "eth_estimateGas": return "0x5208";
        case "eth_gasPrice": case "eth_maxPriorityFeePerGas": return "0x0";
        case "eth_blockNumber": return "0x10";
        case "eth_getBlockByNumber": return { baseFeePerGas: "0x0", number: "0x10", timestamp: "0x1" };
        case "eth_call": return `0x${"0".repeat(64)}`;
        default: return null;
      }
    },
  };
  return { provider, calls, sendSeen };
}

describe("a write is signed by the connected wallet", () => {
  it("goes out as eth_sendTransaction from the connected account, never signed in the page", async () => {
    const { provider, calls, sendSeen } = recordingProvider();
    const client = createClient({ chain: { ...STUDIO_NEXT }, provider, account: ACCOUNT } as Parameters<typeof createClient>[0]);
    try {
      await Promise.race([
        client.writeContract({ address: CONTRACT_ADDRESS as `0x${string}`, functionName: "finalize",
                               args: ["cl-00001"], value: 0n }),
        // After the send the client waits on the network for a receipt; the
        // send itself is what this test is about, so stop as soon as it happens.
        sendSeen,
        new Promise((resolve) => setTimeout(resolve, 18_000)),
      ]);
    } catch {
      // Receipt parsing after the send may fail against a recording
      // provider; what matters is what was sent, and how.
    }
    const sent = calls.filter((c) => c.method === "eth_sendTransaction");
    expect(sent.length).toBe(1);
    const tx = sent[0]!.params[0] as { from: string; to: string; data: string };
    expect(tx.from.toLowerCase()).toBe(ACCOUNT.toLowerCase());
    expect(tx.data.length).toBeGreaterThan(10);
    expect(calls.some((c) => c.method === "eth_sign" || c.method === "eth_signTransaction")).toBe(false);
  }, 20_000);
});
