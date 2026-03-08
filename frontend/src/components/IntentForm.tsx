'use client';

import React, { useState } from 'react';
import IntentExecutionStatus from '@/components/IntentExecutionStatus';

interface IntentWorkflowWarning {
  code: string;
  message: string;
}

interface IntentWorkflowResult {
  status: string;
  warnings?: IntentWorkflowWarning[];
  [key: string]: unknown;
}

interface IntentRouteSuccessResponse {
  ok: true;
  intent: Record<string, unknown>;
  workflow: IntentWorkflowResult;
}

interface IntentRouteErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

type IntentRouteResponse = IntentRouteSuccessResponse | IntentRouteErrorResponse;

export default function IntentForm() {
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<IntentRouteSuccessResponse | null>(null);
  const [error, setError] = useState<IntentRouteErrorResponse['error'] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!intent.trim()) {
      return;
    }

    setStatus('pending');
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/intent', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          rawIntent: intent.trim(),
        }),
      });
      const body = (await response.json()) as IntentRouteResponse;

      if (!response.ok || !body.ok) {
        const routeError = body.ok
          ? {
              code: 'INTERNAL_ERROR',
              message: 'Intent workflow preparation failed.',
            }
          : body.error;
        setError(routeError);
        setStatus('error');
        return;
      }

      setResult(body);
      setStatus('success');
    } catch {
      setError({
        code: 'NETWORK_ERROR',
        message: 'Intent preparation request failed before the server returned a response.',
      });
      setStatus('error');
    }
  };

  const handleReset = () => {
    setIntent('');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <div className="card-brutal-lime relative overflow-hidden scanlines">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl tracking-widest text-lime">HTTP INTENT PREP</h2>
          <div className="text-[10px] font-mono text-text-secondary">v5 · CRE · LIVE</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            className="w-full h-36 bg-bg-primary border-[var(--border-thick)] border-lime p-4 text-text-primary font-mono text-sm placeholder:text-text-muted focus:outline-none focus:ring-0"
            placeholder="Describe the intent to parse and prepare, for example: rebalance the Base Sepolia WETH/USDC position using medium risk settings."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="submit"
              className="btn-brutal-primary pulse-glow disabled:opacity-60"
              disabled={status === 'pending' || intent.trim().length === 0}
            >
              {status === 'pending' ? 'PREPARING...' : 'PREPARE HTTP INTENT'}
            </button>
            <button type="button" className="btn-brutal" onClick={handleReset}>
              CLEAR OUTPUT
            </button>
          </div>
        </form>

        <div className="mt-6">
          <IntentExecutionStatus status={status} result={result} error={error} />
        </div>

        <div className="mt-6 pt-4 border-t border-lime/30 flex items-center justify-between">
          <div className="text-[10px] font-mono text-text-secondary">
            HTTP INTENT ROUTE IS LIVE
          </div>
          <div className="text-[10px] font-mono text-lime">PREPARED ONLY</div>
        </div>
      </div>
    </div>
  );
}
