import { z } from "zod";

const FORBIDDEN_BRANCH_NAMES = new Set([
  "main",
  "master",
  "prod",
  "production",
  "release",
  "dev",
  "develop",
]);

/**
 * Strict schema for draft pull request creation requests.
 * Enforces human-in-the-loop confirmation and safe branch naming.
 */
export const DraftPRRequestSchema = z.object({
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
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
  issueTitle: z.string().min(1, "Issue title is required").max(500, "Issue title too long"),
  targetPath: z
    .string()
    .min(1, "Target file path is required")
    .max(300, "Target file path too long")
    .refine((p) => !p.startsWith("/") && !p.includes(".."), "Invalid target file path"),
  unifiedDiff: z
    .string()
    .min(10, "Diff must be at least 10 characters")
    .max(50000, "Diff exceeds maximum allowed size of 50KB"),
  verificationStatus: z
    .enum(["passed", "failed", "unverified", "timed_out", "rejected"])
    .default("unverified"),
  branchName: z
    .string()
    .max(100, "Branch name exceeds maximum length")
    .regex(/^[a-zA-Z0-9._/-]+$/, "Branch name contains invalid characters")
    .refine((b) => !b.startsWith("/") && !b.endsWith("/") && !b.includes(".."), "Invalid branch path")
    .refine((b) => !FORBIDDEN_BRANCH_NAMES.has(b.toLowerCase()), "Cannot push directly to a protected or primary branch name")
    .optional(),
  userConfirmed: z.boolean().refine(
    (val) => val === true,
    "Explicit human approval is strictly required. You must review the diff and confirm before generating a draft pull request."
  ),
});

export type DraftPRRequest = z.infer<typeof DraftPRRequestSchema>;

/**
 * Structured response returned upon successful draft PR creation.
 */
export interface DraftPRResult {
  prNumber: number;
  prUrl: string;
  branchName: string;
  isDraft: true;
  isMock: boolean;
  title: string;
  body: string;
  targetRepo: string;
  baseBranch: string;
  createdAt: string;
  humanConfirmed: true;
}

/**
 * Common interface for Draft PR creators (Mock client and Octokit live client).
 */
export interface DraftPRCreator {
  name: string;
  isMock: boolean;
  createDraftPR(req: DraftPRRequest): Promise<DraftPRResult>;
}
