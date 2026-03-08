import {
  normalizeWorkflowIntentInput,
} from "./lib/intent";
import {
  prepareCanonicalActions,
  toCanonicalIntentWorkflowResult,
  type CanonicalPreparationResult,
  type CanonicalIntentWorkflowResult,
  type CanonicalWorkflowWarning,
} from "./canonical-preparation";
import { RpcMarketDataReader } from "./rpc-market-data";
import type { LiquidityIntent } from "./lib/intent";

export interface CanonicalMarketDataReader {
  getPrice(tokenAddressOrSymbol: string): Promise<number>;
  getVolatility(symbol: string, numRounds?: number): Promise<{ volatility: number }>;
}

interface CanonicalIntentWorkflowOptions {
  env?: NodeJS.ProcessEnv;
  marketDataReader?: CanonicalMarketDataReader;
}

export interface CanonicalHttpPreparationResult {
  intent: LiquidityIntent;
  workflow: CanonicalIntentWorkflowResult;
  diagnostics: CanonicalPreparationResult["diagnostics"];
}

const VOLATILITY_WARNING: CanonicalWorkflowWarning = {
  code: "FEE_ACTION_UNAVAILABLE",
  message: "Volatility analysis unavailable. Fee update action was not prepared.",
};

export async function prepareCanonicalHttpWorkflow(
  intentInput: unknown,
  options: CanonicalIntentWorkflowOptions = {},
): Promise<CanonicalHttpPreparationResult> {
  const intent = normalizeWorkflowIntentInput(intentInput);
  const marketDataReader =
    options.marketDataReader ?? new RpcMarketDataReader({ env: options.env });
  const [priceA, priceB] = await Promise.all([
    marketDataReader.getPrice(intent.tokenA),
    marketDataReader.getPrice(intent.tokenB),
  ]);

  const warnings: CanonicalWorkflowWarning[] = [];
  let volatility: number | undefined;
  try {
    const ethSymbol = intent.tokenA.toUpperCase().includes("ETH") ? intent.tokenA : intent.tokenB;
    const result = await marketDataReader.getVolatility(ethSymbol, 5);
    volatility = result.volatility;
  } catch {
    warnings.push(VOLATILITY_WARNING);
  }

  const preparation = prepareCanonicalActions(intent, {
    priceA,
    priceB,
    volatility,
  });

  return {
    intent,
    diagnostics: preparation.diagnostics,
    workflow: toCanonicalIntentWorkflowResult(intent, preparation, warnings),
  };
}

/**
 * Shared canonical HTTP entry surface.
 *
 * Both the Next.js intent route and the CRE package's `onHttpTrigger` handler
 * call this function so HTTP-triggered execution reuses one canonical boundary.
 */
export async function executeCanonicalHttpWorkflow(
  intentInput: unknown,
  options: CanonicalIntentWorkflowOptions = {},
): Promise<CanonicalIntentWorkflowResult> {
  const preparation = await prepareCanonicalHttpWorkflow(intentInput, options);
  return preparation.workflow;
}

export const executeCanonicalIntentWorkflow = executeCanonicalHttpWorkflow;
