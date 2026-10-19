# PatchPilot

> **AI-assisted GitHub issue investigation and patch-verification tool.**

PatchPilot is an open-source developer tool built to bridge the gap between AI code generation and reliable software engineering. Given a public GitHub issue, PatchPilot extracts structured context, formulates an explainable investigation plan, suggests a minimal unified diff, and verifies the patch in a disposable, isolated sandbox before a human engineer ever considers submitting a draft pull request.

---

## What PatchPilot Is and Is Not

### What PatchPilot Is
- An **investigation assistant** that reads public GitHub issues and gathers bounded repository context.
- A **patch proposer** that outputs readable unified diffs for developer review.
- A **verification system** designed to run regression tests in disposable, isolated worker environments.
- A **human-in-the-loop tool** requiring explicit human confirmation before opening draft pull requests.

### What PatchPilot Is Not
- **Not an autonomous auto-merger:** PatchPilot will never merge pull requests or deploy code automatically.
- **Not a black-box fixer:** We do not claim generated fixes are guaranteed correct. Passing tests are evidence, not proof of correctness.
- **Not an arbitrary command runner:** PatchPilot will not execute unsanitized shell commands or run untrusted code on the web host.

---

## Current Status (Stage 1 Prototype)

PatchPilot is actively in **Stage 2 (UI Shell & Safe Issue URL Validation)** of its [6-Week Roadmap](docs/ROADMAP.md).

### Feature Status Matrix

| Capability | Status | Stage | Notes |
| :--- | :---: | :---: | :--- |
| Next.js App Shell & Design System | :white_check_mark: Implemented | Stage 1 | Dark-mode accessible landing page and health route |
| Smoke Tests & Static Analysis | :white_check_mark: Implemented | Stage 1 | Vitest, ESLint 9, TypeScript type checking |
| Open Source Governance & Security Docs | :white_check_mark: Implemented | Stage 1 | MIT License, CONTRIBUTING, SECURITY, PR Template |
| GitHub Issue URL Validation | :white_check_mark: Implemented | Stage 2 | Strict URL parsing (HTTPS, supported domains, no SSRF, dual client & server validation) |
| GitHub API Metadata Extraction | :calendar: Planned | Stage 3 | Server-side Octokit client with rate-limiting |
| Bounded Context Retrieval | :calendar: Planned | Stage 4 | File heuristics, size/count limits, no whole-repo clones |
| LLM Provider Adapter & Diff Viewer | :calendar: Planned | Stage 5 | Schema validation, path traversal guard, mock provider |
| Isolated Containerized Test Worker | :calendar: Planned | Stage 6 | Ephemeral sandboxes, zero network, non-root user |
| Human-Gated Draft PR Creation | :calendar: Planned | Stage 7 | Scoped tokens, explicit confirmation gate, draft PRs only |
| Auto-merging to Main Branch | :no_entry_sign: Not Available | — | Deliberately excluded by security policy |
| Host-level Untrusted Code Execution | :no_entry_sign: Not Available | — | Strictly forbidden; sandboxing mandatory |

---

## Tech Stack

- **Frontend & App Framework:** [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Testing:** [Vitest 3](https://vitest.dev/), [React Testing Library](https://testing-library.com/), [jsdom](https://github.com/jsdom/jsdom)
- **Linting & Quality:** [ESLint 9](https://eslint.org/) with `next/core-web-vitals`

---

## Prerequisites

- **Node.js:** `>= 20.18.2` (tested with v24.21.0)
- **npm:** `>= 10.0.0`
- **Git:** `>= 2.40.0`

---

## Local Setup & Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ABhardwaj28/PatchPilot.git
   cd PatchPilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env.local
   ```
   *Note: `.env.local` is strictly ignored by Git. No real secrets or API keys are required for Stage 1.*

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Automated Checks & Verification

PatchPilot enforces strict automated quality gates:

```bash
# Run unit and component smoke tests
npm test

# Run tests in interactive watch mode
npm run test:watch

# Verify TypeScript type correctness
npm run type-check

# Run ESLint across all source files
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```

---

## Environment Variables

All configuration is managed through environment variables. See [.env.example](.env.example) for documentation:

| Variable | Description | Default / Example | Required in Stage 1 |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Runtime environment | `development` | No |
| `PORT` | Local web port | `3000` | No |
| `GITHUB_TOKEN` | Optional GitHub PAT for higher API rate limits | Placeholder in `.env.example` | No |
| `AI_PROVIDER` | LLM provider adapter (`mock`, `openai`, etc.) | `mock` | No |
| `AI_API_KEY` | Provider API key | Placeholder in `.env.example` | No |

---

## Security & Privacy

For full security architecture and disclosure guidelines, see:
- [SECURITY.md](SECURITY.md) — Security policy and vulnerability reporting.
- [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) — Threat boundaries, data classification, and sandbox isolation guarantees.
- [docs/DECISIONS.md](docs/DECISIONS.md) — Architectural Decision Records (ADRs).

**Key principles:**
- Zero token leakage to client-side bundles or repository files.
- Untrusted repository code never runs on the web host.
- Human review is strictly required before any GitHub mutation.

---

## Screenshots & Demo

<!-- TODO: Real application screenshots will be added in Stage 2 once interactive validation is active -->
> *UI Demo screenshots are marked as **TODO** until live issue validation and metadata workflows are implemented in Stage 2.*

---

## Roadmap & Contributing

Please consult:
- [docs/ROADMAP.md](docs/ROADMAP.md) for the phased 6-week roadmap.
- [CONTRIBUTING.md](CONTRIBUTING.md) for contribution rules and quality criteria.

---

## License

PatchPilot is open-source software licensed under the [MIT License](LICENSE).
