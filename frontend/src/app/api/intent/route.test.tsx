import assert from "node:assert/strict";
import test from "node:test";

import { IntentParserError } from "@/lib/intent-parser";
import { executeCanonicalHttpWorkflow } from "../../../../../liquidmind/agentic-liquidity/src/canonical-intent-workflow";

import {
  createIntentErrorResponse,
  DEFAULT_INTENT_ROUTE_DEPENDENCIES,
  handleIntentPost,
  POST,
} from "./route.js";

test("createIntentErrorResponse preserves specific client messages for validation failures", () => {
  const response = createIntentErrorResponse(
    new IntentParserError("VALIDATION_ERROR", "Invalid intent: only base-sepolia is supported."),
  );

  assert.deepEqual(response, {
    status: 422,
    body: {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid intent: only base-sepolia is supported.",
      },
    },
  });
});

test("createIntentErrorResponse hides provider and config internals from clients", () => {
  const providerError = createIntentErrorResponse(
    new IntentParserError("PROVIDER_ERROR", "Intent parser provider request failed with status 401."),
  );
  const configError = createIntentErrorResponse(
    new IntentParserError("CONFIG_ERROR", "Missing INTENT_PARSER_API_KEY for the server-side intent parser."),
  );

  assert.deepEqual(providerError, {
    status: 502,
    body: {
      ok: false,
      error: {
        code: "PROVIDER_ERROR",
        message: "Intent parsing is temporarily unavailable.",
      },
    },
  });
  assert.deepEqual(configError, {
    status: 500,
    body: {
      ok: false,
      error: {
        code: "CONFIG_ERROR",
        message: "Intent parsing is not available on this server.",
      },
    },
  });
});

test("POST returns BAD_REQUEST for malformed JSON bodies", async () => {
  const response = await POST(
    new Request("http://localhost/api/intent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "BAD_REQUEST",
      message: "Request body must be valid JSON.",
    },
  });
});

test("default route workflow dependency points at the shared canonical HTTP entry surface", () => {
  assert.equal(
    DEFAULT_INTENT_ROUTE_DEPENDENCIES.executeWorkflow,
    executeCanonicalHttpWorkflow,
  );
});

test("POST uses the default intent route dependencies", async () => {
  const previousDependencies = {
    ...DEFAULT_INTENT_ROUTE_DEPENDENCIES,
  };

  DEFAULT_INTENT_ROUTE_DEPENDENCIES.parseIntent = async () => ({
    action: "rebalance",
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "1000000",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium",
    minYield: 5,
  });
  DEFAULT_INTENT_ROUTE_DEPENDENCIES.executeWorkflow = async (intent) => ({
    status: "prepared",
    intent,
    hookAction: {
      actionId: "0x2".padEnd(66, "0") as `0x${string}`,
      coordinator: "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b",
      coordinatorCalldata: "0xfeedface",
      tickLower: -70000,
      tickUpper: -68000,
    },
  });

  try {
    const response = await POST(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      intent: {
        action: "rebalance",
        tokenA: "WETH",
        tokenB: "USDC",
        amount: "1000000",
        preferredChains: ["base-sepolia"],
        riskTolerance: "medium",
        minYield: 5,
      },
      workflow: {
        status: "prepared",
        intent: {
          action: "rebalance",
          tokenA: "WETH",
          tokenB: "USDC",
          amount: "1000000",
          preferredChains: ["base-sepolia"],
          riskTolerance: "medium",
          minYield: 5,
        },
        hookAction: {
          actionId: "0x2".padEnd(66, "0"),
          coordinator: "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b",
          coordinatorCalldata: "0xfeedface",
          tickLower: -70000,
          tickUpper: -68000,
        },
      },
    });
  } finally {
    DEFAULT_INTENT_ROUTE_DEPENDENCIES.parseIntent = previousDependencies.parseIntent;
    DEFAULT_INTENT_ROUTE_DEPENDENCIES.executeWorkflow = previousDependencies.executeWorkflow;
  }
});

test("handleIntentPost returns prepared canonical workflow output instead of only echoing parsed intent", async () => {
  const parsedIntent = {
    action: "rebalance" as const,
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "1000000",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium" as const,
    minYield: 5,
  };
  const response = await handleIntentPost(
    new Request("http://localhost/api/intent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
      }),
    }),
    {
      parseIntent: async () => parsedIntent,
      executeWorkflow: async (intent) => ({
        status: "prepared",
        intent,
        hookAction: {
          actionId: "0x1".padEnd(66, "0") as `0x${string}`,
          coordinator: "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b",
          coordinatorCalldata: "0xdeadbeef",
          tickLower: -77220,
          tickUpper: -74820,
        },
      }),
    },
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.intent.amount, "1000000");
  assert.equal(body.workflow.status, "prepared");
  assert.equal(body.workflow.intent.amount, "1000000");
  assert.equal(body.workflow.hookAction.coordinator, "0x268c2E3D23f5cDDAA0D0B40142053414cC05991b");
  assert.equal(body.workflow.hookAction.coordinatorCalldata, "0xdeadbeef");
  assert.equal(body.workflow.hookAction.tickLower < body.workflow.hookAction.tickUpper, true);
  assert.equal("feeAction" in body.workflow, false);
});

