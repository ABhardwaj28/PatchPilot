import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSafeRepoPath,
  isPermittedFilePath,
  extractIssueKeywords,
  extractMentionedFiles,
  scoreFileRelevance,
  buildInvestigationContext,
  CONTEXT_BOUNDS,
} from "@/lib/github/context-collector";
import { GitHubIssueMetadata } from "@/lib/github/types";
import { Octokit } from "octokit";

describe("Stage 4 Bounded Context Collector & Investigation Plan", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Path Safety and Filtering (isSafeRepoPath & isPermittedFilePath)", () => {
    it("accepts valid, safe relative repository paths", () => {
      expect(isSafeRepoPath("src/index.ts")).toBe(true);
      expect(isSafeRepoPath("lib/client/service.py")).toBe(true);
      expect(isSafeRepoPath("package.json")).toBe(true);
    });

    it("rejects path traversal attempts", () => {
      expect(isSafeRepoPath("../escape.ts")).toBe(false);
      expect(isSafeRepoPath("src/../../etc/passwd")).toBe(false);
      expect(isSafeRepoPath("..")).toBe(false);
    });

    it("rejects absolute paths and null byte injection", () => {
      expect(isSafeRepoPath("/etc/passwd")).toBe(false);
      expect(isSafeRepoPath("\\Windows\\System32")).toBe(false);
      expect(isSafeRepoPath("src/index\0.ts")).toBe(false);
    });

    it("rejects paths exceeding maximum directory nesting depth", () => {
      const veryDeepPath = "a/b/c/d/e/f/g/h/i/j/file.ts";
      expect(isSafeRepoPath(veryDeepPath)).toBe(false);
    });

    it("permits allowed text/code extensions", () => {
      expect(isPermittedFilePath("src/app.tsx")).toBe(true);
      expect(isPermittedFilePath("main.py")).toBe(true);
      expect(isPermittedFilePath("server.go")).toBe(true);
      expect(isPermittedFilePath("Cargo.toml")).toBe(true);
      expect(isPermittedFilePath("README.md")).toBe(true);
    });

    it("excludes dependency and build directories by policy", () => {
      expect(isPermittedFilePath("node_modules/react/index.js")).toBe(false);
      expect(isPermittedFilePath(".git/config")).toBe(false);
      expect(isPermittedFilePath(".next/static/bundle.js")).toBe(false);
      expect(isPermittedFilePath("dist/main.js")).toBe(false);
      expect(isPermittedFilePath("vendor/bundle.js")).toBe(false);
      expect(isPermittedFilePath("coverage/lcov.info")).toBe(false);
      expect(isPermittedFilePath(".venv/lib/python.py")).toBe(false);
    });

    it("excludes lockfiles, binaries, and sensitive secrets", () => {
      expect(isPermittedFilePath("package-lock.json")).toBe(false);
      expect(isPermittedFilePath("yarn.lock")).toBe(false);
      expect(isPermittedFilePath("pnpm-lock.yaml")).toBe(false);
      expect(isPermittedFilePath(".env")).toBe(false);
      expect(isPermittedFilePath(".env.local")).toBe(false);
      expect(isPermittedFilePath(".env.production")).toBe(false);
      expect(isPermittedFilePath("id_rsa")).toBe(false);
      expect(isPermittedFilePath("credentials.json")).toBe(false);
      expect(isPermittedFilePath("server.key")).toBe(false);
      expect(isPermittedFilePath("image.png")).toBe(false);
      expect(isPermittedFilePath("app.wasm")).toBe(false);
      expect(isPermittedFilePath("archive.tar.gz")).toBe(false);
    });
  });

  describe("Keyword and Mentioned File Extraction", () => {
    it("extracts unique keywords and strips common stop words", () => {
      const title = "Bug: Memory leak in auth client session";
      const body = "When the user logs in, the session token does not refresh and causes an error";
      const keywords = extractIssueKeywords(title, body);

      expect(keywords).toContain("memory");
      expect(keywords).toContain("leak");
      expect(keywords).toContain("auth");
      expect(keywords).toContain("client");
      expect(keywords).toContain("session");
      expect(keywords).toContain("token");
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("when");
      expect(keywords).not.toContain("and");
    });

    it("extracts explicitly referenced filenames from issue text", () => {
      const body = "Check `src/auth/client.ts` and `config/auth.json` when verifying the failure";
      const mentioned = extractMentionedFiles("Issue Title", body);

      expect(mentioned).toContain("src/auth/client.ts");
      expect(mentioned).toContain("config/auth.json");
    });
  });

  describe("Deterministic Relevance Scoring & Explainability", () => {
    it("gives highest boost to files explicitly mentioned in the issue", () => {
      const scored = scoreFileRelevance("src/auth/client.ts", ["auth", "token"], ["src/auth/client.ts"]);
      expect(scored).not.toBeNull();
      if (!scored) return;

      expect(scored.score).toBeGreaterThanOrEqual(50);
      expect(scored.reasons.some((r) => r.includes("Explicitly mentioned"))).toBe(true);
    });

    it("boosts files in primary source directories matching keywords", () => {
      const scored = scoreFileRelevance("src/lib/parser.ts", ["parser", "tokens"], []);
      expect(scored).not.toBeNull();
      if (!scored) return;

      expect(scored.reasons.some((r) => r.includes("primary source directory"))).toBe(true);
      expect(scored.reasons.some((r) => r.includes("matches issue keywords"))).toBe(true);
    });

    it("deprioritizes test files unless issue explicitly mentions testing", () => {
      const scoredGeneral = scoreFileRelevance("src/parser.test.ts", ["parser"], []);
      expect(scoredGeneral?.reasons.some((r) => r.includes("Test file deprioritized"))).toBe(true);

      const scoredTestIssue = scoreFileRelevance("src/parser.test.ts", ["parser", "test"], []);
      expect(scoredTestIssue?.reasons.some((r) => r.includes("Test file matches issue focus"))).toBe(true);
    });

    it("returns null for non-permitted files or zero relevance files", () => {
      expect(scoreFileRelevance("package-lock.json", ["react"], [])).toBeNull();
      expect(scoreFileRelevance("random/unrelated/notes.txt", ["react"], [])).toBeNull();
    });
  });

  describe("buildInvestigationContext with Bounded Limits", () => {
    const mockIssue: GitHubIssueMetadata = {
      owner: "facebook",
      repo: "react",
      issueNumber: 28000,
      title: "Memory leak in useSyncExternalStore client hook",
      state: "open",
      bodyExcerpt: "Observed in client.ts when running strict mode",
      fullBody: "Observed in client.ts when running strict mode. Steps: call useSyncExternalStore",
      htmlUrl: "https://github.com/facebook/react/issues/28000",
      createdAt: "2026-03-01T12:00:00Z",
      updatedAt: "2026-03-02T12:00:00Z",
      commentsCount: 3,
      author: { login: "reporter", avatarUrl: "", htmlUrl: "" },
      labels: [{ id: 1, name: "bug", color: "red" }],
      repository: {
        fullName: "facebook/react",
        description: "React library",
        isPrivate: false,
        starsCount: 200000,
        forksCount: 40000,
        openIssuesCount: 500,
        defaultBranch: "main",
        language: "JavaScript",
        htmlUrl: "https://github.com/facebook/react",
      },
    };

    it("strictly bounds selected files to MAX_SELECTED_FILES (5) and enforces byte limits", async () => {
      // Mock a tree with 10 candidate files
      const treeEntries = [
        { path: "src/client.ts", type: "blob", size: 1024 },
        { path: "src/hook.ts", type: "blob", size: 2048 },
        { path: "src/store.ts", type: "blob", size: 1500 },
        { path: "src/external.ts", type: "blob", size: 1200 },
        { path: "src/sync.ts", type: "blob", size: 800 },
        { path: "src/extra1.ts", type: "blob", size: 900 },
        { path: "src/extra2.ts", type: "blob", size: 900 },
        { path: "node_modules/dep.js", type: "blob", size: 100 }, // should be filtered out
        { path: ".env", type: "blob", size: 50 }, // should be filtered out
      ];

      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: { tree: treeEntries },
            }),
          },
          repos: {
            getContent: vi.fn().mockImplementation(({ path }) => {
              const fileContent = `// Content of ${path}\nexport function run() { return true; }`;
              return Promise.resolve({
                data: {
                  content: Buffer.from(fileContent).toString("base64"),
                  size: Buffer.byteLength(fileContent),
                },
              });
            }),
          },
        },
      } as unknown as Octokit;

      const result = await buildInvestigationContext(mockIssue, {
        octokitClient: mockOctokit,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const report = result.data;
      // Never select more than 5 files
      expect(report.selectedFiles.length).toBeLessThanOrEqual(5);
      expect(report.selectedFiles.length).toBeGreaterThan(0);

      // Verify no forbidden files were selected
      expect(report.selectedFiles.some((f) => f.path.includes("node_modules"))).toBe(false);
      expect(report.selectedFiles.some((f) => f.path.includes(".env"))).toBe(false);

      // Verify explicit reasons are attached
      for (const file of report.selectedFiles) {
        expect(file.selectionReasons.length).toBeGreaterThan(0);
        expect(file.relevanceScore).toBeGreaterThan(0);
      }

      // Verify report structure and hypothesis warning
      expect(report.likelyAffectedAreas.length).toBeGreaterThan(0);
      expect(report.missingContext.length).toBeGreaterThan(0);
      expect(report.proposedNextSteps.length).toBeGreaterThan(0);
      expect(report.disclaimer).toMatch(/Hypothesis only: Unverified by execution/i);
      expect(report.totalContextBytes).toBeLessThanOrEqual(CONTEXT_BOUNDS.MAX_TOTAL_BYTES);
    });

    it("truncates files exceeding MAX_FILE_SIZE_BYTES (30 KB)", async () => {
      const largeContent = "console.log('padding');\n".repeat(1500); // ~36 KB
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockResolvedValue({
              data: {
                tree: [{ path: "src/client.ts", type: "blob", size: 36000 }],
              },
            }),
          },
          repos: {
            getContent: vi.fn().mockResolvedValue({
              data: {
                content: Buffer.from(largeContent).toString("base64"),
                size: 36000,
              },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await buildInvestigationContext(mockIssue, {
        octokitClient: mockOctokit,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const file = result.data.selectedFiles[0];
      expect(file.isTruncated).toBe(true);
      expect(file.sizeBytes).toBeLessThanOrEqual(CONTEXT_BOUNDS.MAX_FILE_SIZE_BYTES);
    });

    it("handles 404 Not Found tree gracefully", async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockRejectedValue({ status: 404, message: "Not Found" }),
          },
        },
      } as unknown as Octokit;

      const result = await buildInvestigationContext(mockIssue, {
        octokitClient: mockOctokit,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("NOT_FOUND");
      expect(result.status).toBe(404);
    });

    it("handles 403 Rate Limit error gracefully", async () => {
      const mockOctokit = {
        rest: {
          git: {
            getTree: vi.fn().mockRejectedValue({ status: 403, message: "Rate limit exceeded" }),
          },
        },
      } as unknown as Octokit;

      const result = await buildInvestigationContext(mockIssue, {
        octokitClient: mockOctokit,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.code).toBe("RATE_LIMITED");
      expect(result.status).toBe(429);
    });
  });
});
