import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLLMProvider } from "@/lib/llm/provider-factory";

// Simple in-memory rate limiter: max 15 requests per 60 seconds per IP
const requestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestHistory.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestHistory.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

const RequestSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string().min(1).max(500),
  issueBody: z.string().max(30000),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        content: z.string().max(35000),
      })
    )
    .min(1, "At least one context file is required to propose a patch")
    .max(5, "At most 5 context files can be included"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check
    const ip = req.headers.get("x-forwarded-for") || "localhost";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a minute before requesting another patch proposal." },
        { status: 429 }
      );
    }

    // 2. Validate request payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation error: ${errorMsg}` }, { status: 400 });
    }

    const { owner, repo, issueNumber, issueTitle, issueBody, files } = parseResult.data;

    // 3. Obtain LLM provider
    let provider;
    try {
      provider = getLLMProvider();
    } catch (err: unknown) {
      const error = err as Error;
      return NextResponse.json(
        { error: `Provider initialization failed: ${error.message}` },
        { status: 400 }
      );
    }

    // 4. Propose patch
    const proposal = await provider.proposePatch({
      owner,
      repo,
      issueNumber,
      issueTitle,
      issueBody,
      files,
    });

    return NextResponse.json({
      success: true,
      proposal,
    });
  } catch (err: unknown) {
    const error = err as Error;
    // Ensure secrets are never leaked in error response
    const safeMessage = error.message?.replace(/(key|token)=[^\s&]+/gi, "$1=[REDACTED]");
    return NextResponse.json(
      { error: safeMessage || "An unexpected error occurred while generating the patch proposal." },
      { status: 500 }
    );
  }
}
