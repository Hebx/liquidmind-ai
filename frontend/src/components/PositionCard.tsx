'use client';

import React from 'react';

interface PositionProps {
  pair: string;
  chain: string;
  value: string;
  apy: string;
  status: 'OPTIMIZED' | 'PENDING' | 'REBALANCING';
}

const statusStyles = {
  OPTIMIZED: 'border-lime text-lime',
  PENDING: 'border-cyan text-cyan',
  REBALANCING: 'border-magenta text-magenta',
};

export default function PositionCard({ pair, chain, value, apy, status }: PositionProps) {
  return (
    <div className="card-brutal relative">
      <div className="absolute top-2 right-2 text-[10px] font-mono text-text-muted">#{pair.replace('/', '')}</div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-3xl tracking-wide text-text-primary">{pair}</h3>
          <p className="text-[10px] font-mono text-text-secondary uppercase">{chain}</p>
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 border-[var(--border-thin)] ${statusStyles[status]}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border-[var(--border-thin)] border-border p-3">
          <p className="text-[10px] font-mono text-text-muted uppercase">Value</p>
          <p className="text-lg font-mono text-text-primary">{value}</p>
        </div>
        <div className="border-[var(--border-thin)] border-border p-3">
          <p className="text-[10px] font-mono text-text-muted uppercase">APY</p>
          <p className="text-lg font-mono text-lime">{apy}</p>
        </div>
      </div>
    </div>
  );
}
