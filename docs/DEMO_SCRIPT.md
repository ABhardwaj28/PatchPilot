# PatchPilot: 60–90 Second Public Demo Script

This script provides a concise, step-by-step walkthrough for recording a public product demonstration or video walkthrough of PatchPilot.

---

## Video Target Duration: 75–90 Seconds
- **Resolution:** 1080p or 4K, dark mode.
- **Starting URL:** `http://localhost:3000` (or production URL).
- **Core Narrative:** Why unverified AI code generators fail in real engineering teams, and how PatchPilot provides a secure, human-in-the-loop pipeline with verified sandboxes.

---

## Scene-by-Scene Walkthrough

### Scene 1: The Problem & The Intake (0:00 – 0:20)
- **Visual:** Open PatchPilot on `http://localhost:3000`. Show the clean, dark-mode landing page.
- **Action:** Click the example button: `facebook/react#28000`. Click **Fetch Issue Details**.
- **Voiceover / Narration:**
  > *"Most AI coding tools make a dangerous assumption: that generated code is safe to execute directly on your machine or merge automatically. When you're dealing with untrusted public GitHub repositories, that's an enormous security vulnerability.*
  >
  > *This is PatchPilot: an open-source, AI-assisted GitHub issue investigation and patch verification tool built around a strict security boundary."*

---

### Scene 2: Bounded Context Collection (0:20 – 0:35)
- **Visual:** Issue metadata loads. Click **Investigate Issue**. Show the Bounded Context card loading. Expand one of the discovered files to show the explanation tags.
- **Action:** Point cursor to the explainability tag (`"Explicitly mentioned in issue text"`) and the byte limits (`"Context bounds: 5 files max, 30 KB per file"`).
- **Voiceover / Narration:**
  > *"Instead of cloning entire repositories or blowing through context windows, PatchPilot gathers a bounded, read-only slice of the codebase using explainable relevance scoring. No code execution on the web host, and lockfiles or secrets are automatically excluded."*

---

### Scene 3: AI Patch Proposal & Diff Review (0:35 – 0:50)
- **Visual:** Click **Generate Proposed Patch**. Show the Unified Diff Viewer appearing.
- **Action:** Highlight the orange banner: `"Status: Proposed — not executed or verified"`. Show the risk level (`LOW`), the explanation card, and the syntax-colored additions and deletions.
- **Voiceover / Narration:**
  > *"Next, our decoupled LLM adapter formulates a minimal unified diff. Every proposal is strictly validated against path traversal attacks and labeled honestly: 'Proposed — not executed or verified'. AI proposals are hypotheses, not proven solutions."*

---

### Scene 4: Isolated Sandbox Verification (0:50 – 1:10)
- **Visual:** Scroll to the **Stage 6: Isolated Patch Verification Worker** section.
- **Action:** Demonstrate typing an invalid command like `npm test; rm -rf /` to show the instant red security rejection banner. Then click the preset `Vitest (npx vitest run)` and click **Run Isolated Verification**.
- **Action:** The spinner appears. In ~1.5s, the banner updates to a green **`PASSED`** status with duration, exit code 0, terminal logs, and the Sandbox Isolation checklist (Network: None, Non-Root UID 1000, 512MB RAM cap).
- **Voiceover / Narration:**
  > *"To test the patch, PatchPilot dispatches the job to an ephemeral, network-isolated worker sandbox. Arbitrary shell commands and chaining are blocked by a strict allowlist. Non-root user, no network access, zero credentials mounted. We truthfully report whether tests passed or failed."*

---

### Scene 5: Human-Gated Draft PR & Conclusion (1:10 – 1:30)
- **Visual:** Scroll to the **Stage 7: Human-Gated Draft Pull Request** section.
- **Action:** Show the disabled **Submit Approved Draft PR** button. Check both required checkboxes:
  1. *Reviewed proposed patch diff.*
  2. *Understand draft-only, no-auto-merge policy.*
- **Action:** Click **Submit Approved Draft PR**. The card transitions to a success state displaying the draft PR link (`Draft #28100`), dedicated branch chip (`patchpilot/fix-issue-...`), and formatted PR markdown body.
- **Voiceover / Narration:**
  > *"Finally, PatchPilot enforces an affirmative human confirmation gate. We will never merge automatically. Only after a human engineer reviews the diff and approves it, PatchPilot opens a Draft PR on a dedicated branch for peer review.*
  >
  > *PatchPilot is 100% open source under the MIT License. Check out the repository, roadmap, and architecture on GitHub!"*
