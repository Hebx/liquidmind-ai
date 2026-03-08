import {
  normalizeIntentInput,
  toIntentPayload,
  type LiquidityIntentPayload,
} from "../../../liquidmind/agentic-liquidity/src/lib/intent";

const DEFAULT_PROVIDER_URL_PATH = "/v1/chat/completions";
const DEFAULT_MODEL_TEMPERATURE = 0;
const DEFAULT_MIN_YIELD = 5;
const DEFAULT_RISK_TOLERANCE = "medium";
const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const MAX_RAW_INTENT_LENGTH = 10_000;

assertServerOnlyModule();

const INTENT_PARSER_SYSTEM_PROMPT = [
  "You are a server-side parser for LiquidMind milestone intents.",
  "Return only valid JSON with exactly these keys: action, tokenA, tokenB, amount, preferredChains, riskTolerance, minYield.",
  'Always set action to "rebalance".',
  "Preserve the user's requested chain and token symbols when they are unsupported so downstream validation can reject them cleanly.",
  "Never rewrite an unsupported asset or chain into WETH, USDC, or base-sepolia.",
  "Only milestone defaults are allowed when the user omitted a value entirely: preferredChains defaults to ['base-sepolia'], riskTolerance defaults to 'medium', minYield defaults to 5.",
  "Do not infer token decimals or convert human-readable token amounts into base units.",
  "If the user does not provide a base-unit integer amount, copy the amount text into the amount field as a string so validation can reject it.",
  "Use uppercase token symbols when you can identify them from the prompt.",
  "Return JSON only. No markdown or explanation.",
].join(" ");

export type IntentParserErrorCode =
  | "BAD_REQUEST"
  | "CONFIG_ERROR"
  | "PROVIDER_ERROR"
  | "VALIDATION_ERROR";

export type IntentModelOutputProvider = (rawIntent: string) => Promise<unknown>;

interface CreateOpenAICompatibleIntentProviderOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class IntentParserError extends Error {
  code: IntentParserErrorCode;

  constructor(code: IntentParserErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IntentParserError";
    this.code = code;
  }
}

export function parseIntentRequestBody(body: unknown): string {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new IntentParserError("BAD_REQUEST", "Request body must be a JSON object with rawIntent.");
  }

  const rawIntent = (body as { rawIntent?: unknown }).rawIntent;
  if (typeof rawIntent !== "string" || !rawIntent.trim()) {
    throw new IntentParserError("BAD_REQUEST", "rawIntent must be a non-empty string.");
  }

  const normalizedRawIntent = rawIntent.trim();
  if (normalizedRawIntent.length > MAX_RAW_INTENT_LENGTH) {
    throw new IntentParserError(
      "BAD_REQUEST",
      `rawIntent is too long. Maximum length is ${MAX_RAW_INTENT_LENGTH} characters.`,
    );
  }

  return normalizedRawIntent;
}

export async function parseIntentWithModel(
  rawIntent: string,
  provider: IntentModelOutputProvider = createOpenAICompatibleIntentProvider(),
): Promise<LiquidityIntentPayload> {
  const normalizedRawIntent = parseIntentRequestBody({ rawIntent });

  let candidate: unknown;
  try {
    candidate = await provider(normalizedRawIntent);
  } catch (error) {
    if (error instanceof IntentParserError) {
      throw error;
    }

    throw new IntentParserError("PROVIDER_ERROR", "Intent parser provider call failed.", {
      cause: error,
    });
  }

  return validateCanonicalIntentPayload(candidate);
}

export function validateCanonicalIntentPayload(candidate: unknown): LiquidityIntentPayload {
  try {
    return toIntentPayload(normalizeIntentInput(candidate));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intent validation failed.";
    throw new IntentParserError("VALIDATION_ERROR", message, { cause: error });
  }
}

