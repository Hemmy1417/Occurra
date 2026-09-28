"use client";

/**
 * The wallet, as one button at the right of the header. The connected
 * address is machine text and never reaches the page surface: it is shown
 * inside the menu, where somebody has asked which account is about to sign.
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "./bits";
import { useWallet } from "@/lib/wallet";

export function WalletDock() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (w.restoring) return <span className="t-label text-smoke">Reconnecting</span>;

  const menu = "absolute right-0 top-[calc(100%+8px)] z-20 w-[300px] hair bg-canvas p-5";

  if (w.address) {
    return (
      <div className="relative" ref={box}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                className="t-label rounded-[4px] border border-graphite px-4 py-2.5 text-obsidian hover:bg-haze">
          {w.chainOk ? "Wallet connected" : "Wrong network"}
        </button>
        {open ? (
          <div className={menu}>
            <p className="t-label text-smoke">Signing as</p>
            <p className="t-mono mt-1 break-all text-obsidian">{w.address}</p>
            {!w.chainOk ? (
              <div className="mt-4">
                <p className="t-small mb-2 text-graphite">This wallet is on another network, so it cannot sign here.</p>
                <Button variant="secondary" onClick={() => void w.switchNetwork()}>Switch to Studio Next</Button>
              </div>
            ) : null}
            <div className="mt-4">
              <Button variant="secondary" onClick={() => { w.disconnect(); setOpen(false); }}>Disconnect</Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Button onClick={() => setOpen((v) => !v)} disabled={w.connecting}>
        {w.connecting ? "Connecting" : "Connect wallet"}
      </Button>
      {open ? (
        <div className={menu}>
          {w.wallets.length === 0 ? (
            <p className="t-small text-graphite">
              No wallet was offered to this page. Install one that speaks to GenLayer, then reload.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {w.wallets.map((d) => (
                <li key={d.info.rdns ?? d.info.uuid}>
                  <button type="button" onClick={() => { void w.connect(d); setOpen(false); }}
                          className="t-small flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left text-obsidian hover:bg-haze">
                    {d.info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.info.icon} alt="" width={20} height={20} aria-hidden="true" />
                    ) : null}
                    {d.info.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {w.error ? <p className="t-small mt-3 text-obsidian">{w.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
