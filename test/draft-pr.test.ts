import { describe, it, expect } from "vitest";
import {
  generateSafeBranchName,
  isSafeBranchName,
  generateDraftPRBody,
} from "@/lib/pr/branch-helper";
import { DraftPRRequestSchema } from "@/lib/pr/types";
import { MockDraftPRCreator } from "@/lib/pr/mock-creator";

describe("Stage 7: Draft PR Architecture & Validation", () => {
  describe("Branch Helper & Naming Rules", () => {
    it("generates safe, formatted branch names", () => {
      const branch = generateSafeBranchName(28000, 1700000000000);
      expect(branch).toBe("patchpilot/fix-issue-28000-1700000000000");
    });

    it("accepts valid custom branch names", () => {
      expect(isSafeBranchName("patchpilot/fix-bug")).toBe(true);
      expect(isSafeBranchName("fix-issue-123")).toBe(true);
      expect(isSafeBranchName("feature/my-patch_v2")).toBe(true);
    });

    it("rejects protected and primary branch names", () => {
      expect(isSafeBranchName("main")).toBe(false);
      expect(isSafeBranchName("MAIN")).toBe(false);
      expect(isSafeBranchName("master")).toBe(false);
      expect(isSafeBranchName("prod")).toBe(false);
      expect(isSafeBranchName("production")).toBe(false);
      expect(isSafeBranchName("release")).toBe(false);
    });

    it("rejects branch names with path traversal or invalid characters", () => {
      expect(isSafeBranchName("../bad-branch")).toBe(false);
      expect(isSafeBranchName("patchpilot/../main")).toBe(false);
      expect(isSafeBranchName("/leading-slash")).toBe(false);
      expect(isSafeBranchName("trailing-slash/")).toBe(false);
      expect(isSafeBranchName("branch with spaces")).toBe(false);
      expect(isSafeBranchName("branch;rm")).toBe(false);
    });
  });

  describe("Draft PR Body Generator", () => {
    it("generates markdown body with issue link and verified status", () => {
      const body = generateDraftPRBody({
        owner: "facebook",
        repo: "react",
        issueNumber: 28000,
        issueTitle: "Memory leak in useSyncExternalStore",
        targetPath: "packages/react/src/ReactSharedInternals.js",
        verificationStatus: "passed",
      });

      expect(body).toContain("Resolves #28000: **Memory leak in useSyncExternalStore**");
      expect(body).toContain("PASSED (Isolated regression tests passed in PatchPilot sandbox)");
      expect(body).toContain("- **Target File:** `packages/react/src/ReactSharedInternals.js`");
      expect(body).toContain("Draft PR");
      expect(body).toContain("prohibiting automated merging");
    });

    it("includes unverified notice when verification was not run", () => {
      const body = generateDraftPRBody({
        owner: "facebook",
        repo: "react",
        issueNumber: 100,
        issueTitle: "Minor typo",
        targetPath: "README.md",
        verificationStatus: "unverified",
      });

      expect(body).toContain("Unverified (Not executed in sandbox)");
    });
  });

  describe("DraftPRRequestSchema & Human Confirmation Gate", () => {
    const validPayload = {
      owner: "facebook",
      repo: "react",
      issueNumber: 28000,
      issueTitle: "Fix memory leak",
      targetPath: "packages/react/src/index.js",
      unifiedDiff: "--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n+// fix",
      verificationStatus: "passed" as const,
      userConfirmed: true as const,
    };

    it("accepts requests where userConfirmed is true", () => {
      const res = DraftPRRequestSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
    });

    it("STRICTLY REJECTS requests where userConfirmed is false", () => {
      const res = DraftPRRequestSchema.safeParse({
        ...validPayload,
        userConfirmed: false,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("Explicit human approval is strictly required");
      }
    });

    it("rejects payloads targeting protected branches", () => {
      const res = DraftPRRequestSchema.safeParse({
        ...validPayload,
        branchName: "main",
      });

      expect(res.success).toBe(false);
    });
  });

  describe("MockDraftPRCreator", () => {
    it("creates a mock draft PR with truthful draft and humanConfirmed flags", async () => {
      const creator = new MockDraftPRCreator();
      const result = await creator.createDraftPR({
        owner: "facebook",
        repo: "react",
        issueNumber: 28000,
        issueTitle: "Fix memory leak",
        targetPath: "packages/react/src/index.js",
        unifiedDiff: "--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n+// fix",
        verificationStatus: "passed",
        userConfirmed: true,
      });

      expect(result.isDraft).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.humanConfirmed).toBe(true);
      expect(result.prNumber).toBe(28100);
      expect(result.prUrl).toContain("https://github.com/facebook/react/pull/28100");
      expect(result.targetRepo).toBe("facebook/react");
      expect(result.baseBranch).toBe("main");
      expect(result.branchName).toMatch(/^patchpilot\/fix-issue-28000-/);
    });
  });
});
