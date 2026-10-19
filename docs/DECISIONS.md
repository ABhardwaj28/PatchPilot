# PatchPilot: Architecture & Design Decisions

This document records the foundational technical and architectural decisions for PatchPilot.

---

## ADR-001: Technology Stack Selection

### Context
PatchPilot requires a web-based user interface for issue submission and diff review, robust server-side processing for GitHub API communication, strict schema validation, and rigorous testing.

### Decision
We select:
- **Framework:** Next.js (App Router) with TypeScript.
  - *Rationale:* Provides unified frontend React rendering with server-side API Route Handlers. Allows server-only execution of GitHub API tokens and LLM provider calls, preventing key leakage to the client.
- **Styling:** Tailwind CSS.
  - *Rationale:* Utility-first CSS allowing rapid construction of accessible, responsive layouts and clear status indicator styling.
- **Validation:** Zod.
  - *Rationale:* Runtime schema enforcement for URLs, GitHub API responses, and structured LLM outputs.
- **GitHub Client:** Octokit.
  - *Rationale:* Official, standard GitHub SDK with built-in rate-limit, timeout, and authentication handling.
- **Testing:** Vitest and React Testing Library.
  - *Rationale:* Extremely fast execution, seamless TypeScript and ESM support, compatible with modern Next.js setups.

---

## ADR-002: Stateless First — MVP Starts Without a Database

### Context
Many AI developer tools introduce complex databases (e.g., PostgreSQL with Prisma/Drizzle) early, creating schema migration friction and state synchronization overhead before the core user journey is validated.

### Decision
The initial MVP will operate **statelessly**:
- Issue ingestion, metadata extraction, context bounding, and patch proposal generation will execute in an on-demand, request-driven pipeline.
- The user can download generated diffs or copy proposals directly in the UI.
- Persistence (e.g., PostgreSQL) will be introduced only when durable background job tracking, multi-user accounts, or persistent audit logs become an explicit requirement.

---

## ADR-003: Strict Isolation for Code Execution

### Context
PatchPilot aims to verify generated patches by executing tests against the target repository. Target repositories may contain malicious code, obfuscated exploits, or vulnerable dependencies.

### Decision
**Untrusted repository code must NEVER execute on the host machine or within the Next.js web server process.**
- Test execution must run in a physically decoupled worker in disposable containers or microVMs.
- Sandboxes must enforce non-root execution, dropped capabilities, no network access by default, and strict CPU/memory/disk/time quotas.
- Host credentials, SSH keys, Docker sockets, and environment secrets must never be mounted into the execution environment.
- **Fail-safe policy:** If secure sandbox isolation is not available or cannot be verified in a given deployment environment, live execution remains **disabled**. Unverified patches will be labeled honestly as unverified.

---

## ADR-004: Server-Side LLM Provider Adapter with Mock Mode

### Context
Calling LLM providers requires API keys and presents risks of downtime, rate limiting, and cost. Furthermore, automated CI and local development require deterministic testing without real credentials.

### Decision
- All LLM interactions must go through a server-side Provider Adapter interface.
- A deterministic `MockProvider` must be provided and used for local development and automated testing.
- Live LLM calls require explicit user configuration and must never be triggered implicitly or without cost awareness.
- Model outputs must be validated against a strict Zod schema enforcing unified diff syntax and valid file paths.

---

## ADR-005: Human-Gated Draft PRs (No Automatic Merging)

### Context
AI-generated patches can introduce subtle logic errors or security regressions even if unit tests pass.

### Decision
- PatchPilot will **never** automatically merge pull requests.
- Creating a pull request requires explicit user confirmation.
- PRs will strictly be opened as **Draft PRs** on dedicated, uniquely named branches.
- Permissions requested from GitHub must follow the principle of least privilege.

---

## ADR-006: Stage 1 Implemented Toolchain & Dependency Versions

### Context
Stage 1 requires initializing a reproducible developer setup with concrete, compatible dependencies for Node.js 20.18.2+.

### Decision
The following concrete stack has been installed and verified:
- **Runtime Target:** Node.js `>= 20.18.2` (audited with local v24.21.0).
- **Package Manager:** npm `>= 10.0.0`.
- **Framework:** Next.js `15.2.1` with React `19.0.0` and App Router.
- **Styling:** Tailwind CSS `3.4.17` with PostCSS and Autoprefixer.
- **Static Analysis & Linting:** TypeScript `5.7.3` and ESLint `9.x` with `@eslint/eslintrc` flat config compatibility.
- **Testing Engine:** Vitest `3.0.7`, `jsdom` `26.0.0`, `@testing-library/react` `16.2.0`, and `@testing-library/jest-dom` `6.6.3`.

---

## ADR-007: Open Source Licensing Selection

### Context
PatchPilot is conceived as a public, open-source developer tool. A clear, permissive license is required for community adoption and transparent public development.

### Decision
We license PatchPilot under the **MIT License**.
- *Rationale:* Highly permissive, standard across modern developer tooling ecosystems, and imposes minimal friction on adopters and contributors while retaining attribution and copyright notices.
