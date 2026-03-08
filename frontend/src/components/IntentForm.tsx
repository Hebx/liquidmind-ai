'use client';

import React, { useRef, useState } from 'react';
import IntentExecutionStatus from '@/components/IntentExecutionStatus';
import type {
  IntentExecutionError,
  IntentExecutionSuccess,
  IntentWorkflowResult,
  PreparedFeeAction,
  PreparedHookAction,
} from '@/components/IntentExecutionStatus';

interface IntentRouteSuccessResponse extends IntentExecutionSuccess {
  ok: true;
}

interface IntentRouteErrorResponse {
  ok: false;
  error: IntentExecutionError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIntentExecutionError(value: unknown): value is IntentExecutionError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

function isIntentWorkflowWarning(value: unknown): value is IntentWorkflowResult['warnings'][number] {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

function isPreparedHookAction(value: unknown): value is PreparedHookAction {
  return (
    isRecord(value) &&
    typeof value.actionId === 'string' &&
    typeof value.coordinator === 'string' &&
    typeof value.coordinatorCalldata === 'string' &&
    typeof value.tickLower === 'number' &&
    typeof value.tickUpper === 'number'
  );
}

function isPreparedFeeAction(value: unknown): value is PreparedFeeAction {
  return (
    isRecord(value) &&
    typeof value.actionId === 'string' &&
    typeof value.coordinator === 'string' &&
    typeof value.coordinatorCalldata === 'string' &&
    typeof value.newFee === 'number' &&
    typeof value.volatility === 'number'
  );
}

function isIntentWorkflowResult(value: unknown): value is IntentWorkflowResult {
  return (
    isRecord(value) &&
    value.status === 'prepared' &&
    isPreparedHookAction(value.hookAction) &&
    (value.feeAction === undefined || isPreparedFeeAction(value.feeAction)) &&
    (value.warnings === undefined ||
      (Array.isArray(value.warnings) && value.warnings.every(isIntentWorkflowWarning)))
  );
}

function isIntentRouteSuccessResponse(value: unknown): value is IntentRouteSuccessResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    isRecord(value.intent) &&
    isIntentWorkflowResult(value.workflow)
  );
}

function isIntentRouteErrorResponse(value: unknown): value is IntentRouteErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isIntentExecutionError(value.error)
  );
}

export default function IntentForm() {
  const [intent, setIntent] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<IntentRouteSuccessResponse | null>(null);
  const [error, setError] = useState<IntentRouteErrorResponse['error'] | null>(null);
  const latestRequestIdRef = useRef(0);

  const clearExecutionState = (invalidateInFlightRequest = false) => {
    if (invalidateInFlightRequest) {
      latestRequestIdRef.current += 1;
    }

    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!intent.trim()) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setStatus('pending');
    setResult(null);
    setError(null);

    let response: Response;

    try {
      response = await fetch('/api/intent', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          rawIntent: intent,
        }),
      });
    } catch {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setError({
        code: 'NETWORK_ERROR',
        message: 'Intent preparation request failed before the server returned a response.',
      });
      setStatus('error');
      return;
    }

    if (requestId !== latestRequestIdRef.current) {
      return;
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setError({
        code: 'RESPONSE_PARSE_ERROR',
        message: 'Intent route returned an unreadable response.',
      });
      setStatus('error');
      return;
    }

    if (requestId !== latestRequestIdRef.current) {
      return;
    }

    if (isIntentRouteSuccessResponse(body)) {
      if (!response.ok) {
        setError({
          code: 'RESPONSE_SHAPE_ERROR',
          message: 'Intent route returned an unexpected response shape.',
        });
        setStatus('error');
        return;
      }

      setResult(body);
      setStatus('success');
      return;
    }

    if (isIntentRouteErrorResponse(body)) {
      const routeError = response.ok
        ? {
            code: 'RESPONSE_SHAPE_ERROR',
            message: 'Intent route returned an unexpected response shape.',
          }
        : body.error;
      setError(routeError);
      setStatus('error');
      return;
    }

    setError({
      code: 'RESPONSE_SHAPE_ERROR',
      message: 'Intent route returned an unexpected response shape.',
    });
    setStatus('error');
  };

  const handleReset = () => {
    setIntent('');
    clearExecutionState(true);
  };

  const handleIntentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIntent(e.target.value);

    if (status !== 'idle' || result !== null || error !== null) {
      clearExecutionState(true);
    }
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
            onChange={handleIntentChange}
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
