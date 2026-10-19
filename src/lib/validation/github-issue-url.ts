import { z } from "zod";

export interface ParsedGitHubIssue {
  owner: string;
  repo: string;
  issueNumber: number;
  normalizedUrl: string;
}

export type ParseIssueUrlResult =
  | { success: true; data: ParsedGitHubIssue }
  | { success: false; error: string };

// GitHub naming patterns
// Owner: Alphanumeric with single hyphens, underscores, or dots (cannot start/end with dot/hyphen)
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
// Repo: Alphanumeric, underscores, hyphens, and periods
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+$/;
// Issue number: Strictly positive integer
const ISSUE_NUMBER_REGEX = /^[1-9][0-9]*$/;

const RawUrlSchema = z
  .string()
  .trim()
  .min(1, "URL cannot be empty")
  .max(500, "URL exceeds maximum length of 500 characters");

export function parseGitHubIssueUrl(rawInput: string): ParseIssueUrlResult {
  const schemaResult = RawUrlSchema.safeParse(rawInput);
  if (!schemaResult.success) {
    const message = schemaResult.error.issues?.[0]?.message || "Invalid input";
    return { success: false, error: message };
  }

  const trimmed = schemaResult.data;

  let urlObj: URL;
  try {
    urlObj = new URL(trimmed);
  } catch {
    return { success: false, error: "Malformed URL. Please provide a valid, well-formed HTTPS URL." };
  }

  // 1. Enforce HTTPS only
  if (urlObj.protocol !== "https:") {
    return {
      success: false,
      error: `Unsupported protocol "${urlObj.protocol}". Only secure "https://" URLs are permitted.`,
    };
  }

  // 2. Reject credentials in URL (e.g., https://user:pass@github.com)
  if (urlObj.username || urlObj.password) {
    return {
      success: false,
      error: "URLs containing embedded credentials or userinfo are not permitted.",
    };
  }

  // 3. Enforce hostname strictly to github.com (or www.github.com)
  const hostname = urlObj.hostname.toLowerCase();
  if (hostname !== "github.com" && hostname !== "www.github.com") {
    return {
      success: false,
      error: `Invalid domain "${hostname}". Only public repositories on github.com are supported.`,
    };
  }

  // 4. Reject unexpected ports
  if (urlObj.port && urlObj.port !== "443") {
    return {
      success: false,
      error: `Unexpected port "${urlObj.port}". Default HTTPS port 443 only.`,
    };
  }

  // 5. Parse and inspect path segments
  // Split path, filtering out empty segments
  const pathSegments = urlObj.pathname.split("/").filter((segment) => segment.length > 0);

  // Detect Pull Request URLs specifically to provide helpful error
  if (pathSegments.length >= 3 && pathSegments[2].toLowerCase() === "pull") {
    return {
      success: false,
      error: "This is a Pull Request URL, not an Issue. PatchPilot only accepts GitHub Issue URLs.",
    };
  }

  // Expected format: /{owner}/{repo}/issues/{issueNumber} -> exactly 4 segments
  if (pathSegments.length < 4) {
    if (pathSegments.length === 3 && pathSegments[2].toLowerCase() === "issues") {
      return {
        success: false,
        error: "Missing issue number in the URL (e.g. /issues/123).",
      };
    }
    return {
      success: false,
      error: "Incomplete GitHub issue path. Expected format: https://github.com/{owner}/{repo}/issues/{number}",
    };
  }

  if (pathSegments.length > 4) {
    return {
      success: false,
      error: "URL contains unexpected extra path segments after the issue number.",
    };
  }

  const [owner, repo, issuesKeyword, issueNumberStr] = pathSegments;

  // Verify 'issues' literal
  if (issuesKeyword.toLowerCase() !== "issues") {
    return {
      success: false,
      error: `Expected "/issues/" in URL path, but found "/${issuesKeyword}/".`,
    };
  }

  // Validate owner format
  if (!GITHUB_OWNER_REGEX.test(owner) || owner.length > 39) {
    return {
      success: false,
      error: `Invalid repository owner name "${owner}". Must be a valid GitHub user or organization name.`,
    };
  }

  // Validate repo format
  if (!GITHUB_REPO_REGEX.test(repo) || repo.length > 100 || repo === "." || repo === "..") {
    return {
      success: false,
      error: `Invalid repository name "${repo}".`,
    };
  }

  // Validate issue number format
  if (!ISSUE_NUMBER_REGEX.test(issueNumberStr)) {
    return {
      success: false,
      error: `Invalid issue number "${issueNumberStr}". Issue number must be a positive integer.`,
    };
  }

  const issueNumber = parseInt(issueNumberStr, 10);
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    return {
      success: false,
      error: "Issue number out of valid integer range.",
    };
  }

  // Safe normalized URL (standardized without www, query, or hash)
  const normalizedUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;

  return {
    success: true,
    data: {
      owner,
      repo,
      issueNumber,
      normalizedUrl,
    },
  };
}
