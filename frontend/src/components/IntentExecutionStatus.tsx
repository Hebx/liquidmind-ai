'use client';

export interface IntentWorkflowWarning {
  code: string;
  message: string;
}

export interface PreparedHookAction {
  actionId: string;
  coordinator: string;
  coordinatorCalldata: string;
  tickLower: number;
  tickUpper: number;
}

export interface PreparedFeeAction {
  actionId: string;
  coordinator: string;
  coordinatorCalldata: string;
  newFee: number;
  volatility: number;
}

export interface IntentWorkflowResult {
  status: 'prepared';
  hookAction: PreparedHookAction;
  feeAction?: PreparedFeeAction;
  warnings?: IntentWorkflowWarning[];
  [key: string]: unknown;
}

export interface IntentExecutionSuccess {
  intent: Record<string, unknown>;
  workflow: IntentWorkflowResult;
}

export interface IntentExecutionError {
  code: string;
  message: string;
}

interface IntentExecutionStatusProps {
  status: 'idle' | 'pending' | 'success' | 'error';
  result: IntentExecutionSuccess | null;
  error: IntentExecutionError | null;
}

function JsonPanel({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) {
  return (
    <div className="border-[var(--border-thin)] border-border p-3 bg-bg-primary/60">
      <div className="text-[10px] font-mono text-text-secondary mb-2">{label}</div>
      <pre className="overflow-x-auto text-xs font-mono text-text-primary whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-[var(--border-thin)] border-border p-3">
      <div className="text-[10px] font-mono text-text-secondary">{label}</div>
      <div className="text-xs font-mono text-text-primary text-right break-all">{value}</div>
    </div>
  );
}

export default function IntentExecutionStatus({
  status,
  result,
  error,
}: IntentExecutionStatusProps) {
  if (status === 'pending') {
    return (
      <div className="border-[var(--border-thin)] border-lime/40 bg-bg-primary/70 p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-mono text-text-secondary">PREPARING WORKFLOW OUTPUT</div>
          <div className="text-[10px] font-mono text-lime">PENDING</div>
        </div>
        <p className="mt-2 text-sm text-text-primary">
          Submitting the raw HTTP intent to <code>/api/intent</code> for parsing and prepared workflow output.
        </p>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="border-[var(--border-thin)] border-magenta/40 bg-bg-primary/70 p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-mono text-text-secondary">PREPARATION FAILED</div>
          <div className="text-[10px] font-mono text-magenta">{error.code}</div>
        </div>
        <p className="mt-2 text-sm text-text-primary">{error.message}</p>
        <p className="mt-3 text-xs font-mono text-text-secondary">
          Prepared workflow output only. No on-chain transaction is submitted from this UI.
        </p>
      </div>
    );
  }

  if (status === 'success' && result) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="border-[var(--border-thin)] border-lime/40 bg-bg-primary/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[10px] font-mono text-text-secondary">PREPARED WORKFLOW OUTPUT</div>
            <div className="text-[10px] font-mono text-lime">{result.workflow.status.toUpperCase()}</div>
          </div>
          <p className="mt-2 text-sm text-text-primary">
            Parsed canonical intent and prepared workflow output returned successfully.
          </p>
          <p className="mt-3 text-xs font-mono text-text-secondary">
            No on-chain transaction is submitted from this UI. These results are prepared outputs only.
          </p>
        </div>

        {result.workflow.warnings && result.workflow.warnings.length > 0 && (
          <div className="border-[var(--border-thin)] border-cyan/40 bg-bg-primary/70 p-4">
            <div className="text-[10px] font-mono text-text-secondary mb-2">WORKFLOW WARNINGS</div>
            <div className="space-y-2">
              {result.workflow.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.message}`} className="text-xs font-mono text-cyan">
                  [{warning.code}] {warning.message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-[var(--border-thin)] border-lime/40 bg-bg-primary/70 p-4">
          <div className="text-[10px] font-mono text-text-secondary mb-2">PREPARED ACTION METADATA</div>
          <div className="space-y-2">
            <MetadataRow label="HOOK ACTION ID" value={result.workflow.hookAction.actionId} />
            <MetadataRow label="COORDINATOR" value={result.workflow.hookAction.coordinator} />
            <MetadataRow
              label="COORDINATOR CALLDATA"
              value={result.workflow.hookAction.coordinatorCalldata}
            />
            <MetadataRow
              label="TICK RANGE"
              value={`${result.workflow.hookAction.tickLower} → ${result.workflow.hookAction.tickUpper}`}
            />
            {result.workflow.feeAction && (
              <>
                <MetadataRow label="FEE ACTION ID" value={result.workflow.feeAction.actionId} />
                <MetadataRow label="NEW FEE" value={`${result.workflow.feeAction.newFee}`} />
                <MetadataRow label="VOLATILITY" value={`${result.workflow.feeAction.volatility}`} />
              </>
            )}
          </div>
        </div>

        <JsonPanel label="PARSED CANONICAL INTENT" value={result.intent} />
        <JsonPanel label="PREPARED WORKFLOW OUTPUT" value={result.workflow} />
      </div>
    );
  }

  return (
    <div className="border-[var(--border-thin)] border-border bg-bg-primary/50 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[10px] font-mono text-text-secondary">READY TO PREPARE</div>
        <div className="text-[10px] font-mono text-text-muted">IDLE</div>
      </div>
      <p className="mt-2 text-sm text-text-primary">
        Submit a natural-language intent to parse it into canonical form and prepare the workflow payload.
      </p>
      <p className="mt-3 text-xs font-mono text-text-secondary">
        Prepared workflow output only. No on-chain transaction is submitted from this UI.
      </p>
    </div>
  );
}
