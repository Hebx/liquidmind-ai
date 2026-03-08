'use client';

import React, { useState } from 'react';

export default function IntentForm() {
  const [intent, setIntent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Captured HTTP intent draft:', intent);
  };

  return (
    <div className="card-brutal-lime relative overflow-hidden scanlines">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl tracking-widest text-lime">HTTP INTENT PREVIEW</h2>
          <div className="text-[10px] font-mono text-text-secondary">v4 · CRE · NEXT</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            className="w-full h-36 bg-bg-primary border-[var(--border-thick)] border-lime p-4 text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-0"
            placeholder="Draft the upcoming HTTP intent flow, for example: rebalance the Base Sepolia WETH/USDC position using medium risk settings."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="submit" className="btn-brutal-primary pulse-glow">
              SAVE INTENT DRAFT
            </button>
            <button type="button" className="btn-brutal">
              SIMULATE CURRENT FLOW
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-lime/30 flex items-center justify-between">
          <div className="text-[10px] font-mono text-text-secondary">
            HTTP INTENT UX IS PREVIEW-ONLY
          </div>
          <div className="text-[10px] font-mono text-lime">UPCOMING</div>
        </div>
      </div>
    </div>
  );
}
