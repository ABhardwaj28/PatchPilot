# PatchPilot: Public Beta Release Checklist & Production Audit

This document records the release readiness audit and known limitations for the **PatchPilot Public Beta Release (Stage 8)**.

---

## 1. Release Verification Checklist

Every item below has been verified across local environments and automated CI checks:

### Automated Quality Gates
- [x] **Linting:** `npm run lint` passes with 0 warnings and 0 errors across all TypeScript and React files.
- [x] **Type Checking:** `tsc --noEmit` completes cleanly with 0 type errors.
- [x] **Test Suite:** `npm test` runs 173 unit, integration, and UI smoke tests with 100% pass rate.
- [x] **Production Bundle:** `npm run build` generates optimized static pages and serverless route handlers without compilation errors.
- [x] **Continuous Integration:** GitHub Actions workflow (`.github/workflows/ci.yml`) configured to run on all pushes to `main` and pull requests.
- [x] **Git Cleanliness:** `git diff --check` verifies zero whitespace errors; clean working tree on `main`.

### Security & Privacy Audits
- [x] **Zero Secret Leaks:** No API keys, PATs, or tokens committed to source code or git history. `.env.local` is strictly ignored by `.gitignore`.
- [x] **Comprehensive Secret Redaction:** `src/lib/security/redactor.ts` verified to strip GitHub tokens, Gemini/OpenAI/Anthropic keys, bearer tokens, and private keys from all API outputs.
- [x] **Sliding-Window Rate Limiting:** Rate limiters active on all mutation routes (`/api/create-draft-pr`, `/api/verify-patch`, `/api/propose-patch`) with standard HTTP 429 and `Retry-After` headers.
- [x] **No Untrusted Code on Web Host:** Untrusted repository code is never executed on the web host. In environments without microVM isolation, `MockVerificationWorker` enforces safe simulation.
- [x] **Input Sanitization:** URL parsing rejects SSRF; Zod schemas reject directory traversal (`..`) in file paths and Git branch names.
- [x] **Affirmative Human Gate:** Draft pull requests strictly require `userConfirmed: true` and cannot be triggered implicitly.
- [x] **No Auto-Merging Policy:** Deliberately omitted by policy; PRs are strictly created as Draft PRs.

### Documentation & Developer Experience
- [x] **Living README:** Accurate feature status matrix, local endpoints table, tech stack, and setup instructions in `README.md`.
- [x] **Architectural Decision Records:** 14 detailed ADRs recorded in `docs/DECISIONS.md`.
- [x] **Architecture Diagrams:** High-level component flowchart and sequence diagrams in `docs/ARCHITECTURE.md`.
- [x] **Security Model & Threat Matrix:** Complete threat model and sandbox isolation analysis in `docs/SECURITY_MODEL.md`.
- [x] **6-Week Roadmap:** All 8 stages documented with completed checkpoints in `docs/ROADMAP.md`.
- [x] **Public Demo Script:** 60–90 second screen recording guide in `docs/DEMO_SCRIPT.md`.
- [x] **Open Source Governance:** `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, and pull request template present and verified.

---

## 2. Honest Documentation of Limitations

To uphold transparency and integrity (Project Rule 15), PatchPilot openly documents its current prototype boundaries:

1. **Public GitHub Issues Focus:**
   - The primary workflow is optimized for public GitHub issues (`https://github.com/{owner}/{repo}/issues/{number}`).
   - Private repositories require explicit server-side `GITHUB_TOKEN` configuration with appropriate repo scopes.
2. **Single-File Patch Proposals:**
   - PatchPilot currently generates targeted unified diffs modifying a single primary file identified by the relevance heuristic. Multi-file refactorings are planned for future major releases.
3. **Safe Execution Fallback in Local Environments:**
   - Hardware-assisted microVM or gVisor container runners require dedicated Linux kernel infrastructure. When running locally on macOS or in environments without container daemons, PatchPilot safely falls back to `MockVerificationWorker`, guaranteeing host system safety.
4. **Draft PR Mode Only:**
   - PatchPilot will **never** automatically merge pull requests or deploy code to production. Passing test verification is evidence of patch viability, not proof of complete correctness. All changes require human code review.
