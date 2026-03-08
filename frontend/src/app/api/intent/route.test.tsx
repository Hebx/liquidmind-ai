import assert from "node:assert/strict";
import test from "node:test";

import { IntentParserError } from "@/lib/intent-parser";

import { createIntentErrorResponse } from "./route.js";

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
