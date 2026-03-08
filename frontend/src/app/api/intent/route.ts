import { NextResponse } from "next/server";

import {
  IntentParserError,
  parseIntentRequestBody,
  parseIntentWithModel,
} from "@/lib/intent-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawIntent = parseIntentRequestBody(body);
    const intent = await parseIntentWithModel(rawIntent);

    return NextResponse.json({ ok: true, intent });
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
