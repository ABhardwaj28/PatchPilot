import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "@/app/page";
import { GET } from "@/app/api/health/route";
import { POST } from "@/app/api/validate-issue/route";
import { NextRequest } from "next/server";

describe("PatchPilot Stage 2 Smoke and Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Landing Page & UI Shell", () => {
    it("renders the landing page with title and Stage 2 badge", () => {
      render(<Home />);

      expect(screen.getAllByText("PatchPilot").length).toBeGreaterThan(0);
      expect(screen.getByText("Stage 2: Issue Intake Shell")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: /investigate issues, propose fixes/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /github issue url/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /validate issue url/i })).toBeInTheDocument();
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
      const submitButton = screen.getByRole("button", { name: /validate issue url/i });

      fireEvent.change(input, { target: { value: "https://gitlab.com/owner/repo/issues/1" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/only public repositories on github\.com/i)).toBeInTheDocument();
      });
    });

    it("shows success validation card when server returns valid parsing", async () => {
      // Mock fetch response from /api/validate-issue
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: true,
          data: {
            owner: "facebook",
            repo: "react",
            issueNumber: 28000,
            normalizedUrl: "https://github.com/facebook/react/issues/28000",
          },
        }),
      } as unknown as Response);

      render(<Home />);
      const input = screen.getByRole("textbox", { name: /github issue url/i });
      const submitButton = screen.getByRole("button", { name: /validate issue url/i });

      fireEvent.change(input, { target: { value: "https://github.com/facebook/react/issues/28000" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("URL Validated Successfully")).toBeInTheDocument();
        expect(screen.getByText("Validation Only")).toBeInTheDocument();
        expect(screen.getByText("facebook")).toBeInTheDocument();
        expect(screen.getByText("react")).toBeInTheDocument();
        expect(screen.getByText("#28000")).toBeInTheDocument();
      });
    });
  });

  describe("API Route Handlers", () => {
    it("returns healthy response from /api/health", async () => {
      const response = await GET();
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

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.data.owner).toBe("vercel");
      expect(data.data.repo).toBe("next.js");
      expect(data.data.issueNumber).toBe(50000);
      expect(data.statusLabel).toMatch(/validation only/i);
    });

    it("returns 422 for pull request URL via POST /api/validate-issue", async () => {
      const request = new NextRequest("http://localhost:3000/api/validate-issue", {
        method: "POST",
        body: JSON.stringify({ url: "https://github.com/vercel/next.js/pull/123" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).toMatch(/pull request URL, not an Issue/i);
    });

    it("returns 400 for missing or non-string url property", async () => {
      const request = new NextRequest("http://localhost:3000/api/validate-issue", {
        method: "POST",
        body: JSON.stringify({ invalidKey: 123 }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
