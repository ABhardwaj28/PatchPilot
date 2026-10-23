import { Octokit } from "octokit";
import {
  GitHubIssueMetadata,
  InvestigationReport,
  InvestigationResult,
  SelectedFileContext,
} from "./types";
import { createOctokitClient } from "./client";

export const CONTEXT_BOUNDS = {
  MAX_TREE_ENTRIES: 1000,
  MAX_SELECTED_FILES: 5,
  MAX_FILE_SIZE_BYTES: 30 * 1024, // 30 KB
  MAX_TOTAL_BYTES: 100 * 1024, // 100 KB
  MAX_PATH_DEPTH: 8,
  DEFAULT_TIMEOUT_MS: 8000,
} as const;

export const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".css",
  ".html",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".sql",
]);

export const EXCLUDED_DIR_PATTERNS: RegExp[] = [
  /^node_modules\//i,
  /^\.git\//i,
  /^\.github\//i,
  /^\.next\//i,
  /^dist\//i,
  /^build\//i,
  /^out\//i,
  /^target\//i,
  /^vendor\//i,
  /^coverage\//i,
  /^\.venv\//i,
  /^venv\//i,
  /^env\//i,
  /^__pycache__\//i,
  /^tmp\//i,
  /^\.cache\//i,
];

export const EXCLUDED_FILE_PATTERNS: RegExp[] = [
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /cargo\.lock$/i,
  /poetry\.lock$/i,
  /gemfile\.lock$/i,
  /composer\.lock$/i,
  /^\.env/i,
  /\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|keystore|crt|der|cer)$/i,
  /(^|\/)(id_rsa|id_dsa|id_ed25519)($|\.)/i,
  /credentials/i,
  /secret/i,
  /\.(png|jpe?g|gif|webp|ico|svg|bmp|tiff|pdf|wasm|exe|dll|so|dylib|zip|tar|gz|bz2|7z|mp3|mp4|mov|avi)$/i,
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "have",
  "does",
  "when",
  "which",
  "where",
  "after",
  "before",
  "some",
  "about",
  "could",
  "would",
  "should",
  "what",
  "into",
  "then",
  "than",
  "also",
  "there",
  "their",
  "been",
  "were",
  "will",
  "more",
  "over",
  "only",
  "just",
  "like",
  "same",
  "steps",
  "reproduce",
  "expected",
  "actual",
  "behavior",
  "issue",
  "error",
  "bug",
]);

export interface CollectContextOptions {
  timeoutMs?: number;
  octokitClient?: Octokit;
  maxFiles?: number;
  maxTotalBytes?: number;
}

interface ScoredCandidate {
  path: string;
  sizeBytes?: number;
  score: number;
  reasons: string[];
}

/**
 * Checks if a relative repository path is safe from path traversal.
 */
export function isSafeRepoPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  if (filePath.startsWith("/") || filePath.startsWith("\\")) return false;
  if (filePath.includes("\0")) return false;

  const segments = filePath.split(/[/\\]/);
  if (segments.some((seg) => seg === ".." || seg === "." || seg === "")) {
    return false;
  }

  if (segments.length > CONTEXT_BOUNDS.MAX_PATH_DEPTH) {
    return false;
  }

  return true;
}

/**
 * Checks if a file path is permitted by extension, directory, and secret/lockfile exclusion rules.
 */
export function isPermittedFilePath(filePath: string): boolean {
  if (!isSafeRepoPath(filePath)) return false;

  // Directory exclusions
  for (const pattern of EXCLUDED_DIR_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }

  // File and secret exclusions
  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }

  // Check supported extension
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Extracts meaningful keyword tokens from issue title and body.
 */
export function extractIssueKeywords(title: string, body: string): string[] {
  const combined = `${title} ${body}`;
  const tokens = combined.toLowerCase().match(/[a-z0-9_\-.]{3,}/g) ?? [];
  const unique = new Set<string>();

  for (const token of tokens) {
    // Strip trailing punctuation
    const clean = token.replace(/^[._-]+|[._-]+$/g, "");
    if (clean.length >= 3 && !STOP_WORDS.has(clean)) {
      unique.add(clean);
    }
  }

  return Array.from(unique).slice(0, 30);
}

/**
 * Extracts potential file paths or filenames explicitly referenced in the issue text.
 */
export function extractMentionedFiles(title: string, body: string): string[] {
  const combined = `${title} ${body}`;
  const fileRegex = /(?:^|[\s"'`([<{])([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8})(?:$|[\s"'`)\],;>}:])/g;
  const mentioned = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(combined)) !== null) {
    const candidate = match[1].replace(/^[._/]+|[._/]+$/g, "");
    if (candidate.length > 2 && isSafeRepoPath(candidate)) {
      const dot = candidate.lastIndexOf(".");
      if (dot !== -1) {
        const ext = candidate.slice(dot).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext) && !candidate.startsWith("http")) {
          mentioned.add(candidate);
        }
      }
    }
  }

  return Array.from(mentioned);
}

