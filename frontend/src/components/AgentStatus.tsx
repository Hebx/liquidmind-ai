'use client';

import React from 'react';

const agents = [
  { name: 'ROUTE OPTIMIZER', status: 'Mapping pools', color: 'text-cyan', pulse: 'bg-cyan' },
  { name: 'RISK ANALYZER', status: 'Stability check', color: 'text-magenta', pulse: 'bg-magenta' },
  { name: 'YIELD AGGREGATOR', status: 'APY scan', color: 'text-lime', pulse: 'bg-lime' },
];

export default function AgentStatus() {
  return (
    <div className="card-brutal-cyan relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-20 h-20 border-[var(--border-thick)] border-cyan opacity-20" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl tracking-widest text-cyan">AGENT SWARM</h2>
          <div className="text-[10px] font-mono text-text-secondary">A2A · LIVE</div>
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
                <span className="text-[10px] font-mono text-text-muted">ACTIVE</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-cyan/30 flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-secondary">PROTOCOL HEALTH</span>
          <span className="text-[10px] font-mono text-cyan">SECURE</span>
        </div>
      </div>
    </div>
  );
}
