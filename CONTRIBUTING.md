# Contributing to PatchPilot

Thank you for your interest in contributing to PatchPilot! We are building an AI-assisted GitHub issue investigation and patch-verification tool with high security and reliability standards.

## Ground Rules

1. **Stage Discipline:** PatchPilot is being built following a staged roadmap (see [docs/ROADMAP.md](docs/ROADMAP.md)). Work must align with the current active stage. Features planned for future stages must not be added prematurely.
2. **Security & Sandboxing:** Never execute untrusted repository code on the host machine or in the web process. Never commit credentials, tokens, or environment secrets.
3. **Evidence-Based Changes:** Every pull request must include relevant automated tests. Never mark a check as passing without running it.

## Getting Started

### Prerequisites

- Node.js >= 20.18.2
- npm >= 10.0.0
- Git

### Local Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Quality Checks

Before submitting a pull request, run all automated checks:

```bash
npm test            # Run unit and component test suite
npm run type-check  # Verify TypeScript types
npm run lint        # Check for lint errors
npm run build       # Verify production build compiles cleanly
```

## Pull Request Guidelines

- Branch names should follow conventional format: `feat/feature-name`, `fix/bug-name`, `docs/doc-update`.
- Ensure PR descriptions clearly state the stage, motivation, changes made, and test evidence.
- Fill out the [Pull Request Template](.github/pull_request_template.md) completely.