/**
 * Deterministic baseline relevance scoring heuristic with explainability reasons.
 */
export function scoreFileRelevance(
  filePath: string,
  keywords: string[],
  mentionedFiles: string[]
): ScoredCandidate | null {
  if (!isPermittedFilePath(filePath)) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];
  const lowerPath = filePath.toLowerCase();
  const segments = lowerPath.split("/");
  const fileName = segments[segments.length - 1];

  // 1. Explicit mention check (+50)
  const isExplicitlyMentioned = mentionedFiles.some((mf) => {
    const lowerMf = mf.toLowerCase();
    return lowerPath === lowerMf || lowerPath.endsWith(`/${lowerMf}`) || fileName === lowerMf;
  });

  if (isExplicitlyMentioned) {
    score += 50;
    reasons.push(`Explicitly mentioned in issue text`);
  }

  // 2. Keyword matching on filename (+15 per token) and path (+5 per token)
  const matchedFilenameTokens: string[] = [];
  const matchedPathTokens: string[] = [];

  for (const keyword of keywords) {
    if (fileName.includes(keyword)) {
      matchedFilenameTokens.push(keyword);
      score += 15;
    } else if (lowerPath.includes(keyword)) {
      matchedPathTokens.push(keyword);
      score += 5;
    }
  }

  if (matchedFilenameTokens.length > 0) {
    reasons.push(`Filename matches issue keywords: [${matchedFilenameTokens.slice(0, 3).join(", ")}]`);
  }
  if (matchedPathTokens.length > 0) {
    reasons.push(`Directory path matches issue keywords: [${matchedPathTokens.slice(0, 3).join(", ")}]`);
  }

  // 3. Core module boost (+10)
  if (/^(src|lib|app|pkg|core)\//i.test(filePath)) {
    score += 10;
    reasons.push(`Located in primary source directory`);
  }

  // 4. Test file penalty (-10) unless issue explicitly mentions test
  const isTestFile = /\.(test|spec)\.[a-z0-9]+$/i.test(filePath) || segments.includes("__tests__");
  const issueMentionsTest = keywords.includes("test") || keywords.includes("spec");

  if (isTestFile) {
    if (!issueMentionsTest) {
      score -= 10;
      reasons.push(`Test file deprioritized during initial root-cause search`);
    } else {
      score += 10;
      reasons.push(`Test file matches issue focus on test suites`);
    }
  }

  // 5. Nesting depth penalty (-2 per level above 3)
  if (segments.length > 3) {
    const penalty = (segments.length - 3) * 2;
    score -= penalty;
  }

  // Only return candidate if it has positive relevance or was explicitly mentioned
  if (score <= 0 && !isExplicitlyMentioned) {
    return null;
  }

  return {
    path: filePath,
    score,
    reasons: reasons.length > 0 ? reasons : ["General relevant source file"],
  };
}

/**
 * Builds bounded, read-only repository investigation context and generates an explainable investigation plan.
 * Never clones or executes repository code.
 */
