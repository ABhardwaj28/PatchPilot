import { Octokit } from "octokit";
import {
  GitHubIssueMetadata,
  GitHubIssueResult,
  GitHubRateLimitInfo,
  GitHubIssueLabel,
} from "./types";

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BODY_EXCERPT_LENGTH = 1000;
const MAX_FULL_BODY_LENGTH = 10000;

const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9._-]+$/;

export interface FetchIssueOptions {
  timeoutMs?: number;
  octokitClient?: Octokit;
}

/**
 * Creates an Octokit client.
 * Uses GITHUB_TOKEN environment variable if available for increased rate limits.
 * Never hardcodes or returns the token.
 */
export function createOctokitClient(token?: string): Octokit {
  const authToken = token ?? process.env.GITHUB_TOKEN;

  if (authToken && authToken.trim() !== "" && authToken !== "your_github_personal_access_token_placeholder") {
    return new Octokit({
      auth: authToken.trim(),
    });
  }

  return new Octokit();
}

/**
 * Extracts rate limit details from GitHub response headers safely.
 */
function extractRateLimit(headers: Record<string, unknown>): GitHubRateLimitInfo | undefined {
  try {
    const limit = headers["x-ratelimit-limit"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];

    if (limit !== undefined && remaining !== undefined) {
      const limitNum = Number(limit);
      const remainingNum = Number(remaining);
      const resetEpoch = reset ? Number(reset) * 1000 : Date.now() + 3600000;

      return {
        limit: isNaN(limitNum) ? 60 : limitNum,
        remaining: isNaN(remainingNum) ? 0 : remainingNum,
        resetAt: new Date(resetEpoch).toISOString(),
        isLow: !isNaN(remainingNum) && remainingNum < 5,
      };
    }
  } catch {
    // Gracefully ignore header parsing issues
  }

  return undefined;
}

/**
 * Safely fetches public GitHub issue and repository metadata server-side.
 * Enforces timeout, bounded sizes, SSRF protections, and strict error mappings.
 */
export async function fetchGitHubIssueMetadata(
  owner: string,
  repo: string,
  issueNumber: number,
  options: FetchIssueOptions = {}
): Promise<GitHubIssueResult> {
  // 1. SSRF and input safety checks
  if (
    !owner ||
    !repo ||
    !SAFE_IDENTIFIER_REGEX.test(owner) ||
    !SAFE_IDENTIFIER_REGEX.test(repo) ||
    !Number.isInteger(issueNumber) ||
    issueNumber <= 0
  ) {
    return {
      success: false,
      error: "Invalid repository or issue parameters provided.",
      code: "INVALID_RESPONSE",
      status: 400,
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const octokit = options.octokitClient ?? createOctokitClient();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 2. Fetch issue metadata
    const issueResponse = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
      request: {
        signal: controller.signal,
      },
    });

    const rateLimit = extractRateLimit(issueResponse.headers as Record<string, unknown>);
    const issue = issueResponse.data;

    // Reject pull requests masquerading under issues API
    if (Boolean(issue.pull_request)) {
      return {
        success: false,
        error: `GitHub resource #${issueNumber} in ${owner}/${repo} is a Pull Request. PatchPilot only analyzes public Issues.`,
        code: "PULL_REQUEST_NOT_SUPPORTED",
        status: 422,
        rateLimit,
      };
    }

    // 3. Fetch repository summary
    const repoResponse = await octokit.rest.repos.get({
      owner,
      repo,
      request: {
        signal: controller.signal,
      },
    });

    const repository = repoResponse.data;

    // 4. Sanitize and bound string fields
    const rawBody = issue.body ?? "";
    const cleanBody = rawBody.slice(0, MAX_FULL_BODY_LENGTH);
    const bodyExcerpt =
      cleanBody.length > MAX_BODY_EXCERPT_LENGTH
        ? `${cleanBody.slice(0, MAX_BODY_EXCERPT_LENGTH)}...`
        : cleanBody;

    const labels: GitHubIssueLabel[] = (issue.labels ?? []).map((label) => {
      if (typeof label === "string") {
        return {
          id: label,
          name: label,
          color: "6e7681",
          description: null,
        };
      }
      return {
        id: label.id ?? label.name ?? "unknown",
        name: label.name ?? "unnamed",
        color: label.color ?? "6e7681",
        description: label.description ?? null,
      };
    });

    const metadata: GitHubIssueMetadata = {
      owner,
      repo,
      issueNumber,
      title: issue.title,
      state: issue.state === "closed" ? "closed" : "open",
      bodyExcerpt,
      fullBody: cleanBody,
      htmlUrl: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      commentsCount: issue.comments ?? 0,
      author: {
        login: issue.user?.login ?? "anonymous",
        avatarUrl: issue.user?.avatar_url ?? "",
        htmlUrl: issue.user?.html_url ?? "",
      },
      labels,
      repository: {
        fullName: repository.full_name,
        description: repository.description ?? null,
        isPrivate: repository.private,
        starsCount: repository.stargazers_count ?? 0,
        forksCount: repository.forks_count ?? 0,
        openIssuesCount: repository.open_issues_count ?? 0,
        defaultBranch: repository.default_branch ?? "main",
        language: repository.language ?? null,
        htmlUrl: repository.html_url,
      },
    };

    return {
      success: true,
      data: metadata,
      rateLimit,
    };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      return {
        success: false,
        error: `GitHub API request timed out after ${timeoutMs / 1000} seconds. Please check your connection.`,
        code: "TIMEOUT",
        status: 504,
      };
    }

    // Inspect HTTP status codes from Octokit RequestError
    const httpError = error as { status?: number; message?: string; response?: { headers?: Record<string, unknown> } };
    const status = httpError?.status;
    const rateLimit = httpError?.response?.headers ? extractRateLimit(httpError.response.headers) : undefined;

    if (status === 404) {
      return {
        success: false,
        error: `Repository or issue '${owner}/${repo}#${issueNumber}' not found. Please verify the URL points to an existing public issue.`,
        code: "NOT_FOUND",
        status: 404,
        rateLimit,
      };
    }

    if (status === 403 || status === 429) {
      const isRateLimit =
        rateLimit?.remaining === 0 ||
        (typeof httpError?.message === "string" && /rate limit/i.test(httpError.message));

      if (isRateLimit) {
        return {
          success: false,
          error: "GitHub API rate limit exceeded. Anonymous requests are limited to 60 requests/hour. Configure GITHUB_TOKEN in .env.local for higher limits.",
          code: "RATE_LIMITED",
          status: 429,
          rateLimit,
        };
      }

      return {
        success: false,
        error: "Access to this GitHub repository or issue was forbidden (403).",
        code: "FORBIDDEN",
        status: 403,
        rateLimit,
      };
    }

    if (status === 401) {
      return {
        success: false,
        error: "GitHub authentication failed. Please check the GITHUB_TOKEN configured in your server environment.",
        code: "UNAUTHORIZED",
        status: 401,
        rateLimit,
      };
    }

    if (typeof status === "number" && status >= 500) {
      return {
        success: false,
        error: "GitHub API service is currently unavailable (5xx). Please try again shortly.",
        code: "SERVER_ERROR",
        status,
        rateLimit,
      };
    }

    return {
      success: false,
      error: "Unable to retrieve GitHub issue metadata due to a network or unexpected response error.",
      code: "NETWORK_ERROR",
      status: 500,
      rateLimit,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
