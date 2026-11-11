import { NextRequest, NextResponse } from "next/server";
import { DraftPRRequestSchema } from "@/lib/pr/types";
import { getDraftPRCreator } from "@/lib/pr/pr-factory";
import { SlidingWindowRateLimiter, getRateLimitHeaders } from "@/lib/security/rate-limiter";
import { sanitizeError, redactSecrets } from "@/lib/security/redactor";

// Strict rate limit: max 5 draft PR creation attempts per 60 seconds per IP
const prRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check
    const ip = req.headers.get("x-forwarded-for") || "localhost";
    const rateStatus = prRateLimiter.check(ip);

    if (rateStatus.isLimited) {
      return NextResponse.json(
        { error: "Draft PR rate limit exceeded. Please wait a minute before making another request." },
        { status: 429, headers: getRateLimitHeaders(rateStatus) }
      );
    }

    // 2. Parse JSON body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400, headers: getRateLimitHeaders(rateStatus) }
      );
    }

    // 3. Schema validation with strict human confirmation gate
    const parseResult = DraftPRRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return NextResponse.json(
        { error: `Validation error: ${errorMsg}` },
        { status: 400, headers: getRateLimitHeaders(rateStatus) }
      );
    }

    const payload = parseResult.data;

    // 4. Sanitize issue title against embedded secrets before drafting
    payload.issueTitle = redactSecrets(payload.issueTitle);

    // 5. Create draft pull request via decoupled creator
    const creator = getDraftPRCreator();
    const result = await creator.createDraftPR(payload);

    return NextResponse.json(
      {
        success: true,
        draftPR: result,
      },
      { headers: getRateLimitHeaders(rateStatus) }
    );
  } catch (err: unknown) {
    const safeMessage = sanitizeError(err);
    return NextResponse.json(
      { error: safeMessage || "An unexpected error occurred while creating the draft pull request." },
      { status: 500 }
    );
  }
}
