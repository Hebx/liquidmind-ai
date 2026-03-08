import assert from "node:assert/strict";
import test from "node:test";

import { IntentParserError } from "@/lib/intent-parser";

import { createIntentErrorResponse, POST } from "./route.js";

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
