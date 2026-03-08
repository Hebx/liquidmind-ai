'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useRef, useState } from 'react';
import IntentForm from '@/components/IntentForm';
import AgentStatus from '@/components/AgentStatus';
import PositionCard from '@/components/PositionCard';
import ActivityCharts from '@/components/ActivityCharts';
import { fetchActivity, fetchMetaBlock, fetchPositions, SubgraphActivity, SubgraphPosition } from '@/lib/subgraph';

type Overview = {
  ok: boolean;
  blockNumber?: string;
  coordinatorDeployed?: boolean;
  hookDeployed?: boolean;
  agentCount?: string;
  localHook?: string;
  hookOwner?: string;
  hookCoordinator?: string;
  coordinatorAddress?: string;
  hookAddress?: string;
};

export default function Home() {
  const [overview, setOverview] = useState<Overview>({ ok: false });
  const [activity, setActivity] = useState<SubgraphActivity | null>(null);
  const [positions, setPositions] = useState<SubgraphPosition[] | null>(null);
  const [metaBlock, setMetaBlock] = useState<number | null>(null);
  const [chainHead, setChainHead] = useState<number | null>(null);
  const lastMetaBlockRef = useRef<number | null>(null);
  const lastActivityBlockRef = useRef<number>(0);
  const lastPositionsBlockRef = useRef<number>(0);
  const [lastEventBlock, setLastEventBlock] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/overview')
      .then((res) => res.json())
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch(() => {
        if (active) setOverview({ ok: false });
      });

    fetch('/api/chain-head')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.ok) setChainHead(Number(data.blockNumber));
      })
      .catch(() => {
        if (active) setChainHead(null);
      });

    const refreshAll = async () => {
      const meta = await fetchMetaBlock();
      if (meta !== null && meta === lastMetaBlockRef.current) return;
      if (meta !== null) {
        lastMetaBlockRef.current = meta;
        setMetaBlock(meta);
      }

      fetchActivity(lastActivityBlockRef.current)
        .then((data) => {
          if (!active || !data) return;
          const maxBlock = Math.max(
            lastActivityBlockRef.current,
            ...data.liquidityRebalanced.map((d) => Number(d.blockNumber)),
            ...data.feeUpdated.map((d) => Number(d.blockNumber)),
            ...data.agentActionExecuted.map((d) => Number(d.blockNumber)),
            ...data.messageSent.map((d) => Number(d.blockNumber))
          );
          lastActivityBlockRef.current = Number.isFinite(maxBlock) ? maxBlock : lastActivityBlockRef.current;
          setLastEventBlock(
            Math.max(lastActivityBlockRef.current, lastPositionsBlockRef.current) || null
          );
          setActivity((prev) => {
            if (!prev) return data;
            const merge = <T extends { id: string }>(a: T[], b: T[]) => {
              const map = new Map<string, T>();
              a.forEach((item) => map.set(item.id, item));
              b.forEach((item) => map.set(item.id, item));
              return Array.from(map.values()).sort((x, y) => Number(y.blockNumber) - Number(x.blockNumber));
            };
            return {
              liquidityRebalanced: merge(prev.liquidityRebalanced, data.liquidityRebalanced),
              feeUpdated: merge(prev.feeUpdated, data.feeUpdated),
              agentActionExecuted: merge(prev.agentActionExecuted, data.agentActionExecuted),
              messageSent: merge(prev.messageSent, data.messageSent),
            };
          });
        })
        .catch(() => {
          if (active) setActivity(null);
        });

      fetchPositions(lastPositionsBlockRef.current)
        .then((data) => {
          if (!active || !data) return;
          const maxBlock = Math.max(
            lastPositionsBlockRef.current,
            ...data.map((d) => Number(d.blockNumber))
          );
          lastPositionsBlockRef.current = Number.isFinite(maxBlock) ? maxBlock : lastPositionsBlockRef.current;
          setLastEventBlock(
            Math.max(lastActivityBlockRef.current, lastPositionsBlockRef.current) || null
          );
          setPositions((prev) => {
            if (!prev) return data;
            const map = new Map<string, SubgraphPosition>();
            prev.forEach((item) => map.set(item.poolId, item));
            data.forEach((item) => map.set(item.poolId, item));
            return Array.from(map.values()).sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
          });
        })
        .catch(() => {
          if (active) setPositions(null);
        });
    };

    refreshAll();

    const interval = setInterval(() => {
      refreshAll();
      fetch('/api/chain-head')
        .then((res) => res.json())
        .then((data) => {
          if (active && data.ok) setChainHead(Number(data.blockNumber));
        })
        .catch(() => {
          if (active) setChainHead(null);
        });
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b-[var(--border-thick)] border-border bg-bg-primary/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 border-[var(--border-thick)] border-lime flex items-center justify-center font-display text-2xl text-lime">L</div>
            <div>
              <div className="font-display text-3xl tracking-widest glitch" data-text="LIQUIDMIND">
                LIQUIDMIND
              </div>
              <div className="text-[10px] font-mono text-text-secondary">AUTONOMOUS LIQUIDITY ENGINE</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-mono text-text-muted">
              BLOCK {overview.blockNumber ?? '—'}
            </div>
            <div className="text-[10px] font-mono text-cyan border-[var(--border-thin)] border-cyan px-2 py-1">
              SUBGRAPH {metaBlock ?? '—'}
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="overflow-hidden border-b border-border bg-bg-secondary">
        <div className="flex whitespace-nowrap animate-marquee py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-8 text-xs font-mono text-text-secondary">
              <span>CHAINLINK CRE · REAL READS</span>
              <span>UNISWAP V4 HOOKS · DYNAMIC FEES</span>
              <span>HTTP INTENT FLOW · LIVE PREPARATION</span>
              <span>BASE SEPOLIA · LIVE CONTRACTS</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-display text-7xl leading-[0.9] text-stroke-lime">
              READS →
              <br />
              AUTOMATION
            </h1>
            <p className="text-lg text-text-secondary max-w-xl">
              Live today: real Chainlink reads, Base Sepolia coordinator plus hook automation, and HTTP
              intent intake with AI parsing into prepared workflow output.
              This route does not submit on-chain transactions from the dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="btn-brutal-primary">VIEW BASE STATUS</button>
              <button className="btn-brutal">VIEW ACTIVITY LOGS</button>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="card-brutal relative overflow-hidden">
              <div className="text-[10px] font-mono text-text-muted">EXECUTION RAIL</div>
              <div className="mt-6 space-y-4">
                {[
                  { step: 'CHAINLINK READS', status: overview.ok ? 'READY' : 'SYNCING', color: 'text-lime' },
                  { step: 'COORDINATOR', status: overview.coordinatorDeployed ? 'LIVE' : 'OFFLINE', color: 'text-cyan' },
                  { step: 'HOOK', status: overview.hookDeployed ? 'LIVE' : 'OFFLINE', color: 'text-magenta' },
                  { step: 'HTTP FLOW', status: 'PREPARED', color: 'text-lime' },
                ].map((s) => (
                  <div key={s.step} className="flex items-center justify-between border-[var(--border-thin)] border-border p-3">
                    <span className="text-xs font-mono text-text-secondary">{s.step}</span>
                    <span className={`text-xs font-mono ${s.color}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left column */}
          <div className="lg:col-span-4 space-y-8">
            <IntentForm />
            <AgentStatus agentCount={overview.agentCount} coordinator={overview.coordinatorAddress} />
          </div>

          {/* Right column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="card-brutal-lime">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="font-display text-4xl tracking-widest text-lime">ACTIVE POSITIONS</h2>
                  <p className="text-[10px] font-mono text-text-secondary">MANAGED BY COORDINATOR + HOOK</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-text-muted uppercase">Active Pools</p>
                  <p className="text-2xl font-mono text-lime">{positions ? positions.length : '—'}</p>
                </div>
              </div>

              {!positions && (
                <div className="text-xs font-mono text-text-muted">Waiting for position data…</div>
              )}

              {positions && positions.length === 0 && (
                <div className="text-xs font-mono text-text-muted">No positions yet</div>
              )}

              {positions && positions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {positions.slice(0, 4).map((position) => (
                    <PositionCard
                      key={position.poolId}
                      poolId={position.poolId}
                      chain={`Base Sepolia · ${overview.hookAddress ? 'Hook Live' : 'Hook Pending'}`}
                      range={`${position.tickLower} → ${position.tickUpper}`}
                      feeBps={position.feeBps}
                      status={position.feeBps === '—' ? 'REBALANCING' : 'OPTIMIZED'}
                    />
                  ))}
                </div>
              )}

              <div className="mt-6 border-[var(--border-thin)] border-lime/40 p-4">
                <div className="text-[10px] font-mono text-text-secondary">SYSTEM INSIGHT</div>
                <p className="text-sm text-text-primary mt-2">
                  Hook owner: {overview.hookOwner ? overview.hookOwner.slice(0, 6) + '…' + overview.hookOwner.slice(-4) : '—'} ·
                  Coordinator: {overview.hookCoordinator ? overview.hookCoordinator.slice(0, 6) + '…' + overview.hookCoordinator.slice(-4) : '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">Execution</p>
                <p className="text-sm font-mono text-cyan mt-2">CHAINLINK CRE</p>
              </div>
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">Intent Flow</p>
                <p className="text-sm font-mono text-lime mt-2">HTTP INTENT FLOW (LIVE)</p>
              </div>
              <div className="card-brutal">
                <p className="text-[10px] font-mono text-text-muted uppercase">AI Parser</p>
                <p className="text-sm font-mono text-magenta mt-2">LIVE · PREPARES OUTPUT</p>
              </div>
            </div>

            <div className="card-brutal">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-2xl tracking-widest text-text-primary">SYSTEM HEALTH</h3>
                <span className="text-[10px] font-mono text-text-secondary">BASE SEPOLIA</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border-[var(--border-thin)] border-border p-3">
                  <div className="text-[10px] font-mono text-text-muted">COORDINATOR</div>
                  <div className={`text-xs font-mono ${overview.coordinatorDeployed ? 'text-lime' : 'text-magenta'}`}>
                    {overview.coordinatorDeployed ? 'ONLINE' : 'OFFLINE'}
                  </div>
                </div>
                <div className="border-[var(--border-thin)] border-border p-3">
                  <div className="text-[10px] font-mono text-text-muted">HOOK</div>
                  <div className={`text-xs font-mono ${overview.hookDeployed ? 'text-lime' : 'text-magenta'}`}>
                    {overview.hookDeployed ? 'ONLINE' : 'OFFLINE'}
                  </div>
                </div>
                <div className="border-[var(--border-thin)] border-border p-3">
                  <div className="text-[10px] font-mono text-text-muted">SUBGRAPH</div>
                  <div className="text-xs font-mono text-cyan">BLOCK {metaBlock ?? '—'}</div>
                  <div className="text-[10px] font-mono text-text-muted mt-1">
                    LAG {metaBlock && chainHead ? Math.max(chainHead - metaBlock, 0) : '—'}
                  </div>
                </div>
                <div className="border-[var(--border-thin)] border-border p-3">
                  <div className="text-[10px] font-mono text-text-muted">LAST EVENT</div>
                  <div className="text-xs font-mono text-text-secondary">
                    {lastEventBlock ?? '—'}
                  </div>
                </div>
              </div>
            </div>

            {activity ? (
              <ActivityCharts activity={activity} />
            ) : (
              <div className="card-brutal">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-2xl tracking-widest text-text-primary">ON-CHAIN ANALYTICS</h3>
                  <span className="text-[10px] font-mono text-text-secondary">SUBGRAPH</span>
                </div>
                <div className="text-xs font-mono text-text-muted">Waiting for subgraph data…</div>
              </div>
            )}

            <div className="card-brutal-cyan">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-2xl tracking-widest text-cyan">RECENT ACTIVITY</h3>
                <span className="text-[10px] font-mono text-text-secondary">SUBGRAPH</span>
              </div>

              {!activity && (
                <div className="text-xs font-mono text-text-muted">Waiting for subgraph data…</div>
              )}

              {activity && (
                <div className="space-y-4">
                  <div className="border-[var(--border-thin)] border-cyan/40 p-3">
                    <div className="text-[10px] font-mono text-text-secondary">LIQUIDITY REBALANCED</div>
                    {activity.liquidityRebalanced.length === 0 && (
                      <div className="text-xs font-mono text-text-muted">No events yet</div>
                    )}
                    {activity.liquidityRebalanced.map((item) => (
                      <div key={item.id} className="text-xs font-mono text-cyan mt-2">
                        Pool {item.poolId.slice(0, 6)}… • {item.newTickLower} → {item.newTickUpper}
                      </div>
                    ))}
                  </div>

                  <div className="border-[var(--border-thin)] border-magenta/40 p-3">
                    <div className="text-[10px] font-mono text-text-secondary">FEE UPDATES</div>
                    {activity.feeUpdated.length === 0 && (
                      <div className="text-xs font-mono text-text-muted">No events yet</div>
                    )}
                    {activity.feeUpdated.map((item) => (
                      <div key={item.id} className="text-xs font-mono text-magenta mt-2">
                        Pool {item.poolId.slice(0, 6)}… → {item.newFee} bps
                      </div>
                    ))}
                  </div>

                  <div className="border-[var(--border-thin)] border-lime/40 p-3">
                    <div className="text-[10px] font-mono text-text-secondary">AGENT ACTIONS</div>
                    {activity.agentActionExecuted.length === 0 && (
                      <div className="text-xs font-mono text-text-muted">No events yet</div>
                    )}
                    {activity.agentActionExecuted.map((item) => (
                      <div key={item.id} className="text-xs font-mono text-lime mt-2">
                        {item.actionType} • {item.actionId.slice(0, 8)}…
                      </div>
                    ))}
                  </div>

                  <div className="border-[var(--border-thin)] border-border p-3">
                    <div className="text-[10px] font-mono text-text-secondary">MESSAGES</div>
                    {activity.messageSent.length === 0 && (
                      <div className="text-xs font-mono text-text-muted">No events yet</div>
                    )}
                    {activity.messageSent.map((item) => (
                      <div key={item.id} className="text-xs font-mono text-text-primary mt-2">
                        → Chain {item.destinationChainSelector} · Fees {item.fees}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t-[var(--border-thick)] border-border py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="text-xs font-mono text-text-secondary">LIQUIDMIND © 2026</div>
          <div className="text-xs font-mono text-text-muted">
            COORDINATOR {overview.coordinatorAddress ? overview.coordinatorAddress.slice(0, 6) + '…' + overview.coordinatorAddress.slice(-4) : '—'} ·
            HOOK {overview.hookAddress ? overview.hookAddress.slice(0, 6) + '…' + overview.hookAddress.slice(-4) : '—'}
          </div>
        </div>
      </footer>
    </main>
  );
}
