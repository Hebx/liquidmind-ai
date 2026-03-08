import {
  normalizeWorkflowIntentInput,
} from "./lib/intent";
import {
  prepareCanonicalActions,
  toCanonicalIntentWorkflowResult,
  type CanonicalIntentWorkflowResult,
} from "./canonical-preparation";
import { RpcMarketDataReader } from "./rpc-market-data";

interface CanonicalIntentWorkflowOptions {
  env?: NodeJS.ProcessEnv;
}

export async function executeCanonicalIntentWorkflow(
  intentInput: unknown,
  options: CanonicalIntentWorkflowOptions = {},
): Promise<CanonicalIntentWorkflowResult> {
  const intent = normalizeWorkflowIntentInput(intentInput);
  const marketDataReader = new RpcMarketDataReader({ env: options.env });
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
