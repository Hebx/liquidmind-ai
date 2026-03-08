'use client';

import React from 'react';

const agents = [
  { name: 'ROUTE OPTIMIZER', status: 'Simulation placeholder', color: 'text-cyan', pulse: 'bg-cyan' },
  { name: 'RISK ANALYZER', status: 'Simulation placeholder', color: 'text-magenta', pulse: 'bg-magenta' },
  { name: 'YIELD AGGREGATOR', status: 'Simulation placeholder', color: 'text-lime', pulse: 'bg-lime' },
];

type AgentStatusProps = {
  agentCount?: string;
  coordinator?: string;
};

export default function AgentStatus({ agentCount, coordinator }: AgentStatusProps) {
  return (
    <div className="card-brutal-cyan relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-20 h-20 border-[var(--border-thick)] border-cyan opacity-20" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl tracking-widest text-cyan">STRATEGY MODULES</h2>
          <div className="text-[10px] font-mono text-text-secondary">PREVIEW · DEFERRED</div>
        </div>

        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center justify-between border-[var(--border-thin)] border-cyan/30 p-3">
              <div>
                <p className="text-xs font-mono text-text-secondary">{agent.name}</p>
                <p className={`text-sm font-bold ${agent.color}`}>{agent.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 ${agent.pulse} pulse-glow`} />
                <span className="text-[10px] font-mono text-text-muted">NOT LIVE</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-cyan/30 flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-secondary">COORDINATOR</span>
          <span className="text-[10px] font-mono text-cyan">
            {coordinator ? coordinator.slice(0, 6) + '…' + coordinator.slice(-4) : 'UNSYNCED'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-secondary">REGISTRY COUNT</span>
          <span className="text-[10px] font-mono text-lime">{agentCount ?? '0'}</span>
        </div>
      </div>
    </div>
  );
}
