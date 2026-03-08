import assert from "node:assert/strict";
import test from "node:test";

import {
  IntentParserError,
  createOpenAICompatibleIntentProvider,
  parseIntentRequestBody,
  parseIntentWithModel,
} from "./intent-parser.js";

test("parseIntentWithModel returns the canonical payload when the model returns a valid intent", async () => {
  const intent = await parseIntentWithModel(
    "rebalance my base sepolia weth/usdc position with medium risk and at least 5% yield using 1000000 base units",
    async () => ({
      action: "rebalance",
      tokenA: "weth",
      tokenB: "usdc",
      amount: "1000000",
      preferredChains: ["Base-Sepolia"],
      riskTolerance: "medium",
      minYield: 5,
    }),
  );

  assert.deepEqual(intent, {
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "1000000",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
});

test("parseIntentWithModel rejects unsupported assets instead of silently normalizing them", async () => {
  await assert.rejects(
    () =>
      parseIntentWithModel("rebalance cbeth/usdc on base sepolia", async () => ({
        action: "rebalance",
        tokenA: "cbeth",
        tokenB: "usdc",
        amount: "1000000",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      })),
    (error: unknown) =>
      error instanceof IntentParserError &&
      error.code === "VALIDATION_ERROR" &&
      /weth\/usdc/i.test(error.message),
  );
});

test("parseIntentWithModel rejects unsupported chains instead of rewriting them", async () => {
  await assert.rejects(
    () =>
      parseIntentWithModel("rebalance weth/usdc on arbitrum", async () => ({
        action: "rebalance",
        tokenA: "weth",
        tokenB: "usdc",
        amount: "1000000",
        preferredChains: ["arbitrum"],
        riskTolerance: "medium",
        minYield: 5,
      })),
    (error: unknown) =>
      error instanceof IntentParserError &&
      error.code === "VALIDATION_ERROR" &&
      /base-sepolia/i.test(error.message),
  );
});

test("parseIntentWithModel rejects malformed model output", async () => {
  await assert.rejects(
    () => parseIntentWithModel("rebalance weth/usdc", async () => "not-an-object"),
    (error: unknown) =>
      error instanceof IntentParserError &&
      error.code === "VALIDATION_ERROR" &&
      /expected an object/i.test(error.message),
  );
});

test("createOpenAICompatibleIntentProvider requires server-side provider configuration", async () => {
  assert.throws(
    () =>
      createOpenAICompatibleIntentProvider({
        env: {
          INTENT_PARSER_MODEL: "gpt-4.1-mini",
        },
      }),
    (error: unknown) =>
      error instanceof IntentParserError &&
      error.code === "CONFIG_ERROR" &&
      /INTENT_PARSER_API_URL/i.test(error.message),
  );
});

test("createOpenAICompatibleIntentProvider parses JSON content from an OpenAI-compatible response", async () => {
  const fetchCalls: Array<{
    input: RequestInfo | URL;
    init?: RequestInit;
  }> = [];

  const provider = createOpenAICompatibleIntentProvider({
    env: {
      INTENT_PARSER_API_URL: "https://example.com/v1/chat/completions",
      INTENT_PARSER_API_KEY: "test-key",
      INTENT_PARSER_MODEL: "gpt-4.1-mini",
    },
    fetchImpl: async (input, init) => {
      fetchCalls.push({ input, init });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: "rebalance",
                  tokenA: "weth",
                  tokenB: "usdc",
                  amount: "42",
                  preferredChains: ["base-sepolia"],
                  riskTolerance: "low",
                  minYield: 3,
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  const parsed = await provider("rebalance 42 base units");

  assert.deepEqual(parsed, {
    action: "rebalance",
    tokenA: "weth",
    tokenB: "usdc",
    amount: "42",
    preferredChains: ["base-sepolia"],
    riskTolerance: "low",
    minYield: 3,
  });
  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0]?.input), /chat\/completions/);
  assert.match(
    String((fetchCalls[0]?.init?.headers as Record<string, string> | undefined)?.authorization),
    /test-key/,
  );
});

test("parseIntentRequestBody requires a non-empty rawIntent string", () => {
  assert.equal(
    parseIntentRequestBody({
      rawIntent: " rebalance weth/usdc on base sepolia ",
    }),
    "rebalance weth/usdc on base sepolia",
  );

  assert.throws(
    () => parseIntentRequestBody({ rawIntent: "   " }),
    (error: unknown) =>
      error instanceof IntentParserError &&
      error.code === "BAD_REQUEST" &&
      /rawIntent/i.test(error.message),
  );
});
