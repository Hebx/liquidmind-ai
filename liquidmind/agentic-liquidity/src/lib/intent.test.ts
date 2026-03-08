import assert from "node:assert/strict";
import test from "node:test";
import * as intentLib from "./intent.js";

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

test("normalizeWorkflowIntentInput extracts a wrapped body payload without falling back", () => {
  const normalizeWorkflowIntentInput = (
    intentLib as {
      normalizeWorkflowIntentInput?: (input: unknown, options?: { fallbackToDefault?: boolean }) => {
        action: string;
        tokenA: string;
        tokenB: string;
        amount: bigint;
        preferredChains: string[];
        riskTolerance: string;
        minYield: number;
      };
    }
  ).normalizeWorkflowIntentInput;

  assert.equal(typeof normalizeWorkflowIntentInput, "function");

  const intent = normalizeWorkflowIntentInput?.(
    {
      body: {
        action: "rebalance",
        tokenA: "cbeth",
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
    tokenA: "CBETH",
    tokenB: "USDC",
    amount: 42n,
    preferredChains: ["base-sepolia"],
    riskTolerance: "low",
    minYield: 3,
  });
});

test("normalizeWorkflowIntentInput prefers body over payload wrappers", () => {
  const normalizeWorkflowIntentInput = (
    intentLib as {
      normalizeWorkflowIntentInput?: (input: unknown) => {
        tokenA: string;
        amount: bigint;
      };
    }
  ).normalizeWorkflowIntentInput;

  assert.equal(typeof normalizeWorkflowIntentInput, "function");

  const intent = normalizeWorkflowIntentInput?.({
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

test("toIntentPayload converts bigint amounts into JSON-safe strings", () => {
  const toIntentPayload = (
    intentLib as {
      toIntentPayload?: (intent: ReturnType<typeof normalizeIntentInput>) => unknown;
    }
  ).toIntentPayload;

  assert.equal(typeof toIntentPayload, "function");

  const payload = toIntentPayload?.(
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
