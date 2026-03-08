import { NextResponse } from "next/server";

import { executeCanonicalIntentWorkflow } from "../../../../../liquidmind/agentic-liquidity/src/canonical-intent-workflow";
import {
  IntentParserError,
  parseIntentRequestBody,
  parseIntentWithModel,
} from "@/lib/intent-parser";

export const runtime = "nodejs";

interface IntentRouteDependencies {
  parseIntent: typeof parseIntentWithModel;
  executeWorkflow: typeof executeCanonicalIntentWorkflow;
}

const DEFAULT_INTENT_ROUTE_DEPENDENCIES: IntentRouteDependencies = {
  parseIntent: parseIntentWithModel,
  executeWorkflow: executeCanonicalIntentWorkflow,
};

export async function POST(request: Request) {
  return handleIntentPost(request);
}

export async function handleIntentPost(
  request: Request,
  dependencies: IntentRouteDependencies = DEFAULT_INTENT_ROUTE_DEPENDENCIES,
) {
  try {
    const body = await request.json();
    const rawIntent = parseIntentRequestBody(body);
    const intent = await dependencies.parseIntent(rawIntent);
    const workflow = await dependencies.executeWorkflow(intent);

    return NextResponse.json({
      ok: true,
      intent: workflow.intent,
      workflow,
    });
  } catch (error) {
    if (error instanceof IntentParserError) {
      logIntentRouteError(error);
      const { body, status } = createIntentErrorResponse(error);
      return NextResponse.json(body, { status });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Request body must be valid JSON.",
          },
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected intent parsing failure.",
        },
      },
      {
        status: 500,
      },
    );
  }
}

export function createIntentErrorResponse(error: IntentParserError): {
  body: {
    ok: false;
    error: {
      code: IntentParserError["code"];
      message: string;
    };
  };
  status: number;
} {
  return {
    body: {
      ok: false,
      error: {
        code: error.code,
        message: getClientSafeIntentParserMessage(error),
      },
    },
    status: getIntentParserStatus(error.code),
  };
}

function getIntentParserStatus(code: IntentParserError["code"]): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "VALIDATION_ERROR":
      return 422;
    case "PROVIDER_ERROR":
      return 502;
    case "CONFIG_ERROR":
      return 500;
    default:
      return 500;
  }
}

function getClientSafeIntentParserMessage(error: IntentParserError): string {
  switch (error.code) {
    case "BAD_REQUEST":
    case "VALIDATION_ERROR":
      return error.message;
    case "PROVIDER_ERROR":
      return "Intent parsing is temporarily unavailable.";
    case "CONFIG_ERROR":
      return "Intent parsing is not available on this server.";
    default:
      return "Unexpected intent parsing failure.";
  }
}

function logIntentRouteError(error: IntentParserError): void {
  if (error.code === "BAD_REQUEST" || error.code === "VALIDATION_ERROR") {
    return;
  }

  console.error("[api/intent]", error);
}
