import { LLMProvider } from "./types";
import { MockProvider } from "./providers/mock-provider";
import { GeminiProvider } from "./providers/gemini-provider";

export interface ProviderFactoryConfig {
  providerName?: string;
  apiKey?: string;
  modelName?: string;
}

/**
 * Returns the configured server-side LLM provider.
 * Defaults to MockProvider for local dev, offline tests, and zero-cost operation.
 */
export function getLLMProvider(configOverride?: ProviderFactoryConfig): LLMProvider {
  const providerName = (
    configOverride?.providerName ||
    process.env.AI_PROVIDER ||
    "mock"
  ).toLowerCase().trim();

  if (providerName === "gemini") {
    const apiKey =
      configOverride?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY;

    if (!apiKey || apiKey.includes("placeholder") || !apiKey.trim()) {
      throw new Error(
        'Gemini provider selected (AI_PROVIDER="gemini"), but GEMINI_API_KEY is missing or contains placeholder in .env.local.'
      );
    }

    return new GeminiProvider({
      apiKey: apiKey.trim(),
      modelName: configOverride?.modelName || process.env.GEMINI_MODEL || "gemini-3.8-flash",
    });
  }

  // Default to MockProvider
  return new MockProvider();
}
