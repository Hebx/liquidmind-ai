import { encodeAbiParameters, encodeFunctionData, parseAbi, type Hex } from "viem";

import {
  normalizeWorkflowIntentInput,
  toIntentPayload,
  type LiquidityIntent,
  type LiquidityIntentPayload,
} from "./lib/intent";

export interface PreparedHookAction {
  tickLower: number;
  tickUpper: number;
  actionId: Hex;
  coordinatorCalldata: Hex;
  coordinator: Hex;
}

export interface PreparedFeeAction {
  newFee: number;
  volatility: number;
  actionId: Hex;
  coordinatorCalldata: Hex;
  coordinator: Hex;
}

export interface CanonicalIntentWorkflowResult {
  status: "prepared";
  intent: LiquidityIntentPayload;
  hookAction: PreparedHookAction;
  feeAction?: PreparedFeeAction;
}

interface CanonicalIntentWorkflowOptions {
  priceResolver?: (tokenSymbol: string) => Promise<number> | number;
  volatility?: number;
}

export const CONTRACTS = {
  HOOK: "0xC28ed0595D42ec01A2F7546f39Cf27Ea798598C0" as Hex,
  COORDINATOR: "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b" as Hex,
  POOL_MANAGER: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Hex,
  WETH: "0x4200000000000000000000000000000000000006" as Hex,
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Hex,
} as const;

const DEFAULT_PRICE_BY_SYMBOL: Record<string, number> = {
  ETH: 2000,
  WETH: 2000,
  USDC: 1,
  USDT: 1,
  DAI: 1,
};

export async function executeCanonicalIntentWorkflow(
  intentInput: unknown,
  options: CanonicalIntentWorkflowOptions = {},
): Promise<CanonicalIntentWorkflowResult> {
  const intent = normalizeWorkflowIntentInput(intentInput);
  const [priceA, priceB] = await Promise.all([
    resolvePrice(intent.tokenA, options.priceResolver),
    resolvePrice(intent.tokenB, options.priceResolver),
  ]);

  const isUsdcToken0 = CONTRACTS.USDC.toLowerCase() < CONTRACTS.WETH.toLowerCase();
  const ethUsdPrice = intent.tokenA.includes("ETH") ? priceA : priceB;
  const currentTick = priceToTick(ethUsdPrice, isUsdcToken0);
  const halfRange = getHalfRange(intent.riskTolerance);
  const tickLower = snapTick(currentTick - halfRange, 60);
  const tickUpper = snapTick(currentTick + halfRange, 60);

  const hookActionId = createActionId();
  const hookAction = buildRebalanceCalldata(tickLower, tickUpper, hookActionId);

  const result: CanonicalIntentWorkflowResult = {
    status: "prepared",
    intent: toIntentPayload(intent),
    hookAction: {
      ...hookAction,
      coordinator: CONTRACTS.COORDINATOR,
    },
  };

  if (typeof options.volatility === "number") {
    const feeActionId = createActionId(1);
    const feeAction = buildUpdateFeeCalldata(volatilityToFee(options.volatility), feeActionId);
    result.feeAction = {
      ...feeAction,
      volatility: options.volatility,
      coordinator: CONTRACTS.COORDINATOR,
    };
  }

  return result;
}

function createActionId(offsetMs: number = 0): Hex {
  return `0x${(Date.now() + offsetMs).toString(16).padStart(64, "0")}` as Hex;
}

async function resolvePrice(
  tokenSymbol: string,
  priceResolver: CanonicalIntentWorkflowOptions["priceResolver"],
): Promise<number> {
  if (priceResolver) {
    return await priceResolver(tokenSymbol);
  }

  return DEFAULT_PRICE_BY_SYMBOL[tokenSymbol.toUpperCase()] ?? 1;
}

function priceToTick(usdPrice: number, isToken0Usdc: boolean): number {
  const logBase = Math.log(1.0001);
  if (isToken0Usdc) {
    return Math.round(Math.log(1 / usdPrice) / logBase);
  }

  return Math.round(Math.log(usdPrice) / logBase);
}

function snapTick(tick: number, spacing: number): number {
  const remainder = ((tick % spacing) + spacing) % spacing;
  return tick - remainder;
}

function getHalfRange(riskTolerance: LiquidityIntent["riskTolerance"]): number {
  if (riskTolerance === "low") {
    return 600;
  }

  if (riskTolerance === "medium") {
    return 1200;
  }

  return 2400;
}

function buildRebalanceCalldata(
  tickLower: number,
  tickUpper: number,
  actionId: Hex,
): Omit<PreparedHookAction, "coordinator"> {
  const tickSpacing = 60;
  const poolFee = 3000;
  const encodedPoolKey = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    [
      {
        currency0: CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.USDC : CONTRACTS.WETH,
        currency1: CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.WETH : CONTRACTS.USDC,
        fee: poolFee,
        tickSpacing,
        hooks: CONTRACTS.HOOK,
      },
    ],
  );

  const actionData = encodeAbiParameters(
    [
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
    ],
    [tickLower, tickUpper],
  );

  const coordinatorCalldata = encodeFunctionData({
    abi: parseAbi([
      "function executeLocalHookAction(bytes32 actionId, string actionType, bytes encodedKey, bytes actionData) returns (bool)",
    ]),
    functionName: "executeLocalHookAction",
    args: [actionId, "rebalance", encodedPoolKey, actionData],
  });

  return {
    coordinatorCalldata,
    tickLower,
    tickUpper,
    actionId,
  };
}

function buildUpdateFeeCalldata(
  newFee: number,
  actionId: Hex,
): Omit<PreparedFeeAction, "coordinator" | "volatility"> {
  const tickSpacing = 60;
  const poolFee = 3000;
  const encodedPoolKey = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    [
      {
        currency0: CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.USDC : CONTRACTS.WETH,
        currency1: CONTRACTS.USDC < CONTRACTS.WETH ? CONTRACTS.WETH : CONTRACTS.USDC,
        fee: poolFee,
        tickSpacing,
        hooks: CONTRACTS.HOOK,
      },
    ],
  );

  const actionData = encodeAbiParameters([{ name: "newFee", type: "uint24" }], [newFee]);
  const coordinatorCalldata = encodeFunctionData({
    abi: parseAbi([
      "function executeLocalHookAction(bytes32 actionId, string actionType, bytes encodedKey, bytes actionData) returns (bool)",
    ]),
    functionName: "executeLocalHookAction",
    args: [actionId, "updateFee", encodedPoolKey, actionData],
  });

  return {
    coordinatorCalldata,
    newFee,
    actionId,
  };
}

function volatilityToFee(annualizedVolatility: number): number {
  if (annualizedVolatility < 20) {
    return 500;
  }

  if (annualizedVolatility < 40) {
    return 3000;
  }

  if (annualizedVolatility < 80) {
    return 5000;
  }

  if (annualizedVolatility < 120) {
    return 8000;
  }

  return 10000;
}
