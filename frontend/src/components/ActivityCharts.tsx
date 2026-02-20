'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import type { SubgraphActivity } from '@/lib/subgraph';

const CHART_HEIGHT = 180;

type Props = {
  activity: SubgraphActivity;
};

function toNumber(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ActivityCharts({ activity }: Props) {
  const feeSeries = [...activity.feeUpdated]
    .reverse()
    .map((item, index) => ({
      index: index + 1,
      fee: toNumber(item.newFee),
      block: toNumber(item.blockNumber),
    }));

  const bucketSize = 50;
  const rebalanceBuckets = new Map<number, number>();
  activity.liquidityRebalanced.forEach((item) => {
    const block = toNumber(item.blockNumber);
    const bucket = Math.floor(block / bucketSize) * bucketSize;
    rebalanceBuckets.set(bucket, (rebalanceBuckets.get(bucket) ?? 0) + 1);
  });
  const rebalanceSeries = Array.from(rebalanceBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({
      bucket: `${bucket}–${bucket + bucketSize}`,
      count,
    }));

  const actionCounts: Record<string, number> = {};
  activity.agentActionExecuted.forEach((item) => {
    const key = item.actionType || 'Unknown';
    actionCounts[key] = (actionCounts[key] ?? 0) + 1;
  });
  const actionSeries = Object.entries(actionCounts).map(([type, count]) => ({ type, count }));

  return (
    <div className="card-brutal">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-2xl tracking-widest text-text-primary">ON-CHAIN ANALYTICS</h3>
        <span className="text-[10px] font-mono text-text-secondary">SUBGRAPH</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border-[var(--border-thin)] border-border p-4">
          <div className="text-[10px] font-mono text-text-secondary">FEE UPDATES (BPS)</div>
          {feeSeries.length === 0 ? (
            <div className="text-xs font-mono text-text-muted mt-4">No fee updates yet</div>
          ) : (
            <div className="mt-3" style={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Line type="monotone" dataKey="fee" stroke="var(--color-magenta)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="border-[var(--border-thin)] border-border p-4">
          <div className="text-[10px] font-mono text-text-secondary">REBALANCE FREQUENCY</div>
          {rebalanceSeries.length === 0 ? (
            <div className="text-xs font-mono text-text-muted mt-4">No rebalance events yet</div>
          ) : (
            <div className="mt-3" style={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rebalanceSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Bar dataKey="count" fill="var(--color-cyan)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="border-[var(--border-thin)] border-border p-4">
          <div className="text-[10px] font-mono text-text-secondary">AGENT ACTIONS</div>
          {actionSeries.length === 0 ? (
            <div className="text-xs font-mono text-text-muted mt-4">No agent actions yet</div>
          ) : (
            <div className="mt-3" style={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Bar dataKey="count" fill="var(--color-lime)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
