import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as validateIssuePOST } from "@/app/api/validate-issue/route";
import { POST as issueMetadataPOST } from "@/app/api/issue-metadata/route";
import { POST as investigateIssuePOST } from "@/app/api/investigate-issue/route";
import { NextRequest } from "next/server";
import * as githubClient from "@/lib/github/client";
import * as contextCollector from "@/lib/github/context-collector";

describe("PatchPilot Stage 4 Smoke and Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Landing Page & UI Shell", () => {
    it("renders the landing page with title and Stage 4 badge", () => {
      render(<Home />);

      expect(screen.getAllByText("PatchPilot").length).toBeGreaterThan(0);
      expect(screen.getByText("Stage 4: Bounded Context Active")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: /investigate issues, propose fixes/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /github issue url/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /fetch issue metadata/i })).toBeInTheDocument();
    });

    it("populates the input when clicking the example button", () => {
      render(<Home />);
      const exampleButton = screen.getByRole("button", { name: /facebook\/react#28000/i });
      fireEvent.click(exampleButton);

      const input = screen.getByRole("textbox", { name: /github issue url/i }) as HTMLInputElement;
      expect(input.value).toBe("https://github.com/facebook/react/issues/28000");
    });

    it("shows client-side validation error when submitting an invalid URL", async () => {
      render(<Home />);
      const input = screen.getByRole("textbox", { name: /github issue url/i });
      const submitButton = screen.getByRole("button", { name: /fetch issue metadata/i });

      fireEvent.change(input, { target: { value: "https://gitlab.com/owner/repo/issues/1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/only public repositories on github\.com/i)).toBeInTheDocument();
      });
    });

    it("renders full issue metadata card and allows generating investigation plan", async () => {
      // Mock fetch responses for /api/issue-metadata and /api/investigate-issue
      const mockIssueData = {
        owner: "facebook",
        repo: "react",
        issueNumber: 28000,
        title: "useSyncExternalStore memory leak in strict mode",
        state: "open",
        bodyExcerpt: "Observed memory leak when mounting and unmounting repeatedly.",
        fullBody: "Observed memory leak when mounting and unmounting repeatedly.",
        htmlUrl: "https://github.com/facebook/react/issues/28000",
        createdAt: "2026-03-01T12:00:00Z",
        updatedAt: "2026-03-02T15:30:00Z",
        commentsCount: 7,
        author: {
          login: "react-dev",
          avatarUrl: "",
          htmlUrl: "https://github.com/react-dev",
        },
        labels: [
          { id: 1, name: "Type: Bug", color: "b60205", description: null },
          { id: 2, name: "Component: Hooks", color: "1d76db", description: null },
        ],
        repository: {
          fullName: "facebook/react",
          description: "The library for web and native user interfaces",
          isPrivate: false,
          starsCount: 220000,
          forksCount: 45000,
          openIssuesCount: 800,
          defaultBranch: "main",
          language: "JavaScript",
          htmlUrl: "https://github.com/facebook/react",
        },
      };

      const mockInvestigationData = {
        issueSummary: {
          owner: "facebook",
          repo: "react",
          issueNumber: 28000,
          title: "useSyncExternalStore memory leak in strict mode",
          extractedKeywords: ["sync", "store", "memory", "leak"],
          mentionedFiles: ["src/client.ts"],
        },
        likelyAffectedAreas: ["src/hooks", "src/client"],
        selectedFiles: [
          {
            path: "src/hooks/useSyncExternalStore.ts",
            sizeBytes: 2400,
            content: "export function useSyncExternalStore() { return null; }",
            relevanceScore: 65,
            selectionReasons: ["Explicitly mentioned in issue text", "Located in primary source directory"],
            isTruncated: false,
          },
        ],
        skippedFilesCount: 200,
        totalScannedFiles: 201,
        totalContextBytes: 2400,
        limits: {
          maxFiles: 5,
          maxFileSizeBytes: 30720,
          maxTotalBytes: 102400,
        },
        missingContext: [
          "Dependency directories and lockfiles excluded by security policy.",
          "Untrusted repository code was not cloned, compiled, or executed.",
        ],
        proposedNextSteps: [
          "Review candidate lines in primary module: src/hooks/useSyncExternalStore.ts",
          "Formulate minimal regression test",
        ],
        disclaimer:
          "Hypothesis only: Unverified by execution. PatchPilot collects bounded read-only repository context and does not execute untrusted code.",
      };

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url === "/api/issue-metadata") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockIssueData,
              rateLimit: { limit: 60, remaining: 48, resetAt: "2026-03-01T13:00:00Z", isLow: false },
            }),
          });
        }
        if (url === "/api/investigate-issue") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockInvestigationData,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<Home />);
      const input = screen.getByRole("textbox", { name: /github issue url/i });
      const submitButton = screen.getByRole("button", { name: /fetch issue metadata/i });

      fireEvent.change(input, {
        target: { value: "https://github.com/facebook/react/issues/28000" },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("useSyncExternalStore memory leak in strict mode")
        ).toBeInTheDocument();
        expect(screen.getByText("OPEN")).toBeInTheDocument();
        expect(screen.getByText("#28000")).toBeInTheDocument();
      });

      // Now click "Generate Investigation Plan"
      const investigateButton = screen.getByRole("button", { name: /generate investigation plan/i });
      expect(investigateButton).toBeInTheDocument();
      fireEvent.click(investigateButton);

      await waitFor(() => {
        expect(
          screen.getAllByText(/Hypothesis Only: Unverified by Execution/i).length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("src/hooks/useSyncExternalStore.ts")).toBeInTheDocument();
        expect(screen.getByText("Score: 65")).toBeInTheDocument();
        expect(screen.getByText("• Explicitly mentioned in issue text")).toBeInTheDocument();
      });
    });

    it("displays error card when server returns issue error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Repository or issue 'facebook/react#999999' not found.",
          code: "NOT_FOUND",
          rateLimit: {
            limit: 60,
            remaining: 45,
            resetAt: "2026-03-01T13:00:00Z",
            isLow: false,
          },
        }),
      } as unknown as Response);

      render(<Home />);
      const input = screen.getByRole("textbox", { name: /github issue url/i });
      const submitButton = screen.getByRole("button", { name: /fetch issue metadata/i });

      fireEvent.change(input, {
        target: { value: "https://github.com/facebook/react/issues/999999" },
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(
          screen.getByText(/repository or issue 'facebook\/react#999999' not found/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("API Route Handlers", () => {
    it("returns healthy response from /api/health", async () => {
      const response = await healthGET();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data.app).toBe("PatchPilot");
    });

    it("validates issue URL via POST /api/validate-issue", async () => {
      const request = new NextRequest("http://localhost:3000/api/validate-issue", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/vercel/next.js/issues/50000" }),
      });

      const response = await validateIssuePOST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.data.owner).toBe("vercel");
      expect(data.data.repo).toBe("next.js");
      expect(data.data.issueNumber).toBe(50000);
    });

    it("fetches metadata successfully via POST /api/issue-metadata", async () => {
      vi.spyOn(githubClient, "fetchGitHubIssueMetadata").mockResolvedValue({
        success: true,
        data: {
          owner: "vercel",
          repo: "next.js",
          issueNumber: 50000,
          title: "Turbopack dev server error",
          state: "open",
          bodyExcerpt: "Error reproduction steps here.",
          fullBody: "Error reproduction steps here.",
          htmlUrl: "https://github.com/vercel/next.js/issues/50000",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          commentsCount: 3,
          author: { login: "next-user", avatarUrl: "", htmlUrl: "" },
          labels: [],
          repository: {
            fullName: "vercel/next.js",
            description: "The React Framework",
            isPrivate: false,
            starsCount: 125000,
            forksCount: 26000,
            openIssuesCount: 2500,
            defaultBranch: "canary",
            language: "TypeScript",
            htmlUrl: "https://github.com/vercel/next.js",
          },
        },
        rateLimit: {
          limit: 60,
          remaining: 58,
          resetAt: "2026-01-01T01:00:00Z",
          isLow: false,
        },
      });

      const request = new NextRequest("http://localhost:3000/api/issue-metadata", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/vercel/next.js/issues/50000" }),
      });

      const response = await issueMetadataPOST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Turbopack dev server error");
      expect(data.data.owner).toBe("vercel");
      expect(data.data.repo).toBe("next.js");
      expect(data.data.issueNumber).toBe(50000);
      expect(data.rateLimit.remaining).toBe(58);
    });

    it("generates investigation plan via POST /api/investigate-issue", async () => {
      const mockIssue = {
        owner: "facebook",
        repo: "react",
        issueNumber: 28000,
        title: "useSyncExternalStore bug",
        state: "open" as const,
        bodyExcerpt: "bug details",
        fullBody: "bug details",
        htmlUrl: "https://github.com/facebook/react/issues/28000",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        commentsCount: 1,
        author: { login: "author", avatarUrl: "", htmlUrl: "" },
        labels: [],
        repository: {
          fullName: "facebook/react",
          description: null,
          isPrivate: false,
          starsCount: 100,
          forksCount: 10,
          openIssuesCount: 5,
          defaultBranch: "main",
          language: "JavaScript",
          htmlUrl: "https://github.com/facebook/react",
        },
      };

      vi.spyOn(githubClient, "fetchGitHubIssueMetadata").mockResolvedValue({
        success: true,
        data: mockIssue,
      });

      vi.spyOn(contextCollector, "buildInvestigationContext").mockResolvedValue({
        success: true,
        data: {
          issueSummary: {
            owner: "facebook",
            repo: "react",
            issueNumber: 28000,
            title: "useSyncExternalStore bug",
            extractedKeywords: ["sync", "bug"],
            mentionedFiles: [],
          },
          likelyAffectedAreas: ["src/hooks"],
          selectedFiles: [
            {
              path: "src/hooks/useSyncExternalStore.js",
              sizeBytes: 1200,
              content: "export function test() {}",
              relevanceScore: 40,
              selectionReasons: ["Primary source module"],
              isTruncated: false,
            },
          ],
          skippedFilesCount: 50,
          totalScannedFiles: 51,
          totalContextBytes: 1200,
          limits: { maxFiles: 5, maxFileSizeBytes: 30720, maxTotalBytes: 102400 },
          missingContext: ["Lockfiles excluded"],
          proposedNextSteps: ["Review identified lines"],
          disclaimer: "Hypothesis only: Unverified by execution.",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/investigate-issue", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/facebook/react/issues/28000" }),
      });

      const response = await investigateIssuePOST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.selectedFiles).toHaveLength(1);
      expect(data.data.selectedFiles[0].path).toBe("src/hooks/useSyncExternalStore.js");
      expect(data.data.disclaimer).toMatch(/Hypothesis only/i);
    });

    it("returns 422 for pull request URL via POST /api/investigate-issue", async () => {
      const request = new NextRequest("http://localhost:3000/api/investigate-issue", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/vercel/next.js/pull/123" }),
      });

      const response = await investigateIssuePOST(request);
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/pull request URL, not an Issue/i);
    });

    it("returns 400 for missing url property in POST /api/investigate-issue", async () => {
      const request = new NextRequest("http://localhost:3000/api/investigate-issue", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await investigateIssuePOST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});
