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
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: getIntentParserStatus(error.code),
        },
      );
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
