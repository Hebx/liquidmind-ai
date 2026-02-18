'use client';

import React from 'react';

const agents = [
  { name: 'LP Optimizer', status: 'Analyzing Pool Data', color: 'text-secondary' },
  { name: 'Risk Manager', status: 'Verifying Compliance', color: 'text-primary' },
  { name: 'Execution Agent', status: 'Waiting for Intent', color: 'text-accent' },
];

export default function AgentStatus() {
  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-md">
      <h2 className="text-xl font-bold text-accent mb-4 font-space">Agent Coordination</h2>
      <div className="space-y-4">
        {agents.map((agent) => (
          <div key={agent.name} className="flex items-center justify-between p-3 bg-dark/30 rounded-lg border border-white/5">
            <div>
              <p className="text-sm font-semibold text-white/80">{agent.name}</p>
              <p className={`text-xs ${agent.color} animate-pulse`}>{agent.status}</p>
            </div>
            <div className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(0,212,170,0.5)]"></div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
        <span className="text-[10px] text-white/30 uppercase tracking-widest">Protocol Health</span>
        <span className="text-[10px] text-secondary font-mono">SECURE</span>
      </div>
    </div>
  );
}
