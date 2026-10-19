import { describe, it, expect } from "vitest";
import { parseGitHubIssueUrl } from "@/lib/validation/github-issue-url";

describe("parseGitHubIssueUrl", () => {
  describe("Valid issue URLs", () => {
    it("parses a standard valid public issue URL", () => {
      const result = parseGitHubIssueUrl("https://github.com/facebook/react/issues/28000");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe("facebook");
        expect(result.data.repo).toBe("react");
        expect(result.data.issueNumber).toBe(28000);
        expect(result.data.normalizedUrl).toBe("https://github.com/facebook/react/issues/28000");
      }
    });

    it("normalizes a URL with trailing slash", () => {
      const result = parseGitHubIssueUrl("https://github.com/vercel/next.js/issues/12345/");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe("vercel");
        expect(result.data.repo).toBe("next.js");
        expect(result.data.issueNumber).toBe(12345);
        expect(result.data.normalizedUrl).toBe("https://github.com/vercel/next.js/issues/12345");
      }
    });

    it("normalizes www.github.com to github.com", () => {
      const result = parseGitHubIssueUrl("https://www.github.com/torvalds/linux/issues/1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe("torvalds");
        expect(result.data.repo).toBe("linux");
        expect(result.data.issueNumber).toBe(1);
        expect(result.data.normalizedUrl).toBe("https://github.com/torvalds/linux/issues/1");
      }
    });

    it("strips query parameters and hashes during normalization", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/issues/42?foo=bar#issuecomment-999");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issueNumber).toBe(42);
        expect(result.data.normalizedUrl).toBe("https://github.com/owner/repo/issues/42");
      }
    });
  });

  describe("Invalid domains and protocols", () => {
    it("rejects non-HTTPS URLs (e.g. http://)", () => {
      const result = parseGitHubIssueUrl("http://github.com/facebook/react/issues/28000");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/only secure "https:\/\/"/i);
      }
    });

    it("rejects non-GitHub domains (e.g. gitlab.com)", () => {
      const result = parseGitHubIssueUrl("https://gitlab.com/owner/repo/issues/123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/only public repositories on github\.com/i);
      }
    });

    it("rejects spoofed or phishing subdomains", () => {
      const result = parseGitHubIssueUrl("https://github.com.attacker.com/owner/repo/issues/123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid domain/i);
      }
    });

    it("rejects localhost or SSRF target formats", () => {
      const result = parseGitHubIssueUrl("https://127.0.0.1/owner/repo/issues/123");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/invalid domain/i);
      }
    });
  });

  describe("Pull requests and unexpected resources", () => {
    it("specifically rejects pull request URLs with a helpful message", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/pull/12");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/pull request URL, not an issue/i);
      }
    });

    it("rejects discussions or release URLs", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/discussions/45");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/expected "\/issues\/" in url path/i);
      }
    });
  });

  describe("Malformed paths, issue numbers, and owners", () => {
    it("rejects missing issue number", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/issues");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/missing issue number/i);
      }
    });

    it("rejects non-numeric issue numbers", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/issues/not-a-number");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/must be a positive integer/i);
      }
    });

    it("rejects negative or zero issue numbers", () => {
      const zeroResult = parseGitHubIssueUrl("https://github.com/owner/repo/issues/0");
      expect(zeroResult.success).toBe(false);

      const negResult = parseGitHubIssueUrl("https://github.com/owner/repo/issues/-5");
      expect(negResult.success).toBe(false);
    });

    it("rejects URLs with unexpected extra path segments", () => {
      const result = parseGitHubIssueUrl("https://github.com/owner/repo/issues/123/comments");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/unexpected extra path segments/i);
      }
    });

    it("rejects path traversal attempts in owner or repo", () => {
      const result = parseGitHubIssueUrl("https://github.com/../etc/issues/123");
      expect(result.success).toBe(false);
    });

    it("rejects empty input or whitespace", () => {
      const emptyResult = parseGitHubIssueUrl("");
      expect(emptyResult.success).toBe(false);

      const whitespaceResult = parseGitHubIssueUrl("   ");
      expect(whitespaceResult.success).toBe(false);
    });

    it("rejects embedded credentials in URL", () => {
      const result = parseGitHubIssueUrl("https://admin:secret@github.com/owner/repo/issues/1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/embedded credentials/i);
      }
    });
  });
});
