import { GoogleGenAI, Type } from "@google/genai";
import { LLMProvider, PatchProposal, ProposePatchRequest } from "../types";
import { buildPromptWithDefenses, validatePatchProposal } from "../patch-validator";

export interface GeminiProviderOptions {
  apiKey: string;
  modelName?: string;
  timeoutMs?: number;
}

/**
 * Server-side Gemini LLM Provider adapter using official @google/genai SDK.
 * Communicates with Gemini models (default: gemini-3.8-flash) using structured output.
 */
export class GeminiProvider implements LLMProvider {
  public readonly name = "gemini";
  public readonly modelName: string;
  public readonly isMock = false;
  private readonly client: GoogleGenAI;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error("GeminiProvider requires a valid GEMINI_API_KEY.");
    }
    this.modelName = options.modelName || process.env.GEMINI_MODEL || "gemini-3.8-flash";
    this.timeoutMs = options.timeoutMs || 25000;
    this.client = new GoogleGenAI({ apiKey: options.apiKey.trim() });
  }

  async proposePatch(request: ProposePatchRequest): Promise<PatchProposal> {
    if (!request.files || request.files.length === 0) {
      throw new Error("Cannot propose patch: No repository files provided in context.");
    }

    const { systemInstruction, userPrompt } = buildPromptWithDefenses(request);
    const allowedPaths = request.files.map((f) => f.path);

    // Call Gemini with structured output responseSchema
    const generatePromise = this.client.models.generateContent({
      model: this.modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetPath: {
              type: Type.STRING,
              description: "Target file path from the provided context",
            },
            explanation: {
              type: Type.STRING,
              description: "Clear explanation of the fix and rationale",
            },
            unifiedDiff: {
              type: Type.STRING,
              description: "Valid unified diff format starting with --- and +++",
            },
            estimatedRisk: {
              type: Type.STRING,
              enum: ["low", "medium", "high"],
              description: "Subjective risk level of the change",
            },
          },
          required: ["targetPath", "explanation", "unifiedDiff", "estimatedRisk"],
        },
        maxOutputTokens: 4096,
        temperature: 0.2,
      },
    });

    // Timeout guard
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Gemini API request timed out after ${this.timeoutMs}ms.`)), this.timeoutMs);
    });

    let response;
    try {
      response = await Promise.race([generatePromise, timeoutPromise]);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes("timed out")) {
        throw new Error(error.message);
      }
      if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
        throw new Error("Gemini API rate limit or quota exceeded. Please try again shortly.");
      }
      if (error.message?.includes("403") || error.message?.toLowerCase().includes("permission")) {
        throw new Error("Gemini API authorization error: Provided API key is invalid or lacks necessary permissions.");
      }
      throw new Error(`Gemini API request failed: ${error.message || "Unknown error"}`);
    }

    const text = response.text;
    if (!text) {
      throw new Error("Gemini API returned an empty response or refused generation.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new Error("Failed to parse Gemini model response as structured JSON.");
    }

    // Strict safety & path validation
    const validation = validatePatchProposal(parsedJson, allowedPaths);
    if (!validation.valid || !validation.sanitizedOutput) {
      throw new Error(`Model generated invalid patch: ${validation.error}`);
    }

    return {
      explanation: validation.sanitizedOutput.explanation,
      targetPath: validation.sanitizedOutput.targetPath,
      unifiedDiff: validation.sanitizedOutput.unifiedDiff,
      estimatedRisk: validation.sanitizedOutput.estimatedRisk,
      provider: this.name,
      model: this.modelName,
      isMock: false,
      timestamp: new Date().toISOString(),
      verificationStatus: "unverified",
    };
  }
}
