import assert from "node:assert/strict";
import test from "node:test";
import { decodeAbiParameters, decodeFunctionData, parseAbi } from "viem";

import {
  CONTRACTS,
  UNISWAP_DYNAMIC_FEE_FLAG,
  prepareCanonicalActions,
} from "./canonical-preparation";
import { normalizeIntentInput } from "./lib/intent";

const COORDINATOR_ABI = parseAbi([
  "function executeLocalHookAction(bytes32 actionId, string actionType, bytes encodedKey, bytes actionData) returns (bool)",
]);

test("prepareCanonicalActions encodes the live dynamic-fee pool key", () => {
  const intent = normalizeIntentInput({
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "1000000",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });

  const preparation = prepareCanonicalActions(intent, {
    priceA: 2000,
    priceB: 1,
    volatility: 75,
    nowMs: 1_234_567,
  });

  const rebalanceCall = decodeFunctionData({
    abi: COORDINATOR_ABI,
    data: preparation.hookAction.coordinatorCalldata,
  });
  assert.equal(rebalanceCall.functionName, "executeLocalHookAction");

  const [, rebalanceActionType, rebalanceEncodedKey] = rebalanceCall.args;
  assert.equal(rebalanceActionType, "rebalance");

  const [rebalancePoolKey] = decodeAbiParameters(
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
    rebalanceEncodedKey,
  );

  assert.equal(rebalancePoolKey.currency0, CONTRACTS.USDC);
  assert.equal(rebalancePoolKey.currency1, CONTRACTS.WETH);
  assert.equal(rebalancePoolKey.fee, UNISWAP_DYNAMIC_FEE_FLAG);
  assert.equal(rebalancePoolKey.tickSpacing, 60);
  assert.equal(rebalancePoolKey.hooks, CONTRACTS.HOOK);

  assert.ok(preparation.feeAction);
  const feeCall = decodeFunctionData({
    abi: COORDINATOR_ABI,
    data: preparation.feeAction.coordinatorCalldata,
  });
  const [, feeActionType, feeEncodedKey] = feeCall.args;
  assert.equal(feeActionType, "updateFee");

  const [feePoolKey] = decodeAbiParameters(
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
    feeEncodedKey,
  );

  assert.equal(feePoolKey.fee, UNISWAP_DYNAMIC_FEE_FLAG);
});
