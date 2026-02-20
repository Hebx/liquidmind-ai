import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/DynamicProviders";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LIQUIDMIND | Autonomous Liquidity Execution",
  description: "AI agents for cross-chain DeFi liquidity management. Chainlink CRE, x402 payments, Uniswap v4 hooks.",
  keywords: ["DeFi", "AI agents", "liquidity", "Chainlink", "Uniswap v4", "x402"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body 
        className={`${bebasNeue.variable} ${jetbrainsMono.variable} ${plusJakarta.variable} antialiased bg-grid`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}