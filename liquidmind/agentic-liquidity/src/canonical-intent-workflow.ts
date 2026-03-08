import {
  normalizeWorkflowIntentInput,
} from "./lib/intent";
import {
  prepareCanonicalActions,
  toCanonicalIntentWorkflowResult,
  type CanonicalIntentWorkflowResult,
} from "./canonical-preparation";
import { RpcMarketDataReader } from "./rpc-market-data";

export interface CanonicalMarketDataReader {
  getPrice(tokenAddressOrSymbol: string): Promise<number>;
  getVolatility(symbol: string, numRounds?: number): Promise<{ volatility: number }>;
}

interface CanonicalIntentWorkflowOptions {
  env?: NodeJS.ProcessEnv;
  marketDataReader?: CanonicalMarketDataReader;
}

export async function executeCanonicalHttpWorkflow(
  intentInput: unknown,
  options: CanonicalIntentWorkflowOptions = {},
): Promise<CanonicalIntentWorkflowResult> {
  const intent = normalizeWorkflowIntentInput(intentInput);
  const marketDataReader =
    options.marketDataReader ?? new RpcMarketDataReader({ env: options.env });
  const [priceA, priceB] = await Promise.all([
    marketDataReader.getPrice(intent.tokenA),
    marketDataReader.getPrice(intent.tokenB),
  ]);

  let volatility: number | undefined;
  try {
    const ethSymbol = intent.tokenA.toUpperCase().includes("ETH") ? intent.tokenA : intent.tokenB;
    const result = await marketDataReader.getVolatility(ethSymbol, 5);
    volatility = result.volatility;
  } catch {
    volatility = undefined;
  }

  return toCanonicalIntentWorkflowResult(
    intent,
    prepareCanonicalActions(intent, {
      priceA,
      priceB,
      volatility,
    }),
  );
}

export const executeCanonicalIntentWorkflow = executeCanonicalHttpWorkflow;
