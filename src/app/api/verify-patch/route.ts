import { NextRequest, NextResponse } from "next/server";
import { VerificationJobRequestSchema, VerificationJob } from "@/lib/verification/types";
import { validateVerificationCommand } from "@/lib/verification/command-allowlist";
import { getVerificationWorker } from "@/lib/verification/worker-factory";

// In-memory IP rate limiter: max 10 verification runs per 60 seconds per IP
const requestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestHistory.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestHistory.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check
    const ip = req.headers.get("x-forwarded-for") || "localhost";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute before requesting another patch verification." },
        { status: 429 }
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
    const error = err as Error;
    const safeMessage = error.message?.replace(/(key|token)=[^\s&]+/gi, "$1=[REDACTED]");
    return NextResponse.json(
      { error: safeMessage || "An unexpected error occurred during patch verification." },
      { status: 500 }
    );
  }
}
