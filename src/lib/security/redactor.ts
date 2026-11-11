/**
 * Comprehensive secret redaction engine for PatchPilot.
 * Redacts API keys, GitHub tokens, passwords, private keys, and authorization headers
 * from logs, error messages, diffs, and API responses.
 */

// Patterns matching common secrets and credentials
const SECRET_PATTERNS: Array<{ regex: RegExp; placeholder: string }> = [
  // GitHub Personal Access Tokens and Fine-Grained Tokens
  { regex: /ghp_[a-zA-Z0-9]{36,}/g, placeholder: "ghp_[REDACTED_GH_TOKEN]" },
  { regex: /gho_[a-zA-Z0-9]{36,}/g, placeholder: "gho_[REDACTED_OAUTH_TOKEN]" },
  { regex: /ghu_[a-zA-Z0-9]{36,}/g, placeholder: "ghu_[REDACTED_USER_TOKEN]" },
  { regex: /ghs_[a-zA-Z0-9]{36,}/g, placeholder: "ghs_[REDACTED_SERVER_TOKEN]" },
  { regex: /ghr_[a-zA-Z0-9]{36,}/g, placeholder: "ghr_[REDACTED_REFRESH_TOKEN]" },
  { regex: /github_pat_[a-zA-Z0-9_]{82,}/g, placeholder: "github_pat_[REDACTED_FINE_GRAINED_PAT]" },

  // Google Gemini / Cloud API keys (AIzaSy...)
  { regex: /AIzaSy[a-zA-Z0-9_-]{33}/g, placeholder: "AIzaSy[REDACTED_GEMINI_KEY]" },

  // Anthropic API keys (sk-ant-...) - MUST be before generic sk-
  { regex: /sk-ant-[a-zA-Z0-9-_]{20,}/g, placeholder: "sk-ant-[REDACTED_ANTHROPIC_KEY]" },

  // OpenAI API keys (sk-proj-..., sk-...)
  { regex: /sk-(?!ant-)[a-zA-Z0-9-_]{20,}/g, placeholder: "sk-[REDACTED_OPENAI_KEY]" },

  // Generic key/token URI parameters (?token=..., &api_key=...)
  { regex: /([?&](?:token|key|api_key|access_token|secret)=)[^&\s]+/gi, placeholder: "$1[REDACTED]" },

  // Generic key/token assignments (token=..., api_key=...)
  { regex: /((?:token|api_key|apiKey|secret|password|passwd|auth)=)["']?[a-zA-Z0-9-_.~+/]{8,}["']?/gi, placeholder: "$1[REDACTED]" },

  // HTTP Authorization Bearer headers
  { regex: /(Bearer\s+)[a-zA-Z0-9_.-]{12,}/gi, placeholder: "$1[REDACTED_BEARER_TOKEN]" },

  // Basic Auth URLs (https://user:password@...)
  { regex: /(https?:\/\/[^/:]+:)[^/@]+@/gi, placeholder: "$1[REDACTED_AUTH]@" },

  // RSA / OpenSSH Private Keys
  { regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA|OPENSSH|EC|DSA)?\s*PRIVATE KEY-----/gi, placeholder: "[REDACTED_PRIVATE_KEY]" },
];

/**
 * Redacts any detected credentials, API keys, or private tokens from a string.
 *
 * @param text - The raw string to sanitize
 * @returns Sanitized string safe for logging or user display
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") {
    return text || "";
  }

  let sanitized = text;
  for (const { regex, placeholder } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, placeholder);
  }

  return sanitized;
}

/**
 * Safely format an error object, stripping secrets from the message and stack.
 */
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return redactSecrets(err.message || "An unexpected error occurred.");
  }
  if (typeof err === "string") {
    return redactSecrets(err);
  }
  return "An unexpected error occurred.";
}
