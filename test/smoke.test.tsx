import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";
import { GET } from "@/app/api/health/route";

describe("PatchPilot Stage 1 Smoke Tests", () => {
  it("renders the landing page with title and early prototype badge", () => {
    render(<Home />);

    // Brand and Headings
    expect(screen.getAllByText("PatchPilot").length).toBeGreaterThan(0);
    expect(screen.getByText("Early Prototype (Stage 1)")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /investigate issues, propose fixes/i })
    ).toBeInTheDocument();

    // Primary entry point placeholder (Stage 2 preview)
    expect(screen.getByText("Analyze a GitHub Issue")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("https://github.com/owner/repository/issues/123");
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();

    // How it works section
    expect(screen.getByText("How PatchPilot Works")).toBeInTheDocument();
    expect(screen.getByText("1. Intake & Validation")).toBeInTheDocument();
    expect(screen.getByText("2. Bounded Context")).toBeInTheDocument();
    expect(screen.getByText("3. AI Patch Proposal")).toBeInTheDocument();
    expect(screen.getByText("4. Isolated Verification")).toBeInTheDocument();
  });

  it("returns healthy response from /api/health", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.app).toBe("PatchPilot");
    expect(data.stage).toBe("Stage 1 (App Foundation)");
  });
});
