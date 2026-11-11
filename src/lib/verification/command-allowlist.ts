/**
 * Security validator and parser for patch verification commands.
 * Strictly prevents arbitrary shell execution, command chaining,
 * subshells, network tools, and privilege escalation.
 */

export interface CommandValidationResult {
  isValid: boolean;
  normalizedCommand?: string;
  reason?: string;
}

// Prohibited shell metacharacters and control tokens
const DANGEROUS_SHELL_CHARS = /[;&|`$(){}<>\\*?~!\n\r]/;

// Strictly allowlisted command prefix patterns
const ALLOWED_COMMAND_PATTERNS: Array<{
  regex: RegExp;
  category: "node" | "python" | "rust" | "go";
  description: string;
}> = [
  // Node / TypeScript / Vitest / Jest
  {
    regex: /^npm (?:run )?test(?::[a-zA-Z0-9_-]+)?(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "node",
    description: "npm test / npm run test",
  },
  {
    regex: /^npx (?:vitest(?: run)?|jest)(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "node",
    description: "npx vitest run / npx jest",
  },
  {
    regex: /^pnpm (?:run )?test(?::[a-zA-Z0-9_-]+)?(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "node",
    description: "pnpm test",
  },
  {
    regex: /^yarn (?:run )?test(?::[a-zA-Z0-9_-]+)?(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "node",
    description: "yarn test",
  },

  // Python pytest / unittest
  {
    regex: /^pytest(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "python",
    description: "pytest",
  },
  {
    regex: /^python(?:3)? -m (?:pytest|unittest)(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "python",
    description: "python -m pytest / unittest",
  },

  // Rust cargo
  {
    regex: /^cargo test(?:\s+--[a-zA-Z0-9_-]+)*(?:\s+[a-zA-Z0-9_./-]+)*$/,
    category: "rust",
    description: "cargo test",
  },

  // Go test
  {
    regex: /^go test(?:\s+-v)?(?:\s+\.\/\.\.\.|\s+[a-zA-Z0-9_./-]+)*$/,
    category: "go",
    description: "go test",
  },
];

// Explicitly blocked command tokens
const FORBIDDEN_TOKENS = new Set([
  "sh",
  "bash",
  "zsh",
  "csh",
  "ksh",
  "fish",
  "dash",
  "sudo",
  "su",
  "doas",
  "eval",
  "exec",
  "curl",
  "wget",
  "nc",
  "netcat",
  "ncat",
  "telnet",
  "ssh",
  "scp",
  "rsync",
  "ftp",
  "git",
  "rm",
  "mv",
  "cp",
  "chmod",
  "chown",
  "kill",
  "pkill",
  "dd",
]);

/**
 * Validates a test verification command against strict security policies.
 * 
 * @param command - Raw command string from user input
 * @returns CommandValidationResult with validity and explanatory reason
 */
export function validateVerificationCommand(command: string): CommandValidationResult {
  if (!command || typeof command !== "string") {
    return {
      isValid: false,
      reason: "Command is empty or not a string.",
    };
  }

  const trimmed = command.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      reason: "Command cannot be blank.",
    };
  }

  if (trimmed.length > 200) {
    return {
      isValid: false,
      reason: "Command exceeds maximum length of 200 characters.",
    };
  }

  // 1. Check for dangerous shell metacharacters
  if (DANGEROUS_SHELL_CHARS.test(trimmed)) {
    return {
      isValid: false,
      reason: "Command contains forbidden shell metacharacters (;, &, |, `, $, (, ), {, }, <, >, \\, *, ?, ~, or newlines). Chaining and redirection are strictly prohibited.",
    };
  }

  // 2. Check for directory traversal in arguments (e.g. '../', '/..', or standalone '..')
  if (/(?:^|[/\s])\.\.(?:[/\s]|$)/.test(trimmed)) {
    return {
      isValid: false,
      reason: "Directory traversal ('..') is not permitted in test commands.",
    };
  }

  // 3. Tokenize by whitespace and inspect leading binary / tokens
  const tokens = trimmed.split(/\s+/);
  const primaryBinary = tokens[0];

  if (FORBIDDEN_TOKENS.has(primaryBinary)) {
    return {
      isValid: false,
      reason: `Direct invocation of binary '${primaryBinary}' is prohibited. Only approved test runners are permitted.`,
    };
  }

  // Check if any argument is a forbidden token (e.g. attempting to pass bash to a runner)
  for (const token of tokens) {
    if (FORBIDDEN_TOKENS.has(token) && token !== primaryBinary) {
      return {
        isValid: false,
        reason: `Passing forbidden utility '${token}' as a command argument is prohibited.`,
      };
    }
  }

  // 4. Match against allowlisted patterns
  const matchedPattern = ALLOWED_COMMAND_PATTERNS.find((pattern) =>
    pattern.regex.test(trimmed)
  );

  if (!matchedPattern) {
    return {
      isValid: false,
      reason: `Command '${trimmed}' does not match any approved test runner pattern (npm test, vitest, jest, pytest, cargo test, go test). Arbitrary shell execution is disabled.`,
    };
  }

  return {
    isValid: true,
    normalizedCommand: trimmed,
  };
}

/**
 * Standard allowlisted presets available for quick selection in the UI.
 */
export const ALLOWLISTED_PRESETS = [
  { label: "Node.js (npm test)", command: "npm test" },
  { label: "Vitest (npx vitest run)", command: "npx vitest run" },
  { label: "Jest (npx jest)", command: "npx jest" },
  { label: "Python (pytest)", command: "pytest" },
  { label: "Python (python -m unittest)", command: "python -m unittest" },
  { label: "Rust (cargo test)", command: "cargo test" },
  { label: "Go (go test ./...)", command: "go test ./..." },
] as const;