test("handleIntentPost returns an honest sanitized error when canonical workflow execution fails after parsing", async () => {
  const parsedIntent = {
    action: "rebalance" as const,
    tokenA: "WETH",
    tokenB: "USDC",
    amount: "1000000",
    preferredChains: ["base-sepolia"],
    riskTolerance: "medium" as const,
    minYield: 5,
  };

  const previousConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    const response = await handleIntentPost(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
      {
        parseIntent: async () => parsedIntent,
        executeWorkflow: async () => {
          throw new Error("workflow boom");
        },
      },
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Intent workflow preparation failed.",
      },
    });
    assert.equal(loggedErrors.length, 1);
  } finally {
    console.error = previousConsoleError;
  }
});

test("POST fails honestly when live canonical market data is unavailable", async () => {
  const previousEnv = {
    ...process.env,
  };
  const previousFetch = global.fetch;

  process.env.INTENT_PARSER_API_URL = "https://example.com/v1/chat/completions";
  process.env.INTENT_PARSER_API_KEY = "test-key";
  process.env.INTENT_PARSER_MODEL = "gpt-4.1-mini";
  delete process.env.INTENT_PARSER_TIMEOUT_MS;
  delete process.env.BASE_SEPOLIA_RPC;
  delete process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC;

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "rebalance",
                tokenA: "WETH",
                tokenB: "USDC",
                amount: "1000000",
                preferredChains: ["base-sepolia"],
                riskTolerance: "medium",
                minYield: 5,
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

  try {
    const response = await POST(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Intent workflow preparation failed.",
      },
    });
  } finally {
    process.env = previousEnv;
    global.fetch = previousFetch;
  }
});

test("POST returns sanitized config errors through the route handler", async () => {
  const previousEnv = {
    ...process.env,
  };
  const previousConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  delete process.env.INTENT_PARSER_API_URL;
  delete process.env.INTENT_PARSER_BASE_URL;
  delete process.env.INTENT_PARSER_API_KEY;
  delete process.env.INTENT_PARSER_MODEL;
  delete process.env.INTENT_PARSER_TIMEOUT_MS;
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "CONFIG_ERROR",
        message: "Intent parsing is not available on this server.",
      },
    });
    assert.equal(loggedErrors.length, 1);
  } finally {
    process.env = previousEnv;
    console.error = previousConsoleError;
  }
});

test("POST returns sanitized config errors for malformed parser URLs", async () => {
  const previousEnv = {
    ...process.env,
  };
  const previousConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  process.env.INTENT_PARSER_API_URL = "not-a-url";
  process.env.INTENT_PARSER_API_KEY = "test-key";
  process.env.INTENT_PARSER_MODEL = "gpt-4.1-mini";
  delete process.env.INTENT_PARSER_BASE_URL;
  delete process.env.INTENT_PARSER_TIMEOUT_MS;
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "CONFIG_ERROR",
        message: "Intent parsing is not available on this server.",
      },
    });
    assert.equal(loggedErrors.length, 1);
  } finally {
    process.env = previousEnv;
    console.error = previousConsoleError;
  }
});

test("POST returns sanitized provider errors through the route handler", async () => {
  const previousEnv = {
    ...process.env,
  };
  const previousFetch = global.fetch;
  const previousConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  process.env.INTENT_PARSER_API_URL = "https://example.com/v1/chat/completions";
  process.env.INTENT_PARSER_API_KEY = "test-key";
  process.env.INTENT_PARSER_MODEL = "gpt-4.1-mini";
  delete process.env.INTENT_PARSER_TIMEOUT_MS;
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  global.fetch = async () =>
    new Response(JSON.stringify({ error: "upstream failure" }), {
      status: 503,
      headers: {
        "content-type": "application/json",
      },
    });

  try {
    const response = await POST(
      new Request("http://localhost/api/intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rawIntent: "rebalance weth/usdc on base sepolia with medium risk using 1000000 base units",
        }),
      }),
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "PROVIDER_ERROR",
        message: "Intent parsing is temporarily unavailable.",
      },
    });
    assert.equal(loggedErrors.length, 1);
  } finally {
    process.env = previousEnv;
    global.fetch = previousFetch;
    console.error = previousConsoleError;
  }
});

test("POST returns INTERNAL_ERROR for unexpected request failures", async () => {
  const response = await POST({
    json: async () => {
      throw new Error("boom");
    },
  } as Request);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected intent parsing failure.",
    },
  });
});
