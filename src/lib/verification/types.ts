import { z } from "zod";

/**
 * Truthful lifecycle states of an isolated verification job.
 */
export type VerificationStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "timed_out"
  | "rejected"
  | "internal_error";

/**
 * Supported sandbox technologies.
 */
export type SandboxType = "mock-sandbox" | "isolated-container" | "microvm";

/**
 * Security audit metadata verifying sandbox boundary enforcement.
 */
export interface SandboxSecurityAudit {
  networkIsolated: boolean;
  nonRootUser: boolean;
  credentialsMounted: boolean;
  resourceLimitsEnforced: boolean;
  wallClockTimeoutMs: number;
  memoryLimitMb: number;
  cpuQuota: number;
}

/**
 * Strict schema for patch verification requests.
 */
export const VerificationJobRequestSchema = z.object({
  owner: z
    .string()
    .min(1, "Owner is required")
    .max(100, "Owner name too long")
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/, "Invalid GitHub owner name"),
  repo: z
    .string()
    .min(1, "Repository is required")
    .max(100, "Repository name too long")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid GitHub repository name")
    .refine((r) => !r.includes(".."), "Path traversal not permitted"),
  targetPath: z
    .string()
    .min(1, "Target file path is required")
    .max(300, "Target file path too long")
    .refine((p) => !p.startsWith("/") && !p.includes(".."), "Invalid target file path"),
  unifiedDiff: z
    .string()
    .min(10, "Diff must be at least 10 characters")
    .max(50000, "Diff exceeds maximum allowed size of 50KB"),
  command: z
    .string()
    .min(1, "Test command is required")
    .max(200, "Test command exceeds maximum allowed length"),
});

export type VerificationJobRequest = z.infer<typeof VerificationJobRequestSchema>;

/**
 * Internal representation of a scheduled verification job.
 */
export interface VerificationJob {
  jobId: string;
  owner: string;
  repo: string;
  targetPath: string;
  unifiedDiff: string;
  command: string;
  createdAt: string;
  timeoutMs: number;
}

/**
 * Verification execution result returned to client.
 */
export interface VerificationResult {
  jobId: string;
  status: VerificationStatus;
  command: string;
  exitCode: number | null;
  durationMs: number;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  isTruncated: boolean;
  sandboxType: SandboxType;
  isMock: boolean;
  securityAudit: SandboxSecurityAudit;
  explanation: string;
  timestamp: string;
}

/**
 * Common interface for all verification workers (Mock, Docker/gVisor, MicroVM).
 */
export interface VerificationWorker {
  name: string;
  sandboxType: SandboxType;
  isLiveExecution: boolean;
  runJob(job: VerificationJob): Promise<VerificationResult>;
}

