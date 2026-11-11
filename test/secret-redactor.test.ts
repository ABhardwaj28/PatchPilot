import { describe, it, expect } from "vitest";
import { redactSecrets, sanitizeError } from "@/lib/security/redactor";

describe("Stage 7: Secret Redactor Engine", () => {
  it("redacts GitHub personal access tokens and OAuth tokens", () => {
    const textWithTokens = "Error connecting with ghp_1234567890abcdefghijklmnopqrstuvwxyzAB and gho_oauthToken1234567890abcdefghijklmnopqr";
    const redacted = redactSecrets(textWithTokens);

    expect(redacted).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyzAB");
    expect(redacted).not.toContain("gho_oauthToken1234567890abcdefghijklmnopqr");
    expect(redacted).toContain("ghp_[REDACTED_GH_TOKEN]");
    expect(redacted).toContain("gho_[REDACTED_OAUTH_TOKEN]");
  });

  it("redacts GitHub fine-grained personal access tokens", () => {
    const text = "Using token github_pat_11ABCD_1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_ABCD";
    const redacted = redactSecrets(text);

    expect(redacted).not.toContain("github_pat_11ABCD");
    expect(redacted).toContain("github_pat_[REDACTED_FINE_GRAINED_PAT]");
  });

  it("redacts Gemini and Cloud API keys", () => {
    const text = "Calling Gemini API with key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q";
    const redacted = redactSecrets(text);

    expect(redacted).not.toContain("AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q");
    expect(redacted).toContain("AIzaSy[REDACTED_GEMINI_KEY]");
  });

  it("redacts OpenAI and Anthropic API keys", () => {
    const openAI = "Key sk-proj-1234567890abcdefghijklmnop";
    const anthropic = "Key sk-ant-1234567890abcdefghijklmnop";

    expect(redactSecrets(openAI)).toContain("sk-[REDACTED_OPENAI_KEY]");
    expect(redactSecrets(anthropic)).toContain("sk-ant-[REDACTED_ANTHROPIC_KEY]");
  });

  it("redacts HTTP Authorization Bearer headers", () => {
    const header = "Authorization: Bearer mySuperSecretToken123456789";
    const redacted = redactSecrets(header);

    expect(redacted).not.toContain("mySuperSecretToken123456789");
    expect(redacted).toContain("Bearer [REDACTED_BEARER_TOKEN]");
  });

  it("redacts Basic Auth credentials in URLs", () => {
    const url = "https://admin:superSecretPassword@github.com/repo";
    const redacted = redactSecrets(url);

    expect(redacted).not.toContain("superSecretPassword");
    expect(redacted).toContain("https://admin:[REDACTED_AUTH]@github.com/repo");
  });

  it("redacts RSA / OpenSSH private keys", () => {
    const privateKey = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA0m4wH5...",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");

    const redacted = redactSecrets(privateKey);
    expect(redacted).not.toContain("MIIEowIBAAKCAQEA0m4wH5...");
    expect(redacted).toBe("[REDACTED_PRIVATE_KEY]");
  });

  it("preserves non-sensitive strings without modification", () => {
    const safeText = "Regular error: File src/utils/helpers.ts not found.";
    expect(redactSecrets(safeText)).toBe(safeText);
  });

  it("sanitizeError handles Error objects and strings safely", () => {
    const err = new Error("Failed with token ghp_1234567890abcdefghijklmnopqrstuvwxyzAB");
    expect(sanitizeError(err)).toContain("ghp_[REDACTED_GH_TOKEN]");
    expect(sanitizeError("Raw token=1234567890abc")).toContain("token=[REDACTED]");
    expect(sanitizeError(null)).toBe("An unexpected error occurred.");
  });
});
