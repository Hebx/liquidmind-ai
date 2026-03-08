export type RiskTolerance = "low" | "medium" | "high";
export const SUPPORTED_EXECUTION_CHAIN = "base-sepolia";

export interface LiquidityIntentPayload {
  action?: "rebalance";
  tokenA: string;
  tokenB: string;
  amount: string;
  preferredChains: string[];
  riskTolerance: RiskTolerance;
  minYield: number;
}

export interface LiquidityIntent {
  action: "rebalance";
  tokenA: string;
  tokenB: string;
  amount: bigint;
  preferredChains: string[];
  riskTolerance: RiskTolerance;
  minYield: number;
}

interface NormalizeIntentOptions {
  fallbackToDefault?: boolean;
}

const VALID_RISK_TOLERANCES = new Set<RiskTolerance>(["low", "medium", "high"]);

export const DEFAULT_DEVELOPMENT_INTENT = {
  action: "rebalance",
  tokenA: "WETH",
  tokenB: "USDC",
  amount: "1000000",
  preferredChains: ["base-sepolia"],
  riskTolerance: "medium",
  minYield: 5,
} satisfies LiquidityIntentPayload;

export function normalizeIntentInput(
  input: unknown,
  options: NormalizeIntentOptions = {},
): LiquidityIntent {
  const candidate = resolveIntentCandidate(input, options);
  const action = normalizeAction(candidate.action);
  const tokenA = normalizeRequiredToken(candidate.tokenA, "tokenA");
  const tokenB = normalizeRequiredToken(candidate.tokenB, "tokenB");
  const amount = normalizeAmount(candidate.amount);
  const preferredChains = normalizePreferredChains(candidate.preferredChains);
  const riskTolerance = normalizeRiskTolerance(candidate.riskTolerance);
  const minYield = normalizeMinYield(candidate.minYield);

  return {
    action,
    tokenA,
    tokenB,
    amount,
    preferredChains,
    riskTolerance,
    minYield,
  };
}

export function normalizeWorkflowIntentInput(
  input: unknown,
  options: NormalizeIntentOptions = {},
): LiquidityIntent {
  return normalizeIntentInput(extractIntentPayload(input), options);
}

export function extractIntentPayload(input: unknown): unknown {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const candidate = input as Record<string, unknown>;
  for (const key of ["body", "payload", "intent"] as const) {
    if (candidate[key] != null) {
      return candidate[key];
    }
  }

  return input;
}

export function toIntentPayload(intent: LiquidityIntent): LiquidityIntentPayload {
  return {
    action: intent.action,
    tokenA: intent.tokenA,
    tokenB: intent.tokenB,
    amount: intent.amount.toString(),
    preferredChains: [...intent.preferredChains],
    riskTolerance: intent.riskTolerance,
    minYield: intent.minYield,
  };
}

function resolveIntentCandidate(
  input: unknown,
  options: NormalizeIntentOptions,
): Record<string, unknown> {
  if (input == null) {
    if (options.fallbackToDefault) {
      return DEFAULT_DEVELOPMENT_INTENT as unknown as Record<string, unknown>;
    }

    throw new Error("Missing intent payload");
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid intent payload: expected an object");
  }

  return input as Record<string, unknown>;
}

function normalizeAction(action: unknown): "rebalance" {
  if (action == null || action === "") {
    return "rebalance";
  }

  if (action !== "rebalance") {
    throw new Error("Invalid intent: only rebalance is supported in the canonical CRE flow");
  }

  return action;
}

function normalizeRequiredToken(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid intent: ${fieldName} must be a non-empty string`);
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    throw new Error(`Invalid intent: ${fieldName} must be a non-empty string`);
  }

  return normalized;
}

function normalizeAmount(value: unknown): bigint {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new Error("Invalid intent: amount must be positive");
    }

    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Invalid intent: amount must be an integer");
    }

    return normalizeAmount(String(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error("Invalid intent: amount must be a base-unit integer string");
    }

    const amount = BigInt(trimmed);
    if (amount <= 0n) {
      throw new Error("Invalid intent: amount must be positive");
    }

    return amount;
  }

  throw new Error("Invalid intent: amount must be a bigint, number, or base-unit integer string");
}

function normalizePreferredChains(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid intent: preferredChains must be a non-empty array");
  }

  const normalized = Array.from(
    new Set(
      value.map((chain) => {
        if (typeof chain !== "string") {
          throw new Error("Invalid intent: preferredChains entries must be strings");
        }

        const normalizedChain = chain.trim().toLowerCase();
        if (!normalizedChain) {
          throw new Error("Invalid intent: preferredChains entries must be non-empty strings");
        }

        return normalizedChain;
      }),
    ),
  );

  if (normalized.length === 0) {
    throw new Error("Invalid intent: preferredChains must be a non-empty array");
  }

  if (normalized.some((chain) => chain !== SUPPORTED_EXECUTION_CHAIN)) {
    throw new Error(
      `Invalid intent: only ${SUPPORTED_EXECUTION_CHAIN} is supported in this milestone`,
    );
  }

  return normalized;
}

function normalizeRiskTolerance(value: unknown): RiskTolerance {
  if (typeof value !== "string") {
    throw new Error("Invalid intent: riskTolerance must be low, medium, or high");
  }

  const normalized = value.trim().toLowerCase();
  if (!VALID_RISK_TOLERANCES.has(normalized as RiskTolerance)) {
    throw new Error("Invalid intent: riskTolerance must be low, medium, or high");
  }

  return normalized as RiskTolerance;
}

function normalizeMinYield(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid intent: minYield must be a finite number");
  }

  if (value < 0) {
    throw new Error("Invalid intent: minYield must be zero or greater");
  }

  return value;
}