export async function buildInvestigationContext(
  issue: GitHubIssueMetadata,
  options: CollectContextOptions = {}
): Promise<InvestigationResult> {
  const timeoutMs = options.timeoutMs ?? CONTEXT_BOUNDS.DEFAULT_TIMEOUT_MS;
  const maxFiles = options.maxFiles ?? CONTEXT_BOUNDS.MAX_SELECTED_FILES;
  const maxTotalBytes = options.maxTotalBytes ?? CONTEXT_BOUNDS.MAX_TOTAL_BYTES;
  const octokit = options.octokitClient ?? createOctokitClient();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { owner, repo } = issue;
    const defaultBranch = issue.repository.defaultBranch || "main";

    // 1. Fetch git tree recursively
    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "true",
      request: {
        signal: controller.signal,
      },
    });

    const treeEntries = treeResponse.data.tree || [];
    const scannedEntries = treeEntries.slice(0, CONTEXT_BOUNDS.MAX_TREE_ENTRIES);

    // 2. Extract issue context keywords and mentioned files
    const keywords = extractIssueKeywords(issue.title, issue.fullBody || issue.bodyExcerpt);
    const mentionedFiles = extractMentionedFiles(issue.title, issue.fullBody || issue.bodyExcerpt);

    // 3. Filter and score repository tree paths
    const scoredCandidates: ScoredCandidate[] = [];

    for (const entry of scannedEntries) {
      if (entry.type !== "blob" || !entry.path) continue;
      const scored = scoreFileRelevance(entry.path, keywords, mentionedFiles);
      if (scored) {
        scored.sizeBytes = entry.size;
        scoredCandidates.push(scored);
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. Retrieve bounded file contents for top-ranked files
    const selectedFiles: SelectedFileContext[] = [];
    let accumulatedBytes = 0;
    const candidateFilesToFetch = scoredCandidates.slice(0, maxFiles * 2);

    for (const candidate of candidateFilesToFetch) {
      if (selectedFiles.length >= maxFiles) break;
      if (accumulatedBytes >= maxTotalBytes) break;

      // Skip files exceeding max individual size limit early if size known
      if (candidate.sizeBytes && candidate.sizeBytes > CONTEXT_BOUNDS.MAX_FILE_SIZE_BYTES * 2) {
        continue;
      }

      try {
        const fileContentResponse = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: candidate.path,
          ref: defaultBranch,
          request: {
            signal: controller.signal,
          },
        });

        const fileData = fileContentResponse.data;
        if (!("content" in fileData) || typeof fileData.content !== "string") {
          continue;
        }

        const decoded = Buffer.from(fileData.content, "base64").toString("utf-8");
        const rawBytes = Buffer.byteLength(decoded, "utf-8");

        let content = decoded;
        let isTruncated = false;

        if (rawBytes > CONTEXT_BOUNDS.MAX_FILE_SIZE_BYTES) {
          content = decoded.slice(0, CONTEXT_BOUNDS.MAX_FILE_SIZE_BYTES);
          isTruncated = true;
        }

        const fileBytes = Buffer.byteLength(content, "utf-8");
        if (accumulatedBytes + fileBytes > maxTotalBytes && selectedFiles.length > 0) {
          // Total byte limit reached
          break;
        }

        accumulatedBytes += fileBytes;
        selectedFiles.push({
          path: candidate.path,
          sizeBytes: fileBytes,
          content,
          relevanceScore: candidate.score,
          selectionReasons: candidate.reasons,
          isTruncated,
        });
      } catch {
        // Gracefully ignore individual file fetch errors (e.g. submodule, 404, or permissions)
      }
    }

    // 5. Synthesize affected areas and missing context
    const affectedDirs = new Set<string>();
    for (const file of selectedFiles) {
      const parts = file.path.split("/");
      if (parts.length > 1) {
        affectedDirs.add(parts.slice(0, 2).join("/"));
      } else {
        affectedDirs.add("root");
      }
    }

    const missingContext: string[] = [
      "Dependency directories (node_modules, vendor) and lockfiles excluded by security policy.",
      `Context bounded to top ${maxFiles} relevant files (${(accumulatedBytes / 1024).toFixed(1)} KB / ${(maxTotalBytes / 1024).toFixed(0)} KB max quota).`,
      "Untrusted repository code was not cloned, compiled, or executed.",
      "Runtime execution states, environmental dependencies, and server-side logs remain unverified.",
    ];

    if (scannedEntries.length < treeEntries.length) {
      missingContext.push(
        `Repository has ${treeEntries.length} items; search was bounded to the first ${CONTEXT_BOUNDS.MAX_TREE_ENTRIES} entries.`
      );
    }

    const primaryTarget = selectedFiles.length > 0 ? selectedFiles[0].path : "identified source files";

    const proposedNextSteps: string[] = [
      `Review candidate lines in primary module: ${primaryTarget}`,
      "Formulate a minimal unit regression test mirroring reported issue behavior",
      "Draft a targeted unified diff patch modifying only the necessary logic (Stage 5)",
      "Run patch verification tests inside an ephemeral, network-isolated sandbox (Stage 6)",
    ];

    const report: InvestigationReport = {
      issueSummary: {
        owner,
        repo,
        issueNumber: issue.issueNumber,
        title: issue.title,
        extractedKeywords: keywords.slice(0, 10),
        mentionedFiles,
      },
      likelyAffectedAreas: Array.from(affectedDirs),
      selectedFiles,
      skippedFilesCount: Math.max(0, scannedEntries.length - selectedFiles.length),
      totalScannedFiles: scannedEntries.length,
      totalContextBytes: accumulatedBytes,
      limits: {
        maxFiles,
        maxFileSizeBytes: CONTEXT_BOUNDS.MAX_FILE_SIZE_BYTES,
        maxTotalBytes,
      },
      missingContext,
      proposedNextSteps,
      disclaimer:
        "Hypothesis only: Unverified by execution. PatchPilot collects bounded read-only repository context and does not execute untrusted code.",
    };

    return {
      success: true,
      data: report,
    };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      return {
        success: false,
        error: `Investigation timed out after ${timeoutMs / 1000} seconds while gathering repository context.`,
        code: "TIMEOUT",
        status: 504,
      };
    }

    const httpError = error as { status?: number; message?: string };
    const status = httpError?.status ?? 500;

    if (status === 404) {
      return {
        success: false,
        error: "Repository tree or default branch was not found. Please verify repository accessibility.",
        code: "NOT_FOUND",
        status: 404,
      };
    }

    if (status === 403 || status === 429) {
      return {
        success: false,
        error: "GitHub API rate limit exceeded while retrieving repository tree. Add GITHUB_TOKEN to .env.local for higher limits.",
        code: "RATE_LIMITED",
        status: 429,
      };
    }

    return {
      success: false,
      error: "Failed to gather repository context due to an unexpected API or network error.",
      code: "NETWORK_ERROR",
      status: 500,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
