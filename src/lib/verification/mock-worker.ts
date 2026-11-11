import {
  VerificationJob,
  VerificationResult,
  VerificationWorker,
  SandboxType,
  SandboxSecurityAudit,
} from "./types";
import { validateVerificationCommand } from "./command-allowlist";

const MAX_OUTPUT_BYTES = 32 * 1024; // 32 KB limit

/**
 * Deterministic Mock Verification Worker for local development, automated testing,
 * and safe-by-default execution fallback when containerized microVM isolation is unavailable.
 */
export class MockVerificationWorker implements VerificationWorker {
  public readonly name = "MockSandboxWorker";
  public readonly sandboxType: SandboxType = "mock-sandbox";
  public readonly isLiveExecution = false;

  public async runJob(job: VerificationJob): Promise<VerificationResult> {
    const startTime = Date.now();

    // 1. Validate command against allowlist
    const commandCheck = validateVerificationCommand(job.command);
    if (!commandCheck.isValid) {
      return {
        jobId: job.jobId,
        status: "rejected",
        command: job.command,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        stdoutExcerpt: "",
        stderrExcerpt: `Security Policy Violation: ${commandCheck.reason || "Disallowed command."}`,
        isTruncated: false,
        sandboxType: this.sandboxType,
        isMock: true,
        securityAudit: this.getSecurityAudit(),
        explanation: "Job was rejected before sandbox execution because the requested command violated security allowlist policy.",
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Validate patch diff safety (block obvious path traversal)
    if (job.unifiedDiff.includes("../../") || job.targetPath.includes("..")) {
      return {
        jobId: job.jobId,
        status: "rejected",
        command: job.command,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        stdoutExcerpt: "",
        stderrExcerpt: "Security Policy Violation: Target file path or unified diff contains path traversal ('..') sequences.",
        isTruncated: false,
        sandboxType: this.sandboxType,
        isMock: true,
        securityAudit: this.getSecurityAudit(),
        explanation: "Job was rejected due to detected path traversal vulnerability in patch diff.",
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Check for deliberate simulation directives in diff or command (useful for testing)
    const isTimeout =
      job.command.includes("timeout") || job.unifiedDiff.includes("#simulate-timeout");
    if (isTimeout) {
      return {
        jobId: job.jobId,
        status: "timed_out",
        command: job.command,
        exitCode: null,
        durationMs: Math.min(job.timeoutMs, 60000),
        stdoutExcerpt: "[Sandbox Worker] Starting ephemeral execution environment...\n[Sandbox Worker] Applying patch to target repository...",
        stderrExcerpt: `Execution cancelled: Job exceeded maximum allowed wall-clock timeout (${job.timeoutMs}ms). Process killed.`,
        isTruncated: false,
        sandboxType: this.sandboxType,
        isMock: true,
        securityAudit: this.getSecurityAudit(),
        explanation: "The sandbox killed the process after exceeding the configured execution time limit.",
        timestamp: new Date().toISOString(),
      };
    }

    const isFailure =
      job.unifiedDiff.includes("#simulate-fail") ||
      job.command.includes("fail") ||
      job.unifiedDiff.includes("SYNTAX_ERROR");

    // 4. Generate deterministic mock test output
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let status: "passed" | "failed" = "passed";
    let explanation = "";

    const simulatedDuration = 1200 + Math.floor(Math.random() * 800);

    if (isFailure) {
      status = "failed";
      exitCode = 1;
      explanation = "Verification completed: Regression tests failed after applying the proposed patch.";
      stdout = [
        `[Sandbox Worker] Initialized ephemeral workspace in tmpfs (non-root uid=1000).`,
        `[Sandbox Worker] Network isolation verified: --network none.`,
        `[Sandbox Worker] Applied patch to ${job.targetPath}.`,
        `> ${job.command}`,
        ``,
        `Running tests...`,
        ` FAIL test/${job.targetPath.replace(/^src\//, "").replace(/\.[^.]+$/, "")}.test.ts`,
        `  ✕ regression test suite encountered assertion mismatch`,
        `    Expected: resolved`,
        `    Received: undefined`,
        ``,
        `Tests: 1 failed, 14 passed, 15 total`,
        `Snapshots: 0 total`,
        `Time: 1.42s`,
      ].join("\n");
      stderr = `Error: Process exited with non-zero exit code 1.`;
    } else {
      status = "passed";
      exitCode = 0;
      explanation = "Verification completed: All regression test suites passed cleanly with the proposed patch applied.";
      stdout = [
        `[Sandbox Worker] Initialized ephemeral workspace in tmpfs (non-root uid=1000).`,
        `[Sandbox Worker] Network isolation verified: --network none.`,
        `[Sandbox Worker] Applied patch to ${job.targetPath}.`,
        `> ${job.command}`,
        ``,
        `✓ test/${job.targetPath.replace(/^src\//, "").replace(/\.[^.]+$/, "")}.test.ts (15 tests) 280ms`,
        `✓ test/smoke.test.ts (8 tests) 110ms`,
        ``,
        `Test Files  2 passed (2)`,
        `     Tests  23 passed (23)`,
        `  Duration  1.18s`,
      ].join("\n");
    }

    // 5. Output buffer bounding (max 32 KB)
    let isTruncated = false;
    if (Buffer.byteLength(stdout, "utf-8") > MAX_OUTPUT_BYTES) {
      stdout = stdout.slice(0, MAX_OUTPUT_BYTES) + "\n... [TRUNCATED: Output exceeded 32KB buffer limit]";
      isTruncated = true;
    }

    return {
      jobId: job.jobId,
      status,
      command: job.command,
      exitCode,
      durationMs: simulatedDuration,
      stdoutExcerpt: stdout,
      stderrExcerpt: stderr,
      isTruncated,
      sandboxType: this.sandboxType,
      isMock: true,
      securityAudit: this.getSecurityAudit(),
      explanation,
      timestamp: new Date().toISOString(),
    };
  }

  private getSecurityAudit(): SandboxSecurityAudit {
    return {
      networkIsolated: true,
      nonRootUser: true,
      credentialsMounted: false,
      resourceLimitsEnforced: true,
      wallClockTimeoutMs: 60000,
      memoryLimitMb: 512,
      cpuQuota: 1.0,
    };
  }
}
