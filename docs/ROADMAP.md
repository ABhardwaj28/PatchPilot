# PatchPilot: 6-Week Roadmap

PatchPilot is an AI-assisted GitHub issue investigation and patch-verification tool. This roadmap defines the phased implementation across 6 weeks (Stages 0 through 8).

> **IMPORTANT:** Later stages **must wait for explicit user approval** before implementation begins. Do not implement features from future stages ahead of schedule.

---

## Stage-by-Stage Breakdown

### Week 1 — Foundation and Public Repository

#### Stage 0: Environment and Requirements Audit `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint: `chore: document project plan and development environment`.
- **Goal:** Audit local toolchains, establish project rules, document technical decisions, roadmap, and security model. No application code or dependencies.
- **Exit Criteria:**
  - Workspace state inspected and preserved.
  - Core documentation (`PROJECT_RULES.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/SECURITY_MODEL.md`) created and internally consistent.
  - Zero secrets or tokens written.
  - Explicit approval required to proceed to Stage 1.
- **Risks:** Node version discrepancies, missing local CLI tools.

#### Stage 1: Initialize App, Documentation, and Repository `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint commit: `bfb155d`.
- **Goal:** Create a minimal working Next.js App Router application with TypeScript, Tailwind CSS, ESLint, and Vitest. Establish repo files (`README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `.gitignore`, `.env.example`).
- **Exit Criteria:**
  - App starts locally (`npm run dev`).
  - Tests, lint, type-check, and production build pass.
  - Root documentation is accurate and reflective of the prototype status.
  - Git repository initialized and clean initial checkpoint committed.
- **Risks:** Bloated starter templates, dependency version mismatches, untracked build artifacts.

#### Stage 2: UI Shell and Issue URL Validation `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint commit: `ca87622`.
- **Goal:** Build responsive UI shell with an issue-submission form and a strict URL parser for public GitHub issue links (`https://github.com/{owner}/{repo}/issues/{number}`).
- **Exit Criteria:**
  - Strict input validation rejecting non-HTTPS, PR URLs, non-GitHub domains, malformed numbers, and unexpected path segments.
  - Unit tests covering positive and negative edge cases.
  - Accessible form states (empty, loading, validation error, success).
  - Clearly labeled as "Validation Only" (no API calls or AI execution).
- **Risks:** Overly permissive regex leading to unexpected inputs or SSRF vulnerabilities.

---

### Week 2 — GitHub Issue Intake & Context Collection

#### Stage 3: GitHub API Integration & Issue Metadata `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint commit: `feat: fetch public GitHub issue metadata`.
- **Goal:** Fetch issue and repository metadata server-side using Octokit with strict timeouts and error handling.
- **Exit Criteria:**
  - Server-side only data fetching; zero tokens exposed to browser.
  - Graceful handling of 404, rate limits (403/429), timeouts, and invalid payloads.
  - Unit tests with mocked responses passing offline without internet or real tokens.
- **Risks:** GitHub API rate limits on anonymous requests; unescaped issue descriptions.

#### Stage 4: Bounded Repository File Retrieval & Investigation Plan `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint commit: `feat: build bounded repository investigation context`.
- **Goal:** Collect a bounded, read-only subset of repository context and generate an explainable investigation plan.
- **Exit Criteria:**
  - Strict byte limits (30 KB/file, 100 KB total), file count limits (5 files max), and binary/lockfile/secret exclusions.
  - Deterministic relevance heuristic with explicit explainability rationale for each selected file.
  - No cloning, downloading, or executing repository code on the host or server.
  - Structured hypothesis report labeled clearly as unverified by execution.
  - Comprehensive unit and smoke tests passing offline (54/54 tests project-wide).
- **Risks:** Context window overload; accidental retrieval of large files or secrets in repos.

---

### Week 3 — AI Patch Proposal

#### Stage 5: Server-Side LLM Adapter & Diff Review UI `[COMPLETED]`
- **Status:** :white_check_mark: Completed. Checkpoint commit: `feat: generate reviewable patch proposals`.
- **Goal:** Server-side LLM provider adapter producing structured unified diff patches, with a deterministic mock provider for local/test use and Google Gemini adapter for live generation.
- **Exit Criteria:**
  - Strict Zod schema validation for model output (`RawModelPatchOutputSchema`).
  - Target paths strictly validated against known repo files (no path traversal, no absolute paths).
  - Reviewable diff viewer with copy/download options and syntax highlighting.
  - Clear label: "Proposed — not executed or verified".
  - Comprehensive unit and integration test suite passing offline (71/71 tests project-wide).
- **Risks:** Hallucinated file paths; prompt injection within issue/code context attempting policy override.

---

### Week 4 — Verification Design

#### Stage 6: Isolated Verification Worker (Security-Critical) `[NEXT]`
- **Status:** :arrow_forward: Up Next (Awaiting user approval to begin).
- **Goal:** Separate worker architecture to run patch verification in an ephemeral, isolated container/microVM sandbox.
- **Exit Criteria:**
  - Threat model reviewed and approved before implementation.
  - Ephemeral sandbox with non-root user, no network by default, strict CPU/memory/time limits, dropped capabilities, read-only root.
  - Strictly allowlisted commands (no arbitrary shell execution).
  - Truthful job lifecycle reporting (`queued`, `running`, `passed`, `failed`, `timed out`, `internal error`).
  - *Fallback rule:* If safe isolation cannot be achieved, live execution remains disabled.
- **Risks:** Container escape, host resource exhaustion, socket exposure.

---

### Week 5 — Hardening & Draft PRs

#### Stage 7: Security Review & Optional Approved Draft PR Workflow
- **Goal:** Harden security, add server-side rate limits, and provide an explicit human-approved workflow to generate a draft pull request.
- **Exit Criteria:**
  - Strict human confirmation gate (no automatic PR creation, no automatic merging).
  - Dedicated branch creation using safe naming.
  - Least-privilege GitHub permissions (scoped tokens / GitHub App).
  - Comprehensive negative tests (denied permissions, duplicate attempts, failure states).
- **Risks:** Accidental push to protected branches; permission creep.

---

### Week 6 — Release and Public Launch

#### Stage 8: Public Beta Release, CI, and Onboarding
- **Goal:** Polish repository, automate CI checks, verify accessibility, create 60–90 second demo script, and release public beta.
- **Exit Criteria:**
  - GitHub Actions CI running lint, type-check, test, and build cleanly.
  - Setup verified on clean checkout.
  - Real Mermaid architecture diagrams in `docs/ARCHITECTURE.md`.
  - Comprehensive release checklist and honest documentation of all limitations.
- **Risks:** Inaccurate marketing claims; untested deployment configurations.

---

## Stage Approval Protocol

No stage may begin until:
1. The preceding stage's automated checks (`test`, `lint`, `type-check`, `build`) pass completely.
2. The manual checks from the playbook are verified.
3. The git diff is reviewed and committed as a clean checkpoint.
4. The user gives explicit approval to proceed.
