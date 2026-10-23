# PatchPilot: Security Model & Threat Boundaries

This document defines the security architecture, trust boundaries, threat mitigations, and implementation status for PatchPilot.

---

## 1. Trust Boundaries

```
[ Untrusted Web User / Browser ]
             │ (HTTP Request: URL string only)
             ▼
┌────────────────────────────────────────────────────────┐
│ Boundary 1: Next.js Web Application (Trusted)          │
│ - Strict Zod URL & payload parsing                     │
│ - Rate limiting & timeout enforcement                  │
│ - Secret storage in server-only environment variables  │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
             │ (Server-Side HTTPS)         │ (Server-Side HTTPS)
             ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│ External: GitHub REST API │ │ External: LLM Provider    │
│ [Untrusted Content]       │ │ [Untrusted Content]       │
│ - Issues, comments, files │ │ - Patch suggestions       │
└───────────────────────────┘ └───────────────────────────┘
             │
             ▼ (Job Payload: bounded files + patch only)
┌────────────────────────────────────────────────────────┐
│ Boundary 2: Isolated Test Worker Sandbox               │
│ - Ephemeral container/microVM (Disposable)             │
│ - Non-root, no host mounts, no credentials             │
│ - Network disabled by default, strict resource quotas   │
└────────────────────────────────────────────────────────┘
```

### Untrusted Inputs
The following data sources are classified as **untrusted data** and must never be interpreted as execution instructions:
1. **GitHub Issue URLs:** May attempt SSRF, directory traversal, or protocol smuggling.
2. **Issue Titles & Descriptions:** May contain prompt injection attempts or malicious payload strings.
3. **Repository Files & Trees:** Repository code must never run in the web application process or on the developer's host.
4. **LLM Model Responses:** May attempt path traversal, inject malicious code into diffs, or hallucinate dangerous dependencies.

---

## 2. Secrets Management & Credential Safety

* **Storage:** Secrets (`GITHUB_TOKEN`, `LLM_API_KEY`) must exist solely in `.env.local` or environment variables on the server.
* **Client Isolation:** Never prefix secret environment variables with `NEXT_PUBLIC_`. No secrets in client bundles.
* **Logs & Error Handling:** Application logs and error responses presented to the user must redact tokens, keys, and authorization headers.
* **Version Control:** `.env.local` and `.env*.local` are strictly excluded in `.gitignore`. `.env.example` contains placeholders only.

---

## 3. GitHub Permissions & Least Privilege

* **MVP (Stages 1–6):** Operates on public repositories using unauthenticated or read-only public access tokens (`public_repo` read access).
* **Draft PR Feature (Stage 7):** Requires explicit user authorization per action.
  * Permissions strictly limited to: `contents: write` (on dedicated patch branches only) and `pull_requests: write` (for draft creation).
  * **Forbidden:** Automatic merging, modifying existing main/default branches, or requesting administrative repo permissions.

---

## 4. Execution Sandbox Isolation Requirements

Untrusted test execution (Stage 6) requires strict sandboxing:
* **Ephemeral Workspaces:** Disposable containers destroyed immediately after job completion.
* **Non-Root Execution:** User inside container mapped to an unprivileged UID/GID with capabilities dropped (`cap-drop=ALL`).
* **Filesystem:** Read-only root filesystem where feasible, with a size-limited temporary `tmpfs` for repo workspace.
* **Network Isolation:** Network disabled (`--network none`) during test runs by default to prevent data exfiltration.
* **Resource Limits:** Hard limits on memory (e.g., 512MB), CPU quota (e.g., 1 CPU), maximum processes (pids limit), and execution wall-clock timeout (e.g., 60 seconds).
* **No Host Sockets or Mounts:** Absolute ban on mounting `/var/run/docker.sock`, `/home`, SSH keys, or environment files into the container.

---

## 5. Security Controls Implementation Matrix

| Control ID | Description | Target Stage | Status |
| :--- | :--- | :--- | :--- |
| **SEC-001** | Strict GitHub issue URL format validation | Stage 2 | :white_check_mark: **IMPLEMENTED** |
| **SEC-002** | Server-side only GitHub API calls with timeouts | Stage 3 | :white_check_mark: **IMPLEMENTED** |
| **SEC-003** | Bounded repo file retrieval (count/byte limits, secret & binary exclusion) | Stage 4 | :white_check_mark: **IMPLEMENTED** |
| **SEC-004** | Prompt injection delimitation in LLM adapter | Stage 5 | **NOT IMPLEMENTED** |
| **SEC-005** | Strict Zod schema & unified diff path validation | Stage 5 | **NOT IMPLEMENTED** |
| **SEC-006** | Ephemeral, isolated test worker container | Stage 6 | **NOT IMPLEMENTED** |
| **SEC-007** | Network-disabled test execution sandbox | Stage 6 | **NOT IMPLEMENTED** |
| **SEC-008** | Secret redaction in logs and user-facing errors | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-009** | Server-side rate limiting on API endpoints | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-010** | Explicit human approval gate for draft PRs | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-011** | Automated CI pipeline with secret scanning | Stage 8 | **NOT IMPLEMENTED** |
