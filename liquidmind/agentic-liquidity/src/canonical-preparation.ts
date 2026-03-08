import { encodeAbiParameters, encodeFunctionData, parseAbi, type Hex } from "viem";

import { toIntentPayload, type LiquidityIntent, type LiquidityIntentPayload } from "./lib/intent";

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

export interface CanonicalWorkflowWarning {
  code: "FEE_ACTION_UNAVAILABLE";
  message: string;
}

export interface CanonicalIntentWorkflowResult {
  status: "prepared";
  intent: LiquidityIntentPayload;
  hookAction: PreparedHookAction;
  feeAction?: PreparedFeeAction;
  warnings?: CanonicalWorkflowWarning[];
}

export interface CanonicalPreparationResult {
  hookAction: PreparedHookAction;
  feeAction?: PreparedFeeAction;
  diagnostics: {
    priceA: number;
    priceB: number;
    ethUsdPrice: number;
    currentTick: number;
    halfRange: number;
  };
}

interface PrepareCanonicalActionsOptions {
  priceA: number;
  priceB: number;
  volatility?: number;
  nowMs?: number;
}

export const CONTRACTS = {
  HOOK: "0xb08542f31D6C765F30365148ee5E906F941d18C0" as Hex,
  COORDINATOR: "0x68F321d6d33b23bAFC03CC4d84b1dBbe7cBFd063" as Hex,
  POOL_MANAGER: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Hex,
  WETH: "0x4200000000000000000000000000000000000006" as Hex,
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Hex,
} as const;
export const UNISWAP_DYNAMIC_FEE_FLAG = 0x800000;

export function prepareCanonicalActions(
  intent: LiquidityIntent,
  options: PrepareCanonicalActionsOptions,
): CanonicalPreparationResult {
  const isUsdcToken0 = CONTRACTS.USDC.toLowerCase() < CONTRACTS.WETH.toLowerCase();
  const ethUsdPrice = intent.tokenA.toUpperCase().includes("ETH") ? options.priceA : options.priceB;
  const currentTick = priceToTick(ethUsdPrice, isUsdcToken0);
  const halfRange = getHalfRange(intent.riskTolerance);
  const tickLower = snapTick(currentTick - halfRange, 60);
  const tickUpper = snapTick(currentTick + halfRange, 60);

  const hookAction = {
    ...buildRebalanceCalldata(
      tickLower,
      tickUpper,
      createActionId(options.nowMs ?? Date.now()),
    ),
    coordinator: CONTRACTS.COORDINATOR,
  };

  let feeAction: PreparedFeeAction | undefined;
  if (typeof options.volatility === "number") {
    feeAction = {
      ...buildUpdateFeeCalldata(
        volatilityToFee(options.volatility),
        createActionId((options.nowMs ?? Date.now()) + 1),
      ),
      volatility: options.volatility,
      coordinator: CONTRACTS.COORDINATOR,
    };
  }

  return {
    hookAction,
    feeAction,
    diagnostics: {
      priceA: options.priceA,
      priceB: options.priceB,
      ethUsdPrice,
      currentTick,
      halfRange,
    },
  };
}

export function toCanonicalIntentWorkflowResult(
  intent: LiquidityIntent,
  preparation: CanonicalPreparationResult,
  warnings?: CanonicalWorkflowWarning[],
): CanonicalIntentWorkflowResult {
  const result: CanonicalIntentWorkflowResult = {
    status: "prepared",
    intent: toIntentPayload(intent),
    hookAction: preparation.hookAction,
  };

  if (preparation.feeAction) {
    result.feeAction = preparation.feeAction;
  }

  if (warnings && warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

function createActionId(timestampMs: number): Hex {
  return `0x${timestampMs.toString(16).padStart(64, "0")}` as Hex;
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
  const poolFee = UNISWAP_DYNAMIC_FEE_FLAG;
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
  const poolFee = UNISWAP_DYNAMIC_FEE_FLAG;
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
