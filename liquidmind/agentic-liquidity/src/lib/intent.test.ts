import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEVELOPMENT_INTENT,
  normalizeIntentInput,
} from "./intent.js";

test("normalizeIntentInput coerces a JSON-friendly payload into canonical intent", () => {
  const intent = normalizeIntentInput({
    tokenA: " weth ",
    tokenB: "usdc",
    amount: "1000000",
    preferredChains: [" Base-Sepolia ", "base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 1000000n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});

test("normalizeIntentInput falls back to the shared development default when allowed", () => {
  const intent = normalizeIntentInput(undefined, { fallbackToDefault: true });

  assert.equal(intent.action, "rebalance");
  assert.equal(intent.tokenA, DEFAULT_DEVELOPMENT_INTENT.tokenA);
  assert.equal(intent.tokenB, DEFAULT_DEVELOPMENT_INTENT.tokenB);
  assert.equal(intent.amount, BigInt(DEFAULT_DEVELOPMENT_INTENT.amount));
});

test("normalizeIntentInput rejects non-positive amounts", () => {
  assert.throws(
    () =>
      normalizeIntentInput({
        tokenA: "WETH",
        tokenB: "USDC",
        amount: "0",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    /amount must be positive/i,
  );
});

test("normalizeIntentInput rejects unsupported canonical actions", () => {
  assert.throws(
    () =>
      normalizeIntentInput({
        action: "deposit",
        tokenA: "WETH",
        tokenB: "USDC",
        amount: "1000000",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    /only rebalance is supported/i,
  );
});
