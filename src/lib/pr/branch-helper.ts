/**
 * Utilities for generating safe Git branch names and structured Draft PR bodies.
 */

const FORBIDDEN_BRANCHES = new Set([
  "main",
  "master",
  "prod",
  "production",
  "release",
  "dev",
  "develop",
]);

/**
 * Generates a dedicated, safe branch name following the PatchPilot convention.
 *
 * @param issueNumber - Target GitHub issue integer
 * @param timestamp - Optional epoch milliseconds for determinism in tests
 */
export function generateSafeBranchName(issueNumber: number, timestamp?: number): string {
  const ts = timestamp ?? Date.now();
  return `patchpilot/fix-issue-${issueNumber}-${ts}`;
}

/**
 * Validates whether a custom branch name is safe and does not target protected branches.
 */
export function isSafeBranchName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }

  // Block protected branches
  if (FORBIDDEN_BRANCHES.has(trimmed.toLowerCase())) {
    return false;
  }

  // Must match valid Git branch ref characters and contain no path traversal
  if (!/^[a-zA-Z0-9._/-]+$/.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith("/") || trimmed.endsWith("/") || trimmed.includes("..")) {
    return false;
  }

  return true;
}

/**
 * Formulates a structured, informative Draft PR body.
 */
export function generateDraftPRBody(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  targetPath: string;
  verificationStatus: string;
}): string {
  const { owner, repo, issueNumber, issueTitle, targetPath, verificationStatus } = params;

  let verificationBadge = "⚠️ **Verification Status:** Unverified (Not executed in sandbox)";
  if (verificationStatus === "passed") {
    verificationBadge = "✅ **Verification Status:** PASSED (Isolated regression tests passed in PatchPilot sandbox)";
  } else if (verificationStatus === "failed") {
    verificationBadge = "❌ **Verification Status:** FAILED (Regression test failures were reported)";
  }

  return [
    `## Summary of Changes`,
    ``,
    `Resolves #${issueNumber}: **${issueTitle}**`,
    ``,
    `This draft pull request proposes a targeted patch to address the reported issue in \`${targetPath}\`.`,
    ``,
    `### Verification & Safety`,
    ``,
    `- ${verificationBadge}`,
    `- **Target File:** \`${targetPath}\``,
    `- **Isolation Guarantee:** Network-disabled ephemeral sandbox, non-root execution.`,
    ``,
    `### Security & Governance Policy`,
    ``,
    `> **IMPORTANT:** This pull request was created as a **Draft PR** following explicit human approval in PatchPilot. PatchPilot adheres to a strict policy prohibiting automated merging.`,
    ``,
    `Please review the diff thoroughly and run your continuous integration pipeline before marking this pull request ready for review.`,
    ``,
    `---`,
    `*Generated with [PatchPilot](https://github.com/ABhardwaj28/PatchPilot) for ${owner}/${repo} — Human-Supervised GitHub Issue Investigation & Verification.*`,
  ].join("\n");
}
