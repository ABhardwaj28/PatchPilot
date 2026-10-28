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
| **SEC-004** | Prompt injection delimitation in LLM adapter | Stage 5 | :white_check_mark: **IMPLEMENTED** |
| **SEC-005** | Strict Zod schema & unified diff path validation | Stage 5 | :white_check_mark: **IMPLEMENTED** |
| **SEC-006** | Ephemeral, isolated test worker container | Stage 6 | :calendar: **PLANNED** (Design In Review) |
| **SEC-007** | Network-disabled test execution sandbox | Stage 6 | :calendar: **PLANNED** (Design In Review) |
| **SEC-008** | Secret redaction in logs and user-facing errors | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-009** | Server-side rate limiting on API endpoints | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-010** | Explicit human approval gate for draft PRs | Stage 7 | **NOT IMPLEMENTED** |
| **SEC-011** | Automated CI pipeline with secret scanning | Stage 8 | **NOT IMPLEMENTED** |

---

## 6. Stage 6 Verification Worker: Threat Model & Sandbox Analysis

Prior to implementing live test verification in Stage 6, this threat model assesses the attack surface of executing untrusted repository test suites and specifies required sandbox isolation controls.

### 6.1 Attack Vectors When Executing Untrusted Repositories
1. **Malicious Dependency Lifecycle Scripts:** `npm test` or `pytest` can execute arbitrary native code via `pretest`, `install`, or `setup.py` hooks.
2. **Container Escapes (Kernel Exploits):** Standard Linux containers share the host kernel. Known CVEs (e.g., Dirty COW, runc escapes) allow breakout if user namespaces and seccomp profiles are insufficient.
3. **SSRF & Network Exfiltration:** Untrusted code may probe cloud metadata services (`169.254.169.254`), access internal services, or exfiltrate environment tokens over outbound HTTP/DNS.
4. **Denial of Service (DoS):** Uncontrolled fork bombs, infinite loops, memory bloat, or disk filling attacks aimed at host starvation.
5. **Symlink & Path Traversal Attacks:** Malicious patch diffs containing symlinks pointing outside the temporary workspace (e.g. `../../etc/passwd`).

### 6.2 Sandbox Isolation Technology Comparison

| Sandbox Technology | Isolation Boundary | Startup Overhead | Production Adequacy for Untrusted Code |
| :--- | :--- | :--- | :--- |
| **Standard Docker (`runc`)** | Shared host Linux kernel, namespaces, cgroups | ~500ms | **Insufficient alone.** A single kernel 0-day or root daemon misconfiguration compromises host. |
| **gVisor (`runsc`) / Kata** | User-space application kernel intercepting syscalls | ~800ms | **Strong.** Greatly reduces kernel attack surface; suitable for shared-host sandboxing. |
| **MicroVMs (Firecracker / Fly)** | Hardware-assisted KVM virtualization per job | ~100–300ms | **Industry Gold Standard.** Hardware boundary separates guest kernel from host. |
| **Managed Execution (E2B / Modal)** | Ephemeral microVMs managed via API | ~1–2s | **Strong & Turnkey.** Eliminates host container daemon maintenance. |

> **Conclusion for PatchPilot:** For production deployments, standard Docker without gVisor or microVM virtualization is **insufficient**. In local development where hardware virtualization is unavailable, PatchPilot adopts a **safe-by-default fallback**: a typed verification worker interface and deterministic mock runner with live host execution disabled.

### 6.3 Worker Architecture & Security Guarantees
1. **Process Separation:** Worker runs as an independent service or queue consumer; never inside the Next.js web application process.
2. **Strict Job Payload Contract:** Jobs are strictly typed via Zod schema (`jobId`, `repo`, `commitSha`, `patchDiff`, `command`, `timeoutMs`, `resourceLimits`).
3. **Allowlisted Test Commands Only:** Arbitrary shell strings (`sh -c ...`, chaining with `&&`, `;`, `|`, `` ` ``) are rejected. Only explicit allowlisted commands mapped to verified project types (e.g. `npm test`, `vitest run`, `pytest`) are executed.
4. **Disposable Ephemeral Workspaces:** Created in temporary memory-backed filesystems (`tmpfs`), wiped immediately after execution completes.
5. **Zero Credentials Mounted:** Host home directory, `.env` files, Docker socket (`/var/run/docker.sock`), SSH keys, and cloud credentials are never mounted.
6. **Network Isolation:** Sandbox runs with network disabled (`--network none`) by default during test execution.
7. **Resource & Time Limits:**
   - Wall-clock timeout: 60s max.
   - Memory limit: 512 MB.
   - CPU quota: 1.0 vCPU.
   - Max PIDs: 64 processes.
   - Max output buffer: 32 KB (truncated with explicit notice).
8. **Truthful Job Lifecycle:** States include `queued`, `running`, `passed`, `failed`, `timed_out`, `rejected`, and `internal_error`. A failed test run is never reported as passed.
