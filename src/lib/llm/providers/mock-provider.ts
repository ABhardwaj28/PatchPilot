import { LLMProvider, PatchProposal, ProposePatchRequest } from "../types";
import { validatePatchProposal } from "../patch-validator";

/**
 * Deterministic Mock LLM Provider for local development, offline verification, and automated testing.
 * Never calls external APIs or incurs costs. Output is always explicitly labeled as mock.
 */
export class MockProvider implements LLMProvider {
  public readonly name = "mock";
  public readonly modelName = "deterministic-mock-v1";
  public readonly isMock = true;

  async proposePatch(request: ProposePatchRequest): Promise<PatchProposal> {
    if (!request.files || request.files.length === 0) {
      throw new Error("Cannot propose patch: No repository files provided in context.");
    }

    // Select the first context file as the target
    const targetFile = request.files[0];
    const targetPath = targetFile.path;

    // Generate a deterministic mock fix based on the issue title
    const explanation = `[MOCK PROPOSAL] Defensively handles edge cases in ${targetPath} corresponding to "${request.issueTitle}". Adds input validation and safeguards against unexpected null or undefined states.`;

    const mockDiff = [
      `--- a/${targetPath}`,
      `+++ b/${targetPath}`,
      `@@ -1,5 +1,8 @@`,
      ` // PatchPilot automated proposal for: ${request.issueTitle.slice(0, 50)}`,
      `+if (!input || typeof input !== "object") {`,
      `+  throw new TypeError("Invalid argument: Expected an object payload");`,
      `+}`,
      ` export function handleRequest(input: unknown) {`,
    ].join("\n");

    const rawOutput = {
      targetPath,
      explanation,
      unifiedDiff: mockDiff,
      estimatedRisk: "low" as const,
    };

    const allowedPaths = request.files.map((f) => f.path);
    const validation = validatePatchProposal(rawOutput, allowedPaths);

    if (!validation.valid || !validation.sanitizedOutput) {
      throw new Error(`Mock provider generated invalid output: ${validation.error}`);
    }

    return {
      explanation: validation.sanitizedOutput.explanation,
      targetPath: validation.sanitizedOutput.targetPath,
      unifiedDiff: validation.sanitizedOutput.unifiedDiff,
      estimatedRisk: validation.sanitizedOutput.estimatedRisk,
      provider: this.name,
      model: this.modelName,
      isMock: true,
      timestamp: new Date().toISOString(),
      verificationStatus: "unverified",
    };
  }
}
