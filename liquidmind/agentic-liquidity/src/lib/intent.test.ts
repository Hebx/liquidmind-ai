import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEVELOPMENT_INTENT,
  normalizeIntentInput,
  normalizeWorkflowIntentInput,
  toIntentPayload,
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

test("normalizeIntentInput rejects unsafe numeric amount inputs", () => {
  assert.throws(
    () =>
      normalizeIntentInput({
        tokenA: "WETH",
        tokenB: "USDC",
        amount: Number.MAX_SAFE_INTEGER + 1,
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    /amount must be provided as a base-unit integer string or bigint/i,
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

test("normalizeIntentInput rejects preferred chains outside base-sepolia", () => {
  assert.throws(
    () =>
      normalizeIntentInput({
        tokenA: "WETH",
        tokenB: "USDC",
        amount: "1000000",
        preferredChains: ["ethereum"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    /base-sepolia/i,
  );
});

test("normalizeIntentInput rejects unsupported asset pairs", () => {
  assert.throws(
    () =>
      normalizeIntentInput({
        tokenA: "CBETH",
        tokenB: "USDC",
        amount: "1000000",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    /weth\/usdc/i,
  );
});

test("normalizeWorkflowIntentInput extracts a wrapped body payload without falling back", () => {
  assert.equal(typeof normalizeWorkflowIntentInput, "function");

  const intent = normalizeWorkflowIntentInput(
    {
      body: {
        action: "rebalance",
        tokenA: "weth",
        tokenB: "usdc",
        amount: "42",
        preferredChains: ["base-sepolia"],
        riskTolerance: "low",
        minYield: 3,
      },
    },
    { fallbackToDefault: true },
  );

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 42n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "low",
    minYield: 3,
  });
});

test("normalizeWorkflowIntentInput parses JSON string bodies in wrapper fields", () => {
  const intent = normalizeWorkflowIntentInput(
    {
      body: JSON.stringify({
        tokenA: "weth",
        tokenB: "usdc",
        amount: "9",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      }),
    },
    { fallbackToDefault: true },
  );

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 9n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});

test("normalizeWorkflowIntentInput unwraps nested wrapper envelopes", () => {
  const intent = normalizeWorkflowIntentInput({
    body: {
      intent: {
        payload: {
          tokenA: "weth",
          tokenB: "usdc",
          amount: "11",
          preferredChains: ["base-sepolia"],
          riskTolerance: "medium",
          minYield: 6,
        },
      },
    },
  });

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 11n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 6,
  });
});

test("normalizeWorkflowIntentInput unwraps nested wrappers inside JSON string bodies", () => {
  const intent = normalizeWorkflowIntentInput({
    body: JSON.stringify({
      intent: {
        payload: {
          tokenA: "weth",
          tokenB: "usdc",
          amount: "13",
          preferredChains: ["base-sepolia"],
          riskTolerance: "low",
          minYield: 4,
        },
      },
    }),
  });

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 13n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "low",
    minYield: 4,
  });
});

test("normalizeWorkflowIntentInput prefers body over payload wrappers", () => {
  assert.equal(typeof normalizeWorkflowIntentInput, "function");

  const intent = normalizeWorkflowIntentInput({
    body: {
      tokenA: "weth",
      tokenB: "usdc",
      amount: "7",
      preferredChains: ["base-sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    },
    payload: {
      tokenA: "ignore-me",
      tokenB: "usdc",
      amount: "999",
      preferredChains: ["base-sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    },
  });

  assert.equal(intent?.tokenA, "WETH");
  assert.equal(intent?.amount, 7n);
});

test("normalizeWorkflowIntentInput falls through when body is unusable and payload is valid", () => {
  const intent = normalizeWorkflowIntentInput({
    body: "not-json",
    payload: JSON.stringify({
      tokenA: "weth",
      tokenB: "usdc",
      amount: "17",
      preferredChains: ["base-sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    }),
  });

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 17n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});

test("normalizeWorkflowIntentInput falls through when body is a malformed object and payload is valid", () => {
  const intent = normalizeWorkflowIntentInput({
    body: { foo: "bar" },
    payload: {
      tokenA: "weth",
      tokenB: "usdc",
      amount: "19",
      preferredChains: ["base-sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    },
  });

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: 19n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});

test("toIntentPayload converts bigint amounts into JSON-safe strings", () => {
  assert.equal(typeof toIntentPayload, "function");

  const payload = toIntentPayload(
    normalizeIntentInput({
      tokenA: "WETH",
      tokenB: "USDC",
      amount: "123",
      preferredChains: ["base-sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    }),
  );

  assert.deepEqual(payload, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "123",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});
