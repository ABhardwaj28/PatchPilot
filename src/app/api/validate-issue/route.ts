import { NextRequest, NextResponse } from "next/server";
import { parseGitHubIssueUrl } from "@/lib/validation/github-issue-url";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || typeof body.url !== "string") {
      return NextResponse.json(
        {
          valid: false,
          error: "Request body must be a JSON object containing a 'url' string property.",
        },
        { status: 400 }
      );
    }

    const parseResult = parseGitHubIssueUrl(body.url);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          valid: false,
          error: parseResult.error,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        data: parseResult.data,
        statusLabel: "Validation Only — Issue metadata has not been fetched yet",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        valid: false,
        error: "Internal server error occurred while validating the issue URL.",
      },
      { status: 500 }
    );
  }
}
