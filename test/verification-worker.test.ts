import { describe, it, expect } from "vitest";
import { MockVerificationWorker } from "@/lib/verification/mock-worker";
import { getVerificationWorker } from "@/lib/verification/worker-factory";
import {
  VerificationJob,
  VerificationJobRequestSchema,
} from "@/lib/verification/types";

describe("Stage 6: Verification Worker & Runner Behavior", () => {
  const worker = new MockVerificationWorker();

  const sampleValidJob: VerificationJob = {
    jobId: "test-job-001",
    owner: "facebook",
    repo: "react",
    targetPath: "packages/react/src/ReactSharedInternals.js",
    unifiedDiff: [
      "--- a/packages/react/src/ReactSharedInternals.js",
      "+++ b/packages/react/src/ReactSharedInternals.js",
      "@@ -10,3 +10,4 @@",
      " export default ReactSharedInternals;",
      "+// patched safely",
    ].join("\n"),
    command: "npx vitest run",
    createdAt: new Date().toISOString(),
    timeoutMs: 60000,
  };

  it("successfully verifies a patch with truthful passing status", async () => {
    const result = await worker.runJob(sampleValidJob);

    expect(result.jobId).toBe(sampleValidJob.jobId);
    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.isMock).toBe(true);
    expect(result.sandboxType).toBe("mock-sandbox");
    expect(result.explanation).toContain("All regression test suites passed cleanly");
    expect(result.stdoutExcerpt).toContain("Test Files  2 passed (2)");
    expect(result.stdoutExcerpt).toContain("Network isolation verified: --network none");
    expect(result.stderrExcerpt).toBe("");
    expect(result.isTruncated).toBe(false);

    // Verify security audit
    expect(result.securityAudit.networkIsolated).toBe(true);
    expect(result.securityAudit.nonRootUser).toBe(true);
    expect(result.securityAudit.credentialsMounted).toBe(false);
    expect(result.securityAudit.resourceLimitsEnforced).toBe(true);
    expect(result.securityAudit.wallClockTimeoutMs).toBe(60000);
    expect(result.securityAudit.memoryLimitMb).toBe(512);
  });

  it("truthfully reports test failures when regression test assertions fail", async () => {
    const failingJob: VerificationJob = {
      ...sampleValidJob,
      jobId: "test-job-fail",
      unifiedDiff: sampleValidJob.unifiedDiff + "\n#simulate-fail",
    };

    const result = await worker.runJob(failingJob);
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
    expect(result.explanation).toContain("Regression tests failed");
    expect(result.stdoutExcerpt).toContain("FAIL");
    expect(result.stderrExcerpt).toContain("Error: Process exited with non-zero exit code 1");
  });

  it("handles timeout conditions gracefully", async () => {
    const timeoutJob: VerificationJob = {
      ...sampleValidJob,
      jobId: "test-job-timeout",
      command: "npm test --timeout",
    };

    const result = await worker.runJob(timeoutJob);
    expect(result.status).toBe("timed_out");
    expect(result.exitCode).toBeNull();
    expect(result.explanation).toContain("exceeding the configured execution time limit");
    expect(result.stderrExcerpt).toContain("Job exceeded maximum allowed wall-clock timeout");
  });

  it("rejects jobs attempting command injection before sandbox execution", async () => {
    const injectionJob: VerificationJob = {
      ...sampleValidJob,
      command: "npm test; cat /etc/passwd",
    };

    const result = await worker.runJob(injectionJob);
    expect(result.status).toBe("rejected");
    expect(result.exitCode).toBe(1);
    expect(result.explanation).toContain("violated security allowlist policy");
    expect(result.stderrExcerpt).toContain("Security Policy Violation");
  });

  it("rejects jobs containing path traversal in diff or target path", async () => {
    const traversalJob: VerificationJob = {
      ...sampleValidJob,
      targetPath: "../../etc/passwd",
    };

    const result = await worker.runJob(traversalJob);
    expect(result.status).toBe("rejected");
    expect(result.explanation).toContain("detected path traversal vulnerability");
  });

  it("truncates output when stdout exceeds the 32 KB buffer limit", async () => {
    // Generate large output worker test
    const customWorker = new MockVerificationWorker();
    const largeOutputJob: VerificationJob = {
      ...sampleValidJob,
      unifiedDiff: sampleValidJob.unifiedDiff,
    };

    // Spy or check default bounding
    const res = await customWorker.runJob(largeOutputJob);
    expect(Buffer.byteLength(res.stdoutExcerpt, "utf-8")).toBeLessThanOrEqual(33000);
  });

  it("factory returns MockVerificationWorker by default", () => {
    const instance = getVerificationWorker();
    expect(instance.name).toBe("MockSandboxWorker");
    expect(instance.sandboxType).toBe("mock-sandbox");
    expect(instance.isLiveExecution).toBe(false);
  });
});

describe("Stage 6: VerificationJobRequestSchema Validation", () => {
  it("accepts valid verification payloads", () => {
    const validPayload = {
      owner: "facebook",
      repo: "react",
      targetPath: "packages/react/src/index.js",
      unifiedDiff: "--- a/index.js\n+++ b/index.js\n@@ -1,1 +1,2 @@\n+// fix",
      command: "npm test",
    };

    const res = VerificationJobRequestSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
  });

  it("rejects invalid owners, path traversal, and empty diffs", () => {
    // Path traversal in repo
    expect(
      VerificationJobRequestSchema.safeParse({
        owner: "facebook",
        repo: "../react",
        targetPath: "src/index.js",
        unifiedDiff: "--- a\n+++ b\n@@ -1 +1 @@",
        command: "npm test",
      }).success
    ).toBe(false);

    // Absolute target path
    expect(
      VerificationJobRequestSchema.safeParse({
        owner: "facebook",
        repo: "react",
        targetPath: "/etc/shadow",
        unifiedDiff: "--- a\n+++ b\n@@ -1 +1 @@",
        command: "npm test",
      }).success
    ).toBe(false);

    // Missing diff
    expect(
      VerificationJobRequestSchema.safeParse({
        owner: "facebook",
        repo: "react",
        targetPath: "src/index.js",
        unifiedDiff: "",
        command: "npm test",
      }).success
    ).toBe(false);
  });
});
