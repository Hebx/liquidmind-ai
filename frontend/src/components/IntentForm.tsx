'use client';

import React, { useState } from 'react';

export default function IntentForm() {
  const [intent, setIntent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitted Intent:', intent);
  };

  return (
    <div className="card-brutal-lime relative overflow-hidden scanlines">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl tracking-widest text-lime">CAPITAL INTENT</h2>
          <div className="text-[10px] font-mono text-text-secondary">v4 · CRE · x402</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            className="w-full h-36 bg-bg-primary border-[var(--border-thick)] border-lime p-4 text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-0"
            placeholder="Deploy 10 ETH to Base Sepolia, optimize for yield, high risk tolerance."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="submit" className="btn-brutal-primary pulse-glow">
              EXECUTE STRATEGY
            </button>
            <button type="button" className="btn-brutal">
              SIMULATE ROUTE
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-lime/30 flex items-center justify-between">
          <div className="text-[10px] font-mono text-text-secondary">
            VERIFIED EXECUTION PIPELINE
          </div>
          <div className="text-[10px] font-mono text-lime">READY</div>
        </div>
      </div>
    </div>
  );
}