export function createOpenAICompatibleIntentProvider(
  options: CreateOpenAICompatibleIntentProviderOptions = {},
): IntentModelOutputProvider {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = resolveTimeoutMs(env.INTENT_PARSER_TIMEOUT_MS, options.timeoutMs);

  const apiUrl = resolveProviderUrl(env);
  const apiKey = env.INTENT_PARSER_API_KEY;
  const model = env.INTENT_PARSER_MODEL;

  if (!apiKey) {
    throw new IntentParserError(
      "CONFIG_ERROR",
      "Missing INTENT_PARSER_API_KEY for the server-side intent parser.",
    );
  }

  if (!model) {
    throw new IntentParserError(
      "CONFIG_ERROR",
      "Missing INTENT_PARSER_MODEL for the server-side intent parser.",
    );
  }

  return async (rawIntent: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error("Intent parser request timed out."));
    }, timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: DEFAULT_MODEL_TEMPERATURE,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: INTENT_PARSER_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: buildIntentParserUserPrompt(rawIntent),
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new IntentParserError(
          "PROVIDER_ERROR",
          `Intent parser provider request timed out after ${timeoutMs}ms.`,
          { cause: error },
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new IntentParserError(
        "PROVIDER_ERROR",
        `Intent parser provider request failed with status ${response.status}.`,
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new IntentParserError(
        "PROVIDER_ERROR",
        "Intent parser provider response did not include JSON content.",
      );
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new IntentParserError(
        "PROVIDER_ERROR",
        "Intent parser provider returned invalid JSON content.",
        { cause: error },
      );
    }
  };
}

function resolveProviderUrl(env: NodeJS.ProcessEnv): string {
  if (env.INTENT_PARSER_API_URL) {
    return parseProviderUrl(env.INTENT_PARSER_API_URL, "INTENT_PARSER_API_URL");
  }

  if (!env.INTENT_PARSER_BASE_URL) {
    throw new IntentParserError(
      "CONFIG_ERROR",
      "Missing INTENT_PARSER_API_URL or INTENT_PARSER_BASE_URL for the server-side intent parser.",
    );
  }

  return parseProviderUrl(
    new URL(DEFAULT_PROVIDER_URL_PATH, parseProviderUrl(env.INTENT_PARSER_BASE_URL, "INTENT_PARSER_BASE_URL"))
      .toString(),
    "INTENT_PARSER_BASE_URL",
  );
}

function assertServerOnlyModule(): void {
  if (typeof window !== "undefined") {
    throw new Error("intent-parser must only be imported from the server.");
  }
}

function resolveTimeoutMs(rawTimeoutMs: string | undefined, timeoutMsOverride: number | undefined): number {
  const resolvedValue = timeoutMsOverride ?? rawTimeoutMs;
  if (resolvedValue == null) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  const parsedTimeoutMs =
    typeof resolvedValue === "number"
      ? resolvedValue
      : /^\d+$/.test(resolvedValue)
        ? Number(resolvedValue)
        : Number.NaN;

  if (!Number.isInteger(parsedTimeoutMs) || parsedTimeoutMs <= 0) {
    throw new IntentParserError(
      "CONFIG_ERROR",
      "INTENT_PARSER_TIMEOUT_MS must be a positive integer when configured.",
    );
  }

  return parsedTimeoutMs;
}

function parseProviderUrl(rawUrl: string, configKey: "INTENT_PARSER_API_URL" | "INTENT_PARSER_BASE_URL"): string {
  try {
    return new URL(rawUrl).toString();
  } catch (error) {
    throw new IntentParserError("CONFIG_ERROR", `${configKey} must be a valid URL.`, {
      cause: error,
    });
  }
}

function buildIntentParserUserPrompt(rawIntent: string): string {
  return JSON.stringify({
    supportedAction: "rebalance",
    supportedChains: ["base-sepolia"],
    supportedAssets: ["WETH", "USDC"],
    amountFormat: "base-unit integer string",
    defaults: {
      preferredChains: ["base-sepolia"],
      riskTolerance: DEFAULT_RISK_TOLERANCE,
      minYield: DEFAULT_MIN_YIELD,
    },
    rawIntent,
  });
}
