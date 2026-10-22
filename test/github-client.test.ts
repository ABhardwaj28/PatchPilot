import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGitHubIssueMetadata, createOctokitClient } from "@/lib/github/client";
import { Octokit } from "octokit";

describe("GitHub Client Service (fetchGitHubIssueMetadata)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully retrieves and parses public issue and repository metadata", async () => {
    const mockIssueResponse = {
      headers: {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "55",
        "x-ratelimit-reset": "1800000000",
      },
      data: {
        title: "Bug: Component does not re-render on state change",
        state: "open",
        body: "Steps to reproduce:\n1. Click button\n2. Observe nothing happens",
        html_url: "https://github.com/facebook/react/issues/28000",
        created_at: "2026-03-01T12:00:00Z",
        updated_at: "2026-03-02T15:30:00Z",
        comments: 4,
        user: {
          login: "test-reporter",
          avatar_url: "https://avatars.githubusercontent.com/u/123",
          html_url: "https://github.com/test-reporter",
        },
        labels: [
          { id: 1, name: "bug", color: "d73a4a", description: "Something isn't working" },
          "react-core",
        ],
      },
    };

    const mockRepoResponse = {
      data: {
        full_name: "facebook/react",
        description: "The library for web and native user interfaces",
        private: false,
        stargazers_count: 220000,
        forks_count: 45000,
        open_issues_count: 800,
        default_branch: "main",
        language: "JavaScript",
        html_url: "https://github.com/facebook/react",
      },
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockResolvedValue(mockIssueResponse),
        },
        repos: {
          get: vi.fn().mockResolvedValue(mockRepoResponse),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 28000, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.owner).toBe("facebook");
    expect(result.data.repo).toBe("react");
    expect(result.data.issueNumber).toBe(28000);
    expect(result.data.title).toBe("Bug: Component does not re-render on state change");
    expect(result.data.state).toBe("open");
    expect(result.data.author.login).toBe("test-reporter");
    expect(result.data.commentsCount).toBe(4);
    expect(result.data.labels).toHaveLength(2);
    expect(result.data.labels[0].name).toBe("bug");
    expect(result.data.labels[1].name).toBe("react-core");
    expect(result.data.repository.fullName).toBe("facebook/react");
    expect(result.data.repository.starsCount).toBe(220000);
    expect(result.data.repository.language).toBe("JavaScript");
    expect(result.rateLimit?.remaining).toBe(55);
    expect(result.rateLimit?.isLow).toBe(false);
  });

  it("rejects pull request payload masquerading under issues API", async () => {
    const mockIssueResponse = {
      headers: {},
      data: {
        title: "Fix a bug in hooks",
        state: "open",
        pull_request: {
          url: "https://api.github.com/repos/facebook/react/pulls/28000",
        },
        user: { login: "contributor" },
        labels: [],
      },
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockResolvedValue(mockIssueResponse),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 28000, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe("PULL_REQUEST_NOT_SUPPORTED");
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/pull request/i);
  });

  it("handles 404 Not Found error gracefully", async () => {
    const error404 = {
      status: 404,
      message: "Not Found",
      response: {
        headers: {
          "x-ratelimit-remaining": "50",
          "x-ratelimit-limit": "60",
        },
      },
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockRejectedValue(error404),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("unknown-owner", "nonexistent-repo", 999, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe("NOT_FOUND");
    expect(result.status).toBe(404);
    expect(result.error).toMatch(/not found/i);
    expect(result.rateLimit?.remaining).toBe(50);
  });

  it("handles 403 / 429 rate limit exceeded error", async () => {
    const rateLimitError = {
      status: 403,
      message: "API rate limit exceeded for IP",
      response: {
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1800000000",
        },
      },
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockRejectedValue(rateLimitError),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 28000, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe("RATE_LIMITED");
    expect(result.status).toBe(429);
    expect(result.rateLimit?.remaining).toBe(0);
    expect(result.rateLimit?.isLow).toBe(true);
    expect(result.error).toMatch(/rate limit exceeded/i);
  });

  it("handles 401 Unauthorized invalid token error", async () => {
    const unauthorizedError = {
      status: 401,
      message: "Bad credentials",
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockRejectedValue(unauthorizedError),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 28000, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/authentication failed/i);
  });

  it("handles request timeout properly", async () => {
    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockImplementation((options) => {
            return new Promise((_, reject) => {
              options.request.signal.addEventListener("abort", () => {
                const abortError = new Error("This operation was aborted");
                abortError.name = "AbortError";
                reject(abortError);
              });
            });
          }),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 28000, {
      octokitClient: mockOctokit,
      timeoutMs: 10,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe("TIMEOUT");
    expect(result.status).toBe(504);
  });

  it("rejects malicious or invalid parameters without calling network", async () => {
    const resultInvalidOwner = await fetchGitHubIssueMetadata("../escape", "react", 1);
    expect(resultInvalidOwner.success).toBe(false);
    if (!resultInvalidOwner.success) {
      expect(resultInvalidOwner.status).toBe(400);
    }

    const resultInvalidNumber = await fetchGitHubIssueMetadata("facebook", "react", -5);
    expect(resultInvalidNumber.success).toBe(false);
    if (!resultInvalidNumber.success) {
      expect(resultInvalidNumber.status).toBe(400);
    }
  });

  it("bounds long issue descriptions to max length safely", async () => {
    const veryLongBody = "A".repeat(15000);
    const mockIssueResponse = {
      headers: {},
      data: {
        title: "Issue with very large body",
        state: "open",
        body: veryLongBody,
        html_url: "https://github.com/facebook/react/issues/1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        comments: 0,
        user: { login: "user" },
        labels: [],
      },
    };

    const mockRepoResponse = {
      data: {
        full_name: "facebook/react",
        description: null,
        private: false,
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 1,
        default_branch: "main",
        language: null,
        html_url: "https://github.com/facebook/react",
      },
    };

    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockResolvedValue(mockIssueResponse),
        },
        repos: {
          get: vi.fn().mockResolvedValue(mockRepoResponse),
        },
      },
    } as unknown as Octokit;

    const result = await fetchGitHubIssueMetadata("facebook", "react", 1, {
      octokitClient: mockOctokit,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.fullBody.length).toBe(10000);
    expect(result.data.bodyExcerpt.length).toBeLessThanOrEqual(1003); // 1000 + "..."
  });

  it("createOctokitClient ignores placeholder token values safely", () => {
    const clientDefault = createOctokitClient("your_github_personal_access_token_placeholder");
    expect(clientDefault).toBeDefined();

    const clientWithToken = createOctokitClient("ghp_fake_valid_format_token");
    expect(clientWithToken).toBeDefined();
  });
});
