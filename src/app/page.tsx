"use client";

import React from "react";
import {
  ShieldAlert,
  Terminal,
  Search,
  CheckCircle2,
  AlertTriangle,
  Github,
  ExternalLink,
} from "lucide-react";

export default function Home() {
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Early Prototype (Stage 1)
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
          Foundation & Public Repository Active
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

        {/* Primary Entry Point (Stage 2 Placeholder) */}
        <section
          aria-labelledby="analyze-heading"
          className="w-full mt-10 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur"
        >
          <h2 id="analyze-heading" className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-left">
            Analyze a GitHub Issue
          </h2>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="issue-url-input"
                type="url"
                disabled
                aria-disabled="true"
                placeholder="https://github.com/owner/repository/issues/123"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-sm focus:outline-none cursor-not-allowed"
              />
            </div>
            <button
              id="analyze-submit-button"
              type="button"
              disabled
              aria-disabled="true"
              className="px-6 py-3 bg-indigo-600/50 text-indigo-200 text-sm font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Analyze Issue</span>
            </button>
          </form>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Input parsing and validation active in Stage 2</span>
            <span className="font-mono text-slate-400">Status: Form Shell Only</span>
          </div>
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
