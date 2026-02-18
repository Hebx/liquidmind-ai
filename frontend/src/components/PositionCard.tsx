'use client';

import React from 'react';

interface PositionProps {
  pair: string;
  chain: string;
  value: string;
  apy: string;
  status: 'OPTIMIZED' | 'PENDING' | 'REBALANCING';
}

export default function PositionCard({ pair, chain, value, apy, status }: PositionProps) {
  const statusColors = {
    OPTIMIZED: 'bg-secondary/20 text-secondary border-secondary/50',
    PENDING: 'bg-primary/20 text-primary border-primary/50',
    REBALANCING: 'bg-accent/20 text-accent border-accent/50',
  };

  return (
    <div className="bg-dark/40 border border-white/5 p-5 rounded-xl transition-all hover:border-primary/30 group">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{pair}</h3>
          <p className="text-xs text-white/50">{chain}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded border ${statusColors[status]} font-bold`}>
          {status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-white/30 uppercase">Position Value</p>
          <p className="text-md font-mono text-white">{value}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 uppercase">Real-time APY</p>
          <p className="text-md font-mono text-secondary">{apy}</p>
        </div>
      </div>
    </div>
  );
}
