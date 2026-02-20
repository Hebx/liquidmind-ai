'use client';

import React from 'react';

interface PositionProps {
  poolId: string;
  chain: string;
  range: string;
  feeBps: string;
  status: 'OPTIMIZED' | 'PENDING' | 'REBALANCING';
}

const statusStyles = {
  OPTIMIZED: 'border-lime text-lime',
  PENDING: 'border-cyan text-cyan',
  REBALANCING: 'border-magenta text-magenta',
};

export default function PositionCard({ poolId, chain, range, feeBps, status }: PositionProps) {
  const poolShort = `${poolId.slice(0, 6)}…${poolId.slice(-4)}`;
  return (
    <div className="card-brutal relative">
      <div className="absolute top-2 right-2 text-[10px] font-mono text-text-muted">#{poolShort}</div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-3xl tracking-wide text-text-primary">POOL {poolShort}</h3>
          <p className="text-[10px] font-mono text-text-secondary uppercase">{chain}</p>
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 border-[var(--border-thin)] ${statusStyles[status]}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border-[var(--border-thin)] border-border p-3">
          <p className="text-[10px] font-mono text-text-muted uppercase">Range</p>
          <p className="text-lg font-mono text-text-primary">{range}</p>
        </div>
        <div className="border-[var(--border-thin)] border-border p-3">
          <p className="text-[10px] font-mono text-text-muted uppercase">Fee</p>
          <p className="text-lg font-mono text-lime">{feeBps}</p>
        </div>
      </div>
    </div>
  );
}
