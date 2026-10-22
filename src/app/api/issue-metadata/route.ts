import { NextRequest, NextResponse } from "next/server";
import { parseGitHubIssueUrl } from "@/lib/validation/github-issue-url";
import { fetchGitHubIssueMetadata } from "@/lib/github/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || typeof body.url !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be a JSON object with a 'url' string property.",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    // 1. Strict URL validation and SSRF protection
    const parseResult = parseGitHubIssueUrl(body.url);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error,
          code: "INVALID_ISSUE_URL",
        },
        { status: 422 }
      );
    }

    const { owner, repo, issueNumber } = parseResult.data;

    // 2. Fetch issue metadata server-side
    const result = await fetchGitHubIssueMetadata(owner, repo, issueNumber);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.code,
          rateLimit: result.rateLimit,
        },
        { status: result.status ?? 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        rateLimit: result.rateLimit,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected internal server error occurred while retrieving issue metadata.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
