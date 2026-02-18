'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import IntentForm from '@/components/IntentForm';
import AgentStatus from '@/components/AgentStatus';
import PositionCard from '@/components/PositionCard';

export default function Home() {
  return (
    <main className="min-h-screen bg-dark text-light font-inter selection:bg-primary selection:text-white">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-dark/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white">L</div>
            <span className="text-2xl font-black font-space tracking-tighter text-white">LIQUIDMIND</span>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Input & Status */}
          <div className="lg:col-span-4 space-y-8">
            <section>
              <IntentForm />
            </section>
            <section>
              <AgentStatus />
            </section>
          </div>

          {/* Right Column: Positions & Analytics */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-black font-space text-white uppercase tracking-tight">Active Positions</h2>
                  <p className="text-white/40 text-sm">Managed by autonomous AI agents</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Total Value Managed</p>
                  <p className="text-2xl font-mono text-secondary">$142,069.42</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PositionCard 
                  pair="ETH/USDC" 
                  chain="Base Sepolia (Uniswap V4)" 
                  value="$84,200.00" 
                  apy="24.2%" 
                  status="OPTIMIZED" 
                />
                <PositionCard 
                  pair="LINK/ETH" 
                  chain="Arbitrum Sepolia" 
                  value="$57,869.42" 
                  apy="18.5%" 
                  status="REBALANCING" 
                />
              </div>

              <div className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center space-x-4">
                <div className="bg-primary p-2 rounded-lg">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Agent Insight</p>
                  <p className="text-[11px] text-white/60">Risk Manager suggests rebalancing LINK/ETH position due to increased volatility on Arbitrum Sepolia.</p>
                </div>
              </div>
            </div>

            {/* Verification Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-white/5 rounded-xl bg-dark/20 text-center">
                <p className="text-[10px] text-white/30 uppercase">Verifiable Execution</p>
                <p className="text-xs font-mono text-secondary mt-1">CHAINLINK CRE</p>
              </div>
              <div className="p-4 border border-white/5 rounded-xl bg-dark/20 text-center">
                <p className="text-[10px] text-white/30 uppercase">Autonomous Alignment</p>
                <p className="text-xs font-mono text-primary mt-1">X402 PROTOCOL</p>
              </div>
              <div className="p-4 border border-white/5 rounded-xl bg-dark/20 text-center">
                <p className="text-[10px] text-white/30 uppercase">Agent Identity</p>
                <p className="text-xs font-mono text-accent mt-1">VERIFIED AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Decoration */}
      <footer className="py-12 border-t border-white/5 opacity-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-space">LIQUIDMIND © 2026 — INTELLIGENT LIQUIDITY, AUTONOMOUS EXECUTION</p>
        </div>
      </footer>
    </main>
  );
}
