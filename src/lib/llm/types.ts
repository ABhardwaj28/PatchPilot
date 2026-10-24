import { z } from "zod";

/**
 * Strict schema for raw model patch proposals.
 */
export const RawModelPatchOutputSchema = z.object({
  explanation: z
    .string()
    .min(10, "Explanation must be at least 10 characters")
    .max(2000, "Explanation exceeds maximum length of 2000 characters"),
  targetPath: z
    .string()
    .min(1, "Target path is required")
    .max(300, "Target path exceeds maximum length"),
  unifiedDiff: z
    .string()
    .min(10, "Unified diff must be at least 10 characters")
    .max(50000, "Unified diff exceeds maximum length of 50KB"),
  estimatedRisk: z.enum(["low", "medium", "high"]),
});

export type RawModelPatchOutput = z.infer<typeof RawModelPatchOutputSchema>;

/**
 * Request payload sent to the LLM adapter.
 */
export interface ProposePatchRequest {
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Fully validated patch proposal response returned to the client.
 */
export interface PatchProposal {
  explanation: string;
  targetPath: string;
  unifiedDiff: string;
  estimatedRisk: "low" | "medium" | "high";
  provider: string;
  model: string;
  isMock: boolean;
  timestamp: string;
  verificationStatus: "unverified";
}

/**
 * Common interface for all LLM providers (Mock, Gemini, Anthropic, OpenAI).
 */
export interface LLMProvider {
  name: string;
  modelName: string;
  isMock: boolean;
  proposePatch(request: ProposePatchRequest): Promise<PatchProposal>;
}
