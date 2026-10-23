import { NextRequest, NextResponse } from "next/server";
import { parseGitHubIssueUrl } from "@/lib/validation/github-issue-url";
import { fetchGitHubIssueMetadata } from "@/lib/github/client";
import { buildInvestigationContext } from "@/lib/github/context-collector";

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
    const issueResult = await fetchGitHubIssueMetadata(owner, repo, issueNumber);
    if (!issueResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: issueResult.error,
          code: issueResult.code,
          rateLimit: issueResult.rateLimit,
        },
        { status: issueResult.status ?? 500 }
      );
    }

    // 3. Build bounded repository investigation plan
    const contextResult = await buildInvestigationContext(issueResult.data);
    if (!contextResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: contextResult.error,
          code: contextResult.code,
          rateLimit: issueResult.rateLimit,
        },
        { status: contextResult.status ?? 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: contextResult.data,
        issueMetadata: issueResult.data,
        rateLimit: issueResult.rateLimit,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected internal error occurred while generating the investigation plan.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
