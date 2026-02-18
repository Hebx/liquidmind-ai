'use client';

import React, { useState } from 'react';

export default function IntentForm() {
  const [intent, setIntent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitted Intent:', intent);
    // Here we would call the agent coordinator
  };

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-md">
      <h2 className="text-xl font-bold text-secondary mb-4 font-space">Capital Intent</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full h-32 bg-dark/50 border border-white/10 rounded-xl p-4 text-light focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
          placeholder="e.g., Deploy 10 ETH to Base Sepolia Uniswap V4, optimize for yield with high risk tolerance."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />
        <button
          type="submit"
          className="mt-4 w-full bg-primary hover:bg-primary/80 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-primary/20"
        >
          Execute Autonomous Strategy
        </button>
      </form>
      <p className="text-xs text-white/40 mt-3 text-center">
        Verification provided by Chainlink CRE & Verifiable AI Workflow
      </p>
    </div>
  );
}
