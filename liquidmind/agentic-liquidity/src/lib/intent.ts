export type RiskTolerance = "low" | "medium" | "high";
export const SUPPORTED_EXECUTION_CHAIN = "base-sepolia";
const SUPPORTED_ASSET_PAIR = ["USDC", "WETH"] as const;
const WRAPPER_KEYS = ["body", "payload", "intent"] as const;
const MAX_WRAPPER_DEPTH = 5;

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
  validateSupportedAssetPair(tokenA, tokenB);
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
  return unwrapIntentPayload(input, 0);
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

function parseWrappedPayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function unwrapIntentPayload(value: unknown, depth: number): unknown {
  if (depth >= MAX_WRAPPER_DEPTH) {
    return value;
  }

  const parsedValue = parseWrappedPayload(value);
  if (parsedValue == null || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return parsedValue;
  }

  if (isUsableIntentPayloadCandidate(parsedValue)) {
    return parsedValue;
  }

  const candidate = parsedValue as Record<string, unknown>;
  let fallbackValue: unknown = parsedValue;
  for (const key of WRAPPER_KEYS) {
    if (candidate[key] != null) {
      const unwrappedValue = unwrapIntentPayload(candidate[key], depth + 1);
      if (isUsableIntentPayloadCandidate(unwrappedValue)) {
        return unwrappedValue;
      }

      fallbackValue = unwrappedValue;
    }
  }

  return fallbackValue;
}

function isUsableIntentPayloadCandidate(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tokenA === "string" &&
    typeof candidate.tokenB === "string" &&
    (typeof candidate.amount === "string" || typeof candidate.amount === "bigint") &&
    Array.isArray(candidate.preferredChains) &&
    typeof candidate.riskTolerance === "string" &&
    typeof candidate.minYield === "number"
  );
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

function validateSupportedAssetPair(tokenA: string, tokenB: string): void {
  const normalizedPair = [tokenA, tokenB].sort();

  if (normalizedPair.some((token, index) => token !== SUPPORTED_ASSET_PAIR[index])) {
    throw new Error("Invalid intent: only the WETH/USDC Base Sepolia asset pair is supported");
  }
}

function normalizeAmount(value: unknown): bigint {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new Error("Invalid intent: amount must be positive");
    }

    return value;
  }

  if (typeof value === "number") {
    throw new Error("Invalid intent: amount must be provided as a base-unit integer string or bigint");
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

  throw new Error("Invalid intent: amount must be provided as a base-unit integer string or bigint");
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
