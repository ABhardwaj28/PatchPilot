# Security Policy

PatchPilot is committed to maintaining a high security standard. Because PatchPilot processes untrusted GitHub issues, repositories, and generated code, we treat security as a first-class architectural requirement.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x (Prototype) | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in PatchPilot, please report it privately rather than opening a public issue.

1. **Email:** Report findings to `apoorvabhardwaj@users.noreply.github.com` (or create a private GitHub Security Advisory).
2. **Details:** Include a detailed description of the vulnerability, reproduction steps, affected components, and potential impact.
3. **Response Time:** We aim to acknowledge reports within 48 hours and provide an estimated timeline for remediation.

## Core Security Commitments

1. **Zero Secret Exposure:** Credentials, API keys, and personal access tokens are never committed to version control, logged in output, or passed to browser bundles.
2. **Untrusted Code Execution Boundary:** Untrusted repository code and test suites must never run directly on the host or inside the web server process. Execution requires an isolated, disposable sandbox (introduced in Stage 6). Where safe isolation is unavailable, execution remains disabled.
3. **Prompt Injection & Data Sanitization:** Repository code, issue text, and model responses are treated as untrusted data. User input is never treated as control instructions.
4. **Least Privilege:** GitHub integrations and permissions request only the narrowest possible scopes.
