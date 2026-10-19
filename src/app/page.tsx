"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Terminal,
  Search,
  CheckCircle2,
  AlertTriangle,
  Github,
  ExternalLink,
  Loader2,
  XCircle,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { parseGitHubIssueUrl, ParsedGitHubIssue } from "@/lib/validation/github-issue-url";

type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ParsedGitHubIssue }
  | { status: "error"; message: string };

const EXAMPLE_URL = "https://github.com/facebook/react/issues/28000";

export default function Home() {
  const [inputUrl, setInputUrl] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const handleUseExample = () => {
    setInputUrl(EXAMPLE_URL);
    setValidationState({ status: "idle" });
  };

  const handleReset = () => {
    setInputUrl("");
    setValidationState({ status: "idle" });
  };

  const handleCopyNormalized = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures in non-secure or test contexts
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setValidationState({
        status: "error",
        message: "Please enter a GitHub issue URL to validate.",
      });
      return;
    }

    // 1. Client-side UX validation check
    const clientCheck = parseGitHubIssueUrl(trimmed);
    if (!clientCheck.success) {
      setValidationState({
        status: "error",
        message: clientCheck.error,
      });
      return;
    }

    // 2. Server-side trust validation call
    setValidationState({ status: "loading" });

    try {
      const response = await fetch("/api/validate-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.valid) {
        setValidationState({
          status: "error",
          message: json?.error || "Server validation failed. Please check the URL format.",
        });
        return;
      }

      setValidationState({
        status: "success",
        data: json.data,
      });
    } catch {
      setValidationState({
        status: "error",
        message: "Network or server connection error. Please try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              P
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              PatchPilot
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Stage 2: Issue Intake Shell
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/ABhardwaj28/PatchPilot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Safe GitHub Issue URL Validation Active
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
          Investigate issues, propose fixes, and{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            verify patches safely
          </span>
          .
        </h1>

        <p className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed">
          PatchPilot is an AI-assisted developer tool designed to investigate public GitHub issues, formulate bounded investigation plans, and verify proposed diffs in disposable isolated sandboxes.
        </p>

        {/* Primary Entry Point: Responsive Form */}
        <section
          aria-labelledby="analyze-heading"
          className="w-full mt-10 p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur text-left"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 id="analyze-heading" className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Submit GitHub Issue URL
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Example:</span>
              <button
                type="button"
                onClick={handleUseExample}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors font-mono focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
              >
                facebook/react#28000
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="issue-url-input" className="sr-only">
                GitHub Issue URL
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="issue-url-input"
                name="issueUrl"
                type="url"
                required
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (validationState.status === "error") {
                    setValidationState({ status: "idle" });
                  }
                }}
                placeholder="https://github.com/owner/repository/issues/123"
                aria-describedby="issue-url-help"
                className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent transition-all placeholder:text-slate-500"
              />
              {inputUrl.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Clear input"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              id="analyze-submit-button"
              type="submit"
              disabled={validationState.status === "loading"}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-indigo-500 shrink-0"
            >
              {validationState.status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <span>Validate Issue URL</span>
              )}
            </button>
          </form>

          <p id="issue-url-help" className="mt-2 text-xs text-slate-500">
            Accepts public HTTPS URLs in format: <code className="text-slate-400">https://github.com/&#123;owner&#125;/&#123;repo&#125;/issues/&#123;number&#125;</code>
          </p>

          {/* Validation Error State */}
          {validationState.status === "error" && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-100">Invalid GitHub Issue URL</p>
                <p className="mt-0.5 text-xs text-red-300">{validationState.message}</p>
              </div>
            </div>
          )}

          {/* Validation Success State (Explicitly Labeled as Validation Only) */}
          {validationState.status === "success" && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 p-5 rounded-xl bg-slate-950 border border-emerald-500/30 text-slate-200 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white">URL Validated Successfully</span>
                </div>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Validation Only
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block">Owner / Org</span>
                  <span className="font-mono font-medium text-slate-200">{validationState.data.owner}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block">Repository</span>
                  <span className="font-mono font-medium text-slate-200">{validationState.data.repo}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block">Issue Number</span>
                  <span className="font-mono font-medium text-indigo-400">#{validationState.data.issueNumber}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80">
                <span className="truncate mr-2">{validationState.data.normalizedUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopyNormalized(validationState.data.normalizedUrl)}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors focus:outline-none"
                  title="Copy normalized URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Stage 2 Prototype Notice:</strong> The URL format has been parsed and verified both client-side and server-side. In accordance with the staged roadmap, GitHub API intake occurs in Stage 3. Issue metadata has not been fetched yet.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Core Principles Alert */}
        <div className="w-full mt-8 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-left flex items-start gap-3 text-sm text-slate-300">
          <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Verification Boundary:</span> PatchPilot distinguishes between{" "}
            <em className="text-indigo-300 not-italic font-medium">patch proposed</em> and{" "}
            <em className="text-emerald-300 not-italic font-medium">tests passed</em>. Generated fixes are never assumed correct without isolated sandbox verification, and untrusted repository code is never run on the web server.
          </div>
        </div>

        {/* How it works */}
        <section aria-labelledby="how-it-works-heading" className="w-full mt-16 text-left">
          <h2 id="how-it-works-heading" className="text-2xl font-bold text-white mb-2">
            How PatchPilot Works
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            A controlled, human-supervised lifecycle from issue report to verified pull request.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1">1. Intake & Validation</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Validates public GitHub issue URLs and extracts structured issue metadata via GitHub API with strict rate-limiting.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1">2. Bounded Context</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Retrieves a small, relevant set of files without full repository cloning or arbitrary execution.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1">3. AI Patch Proposal</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Generates a structured unified diff using an isolated server adapter with strict schema and path traversal validation.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1">4. Isolated Verification</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Executes tests in disposable worker sandboxes with strict resource and network boundaries. Requires human review before draft PRs.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            PatchPilot &copy; 2026. Released under the MIT License.
          </div>
          <div className="flex items-center space-x-6">
            <a href="/api/health" className="hover:text-slate-400 transition-colors">
              Health Status
            </a>
            <a
              href="https://github.com/ABhardwaj28/PatchPilot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-400 transition-colors"
            >
              <span>Repository</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
