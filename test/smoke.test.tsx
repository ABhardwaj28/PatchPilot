import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as validateIssuePOST } from "@/app/api/validate-issue/route";
import { POST as issueMetadataPOST } from "@/app/api/issue-metadata/route";
import { NextRequest } from "next/server";
import * as githubClient from "@/lib/github/client";

describe("PatchPilot Stage 3 Smoke and Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Landing Page & UI Shell", () => {
    it("renders the landing page with title and Stage 3 badge", () => {
      render(<Home />);

      expect(screen.getAllByText("PatchPilot").length).toBeGreaterThan(0);
      expect(screen.getByText("Stage 3: Issue Intake & Metadata Active")).toBeInTheDocument();
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

    it("renders full issue metadata card when server returns successful intake", async () => {
      // Mock fetch response from /api/issue-metadata
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
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
          },
          rateLimit: {
            limit: 60,
            remaining: 48,
            resetAt: "2026-03-01T13:00:00Z",
            isLow: false,
          },
        }),
      } as unknown as Response);

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
        expect(screen.getByText("@react-dev")).toBeInTheDocument();
        expect(screen.getByText("Type: Bug")).toBeInTheDocument();
        expect(screen.getByText("Component: Hooks")).toBeInTheDocument();
        expect(screen.getByText("220,000")).toBeInTheDocument();
        expect(screen.getByText("Data & Privacy Notice:")).toBeInTheDocument();
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

    it("returns 422 for pull request URL via POST /api/issue-metadata", async () => {
      const request = new NextRequest("http://localhost:3000/api/issue-metadata", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/vercel/next.js/pull/123" }),
      });

      const response = await issueMetadataPOST(request);
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/pull request URL, not an Issue/i);
    });

    it("returns 400 for missing or non-string url property in /api/issue-metadata", async () => {
      const request = new NextRequest("http://localhost:3000/api/issue-metadata", {
        method: "POST",
        body: JSON.stringify({ invalidKey: 123 }),
      });

      const response = await issueMetadataPOST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});
