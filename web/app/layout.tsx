import type { Metadata } from "next";
import { Almarai, Fragment_Mono, Host_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

const almarai = Almarai({ subsets: ["arabic"], weight: ["300", "400"], variable: "--font-almarai", display: "swap" });
const host = Host_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-host", display: "swap" });
const fragment = Fragment_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-fragment", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Occurra", template: "%s · Occurra" },
  description:
    "Decentralized verification of real-world events. Sponsors define an event; claimants file evidence; "
    + "GenLayer validators decide whether it establishes the event occurred.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${almarai.variable} ${host.variable} ${fragment.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
