'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import IntentForm from '@/components/IntentForm';
import AgentStatus from '@/components/AgentStatus';
import PositionCard from '@/components/PositionCard';

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b-[var(--border-thick)] border-border bg-bg-primary/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 border-[var(--border-thick)] border-lime flex items-center justify-center font-display text-2xl text-lime">L</div>
            <div>
              <div className="font-display text-3xl tracking-widest glitch" data-text="LIQUIDMIND">
                LIQUIDMIND
              </div>
              <div className="text-[10px] font-mono text-text-secondary">AUTONOMOUS LIQUIDITY ENGINE</div>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Marquee */}
      <div className="overflow-hidden border-b border-border bg-bg-secondary">
        <div className="flex whitespace-nowrap animate-marquee py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-8 text-xs font-mono text-text-secondary">
              <span>CHAINLINK CRE · VERIFIED EXECUTION</span>
              <span>UNISWAP V4 HOOKS · DYNAMIC FEES</span>
              <span>X402 · PAY-PER-EXECUTION</span>
              <span>A2A AGENT SWARM · LIVE</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-display text-7xl leading-[0.9] text-stroke-lime">
              INTENT →
              <br />
              EXECUTION
            </h1>
            <p className="text-lg text-text-secondary max-w-xl">
              An autonomous liquidity machine that converts your intent into verifiable on-chain execution.
              Powered by Chainlink CRE workflows, Uniswap v4 hooks, and x402 escrow.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="btn-brutal-primary">DEPLOY TO BASE</button>
              <button className="btn-brutal">VIEW AGENT LOGS</button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="card-brutal relative overflow-hidden">
              <div className="text-[10px] font-mono text-text-muted">EXECUTION RAIL</div>
              <div className="mt-6 space-y-4">
                {[
                  { step: 'INTENT PARSE', status: 'OK', color: 'text-lime' },
                  { step: 'RISK MODEL', status: '58/100', color: 'text-cyan' },
                  { step: 'ROUTE BUILD', status: '2 CHAINS', color: 'text-magenta' },
                  { step: 'ESCROW', status: 'LOCKED', color: 'text-lime' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center justify-between border-[var(--border-thin)] border-border p-3">
                    <span className="text-xs font-mono text-text-secondary">{s.step}</span>
                    <span className={`text-xs font-mono ${s.color}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left column */}
          <div className="lg:col-span-4 space-y-8">
            <IntentForm />
            <AgentStatus />
          </div>

          {/* Right column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="card-brutal-lime">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="font-display text-4xl tracking-widest text-lime">ACTIVE POSITIONS</h2>
                  <p className="text-[10px] font-mono text-text-secondary">MANAGED BY AUTONOMOUS AGENTS</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-text-muted uppercase">Total Value</p>
                  <p className="text-2xl font-mono text-lime">$142,069.42</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PositionCard pair="ETH/USDC" chain="Base Sepolia · Uniswap v4" value="$84,200" apy="24.2%" status="OPTIMIZED" />
                <PositionCard pair="LINK/ETH" chain="Arbitrum Sepolia" value="$57,869" apy="18.5%" status="REBALANCING" />
              </div>

              <div className="mt-6 border-[var(--border-thin)] border-lime/40 p-4">
                <div className="text-[10px] font-mono text-text-secondary">AGENT INSIGHT</div>
                <p className="text-sm text-text-primary mt-2">
                  Risk Manager suggests rebalancing LINK/ETH due to volatility spike on Arbitrum Sepolia.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">Execution</p>
                <p className="text-sm font-mono text-cyan mt-2">CHAINLINK CRE</p>
              </div>
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">Escrow</p>
                <p className="text-sm font-mono text-lime mt-2">X402 PROTOCOL</p>
              </div>
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">Identity</p>
                <p className="text-sm font-mono text-magenta mt-2">VERIFIED AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t-[var(--border-thick)] border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="text-xs font-mono text-text-secondary">LIQUIDMIND © 2026</div>
          <div className="text-xs font-mono text-text-muted">INTELLIGENT LIQUIDITY · AUTONOMOUS EXECUTION</div>
        </div>
      </footer>
    </main>
  );
}
