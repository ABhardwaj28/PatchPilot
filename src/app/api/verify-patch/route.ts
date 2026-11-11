import { NextRequest, NextResponse } from "next/server";
import { VerificationJobRequestSchema, VerificationJob } from "@/lib/verification/types";
import { validateVerificationCommand } from "@/lib/verification/command-allowlist";
import { getVerificationWorker } from "@/lib/verification/worker-factory";
import { sanitizeError } from "@/lib/security/redactor";
import { SlidingWindowRateLimiter, getRateLimitHeaders } from "@/lib/security/rate-limiter";

// In-memory IP rate limiter: max 10 verification runs per 60 seconds per IP
const verificationRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check
    const ip = req.headers.get("x-forwarded-for") || "localhost";
    const rateStatus = verificationRateLimiter.check(ip);
    if (rateStatus.isLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute before requesting another patch verification." },
        { status: 429, headers: getRateLimitHeaders(rateStatus) }
      );
    }

    // 2. Parse request JSON
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    // 3. Schema validation
    const parseResult = VerificationJobRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return NextResponse.json({ error: `Validation error: ${errorMsg}` }, { status: 400 });
    }

    const { owner, repo, targetPath, unifiedDiff, command } = parseResult.data;

    // 4. Validate test command against security allowlist
    const commandCheck = validateVerificationCommand(command);
    if (!commandCheck.isValid) {
      return NextResponse.json(
        { error: `Security check failed: ${commandCheck.reason}` },
        { status: 400 }
      );
    }

    // 5. Build verification job
    const job: VerificationJob = {
      jobId: `job-${crypto.randomUUID().slice(0, 12)}`,
      owner,
      repo,
      targetPath,
      unifiedDiff,
      command: commandCheck.normalizedCommand || command,
      createdAt: new Date().toISOString(),
      timeoutMs: 60000,
    };

    // 6. Execute job via worker adapter
    const worker = getVerificationWorker();
    const result = await worker.runJob(job);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const safeMessage = sanitizeError(err);
    return NextResponse.json(
      { error: safeMessage || "An unexpected error occurred during patch verification." },
      { status: 500 }
    );
  }
}
