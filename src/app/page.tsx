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
  Star,
  GitFork,
  MessageSquare,
  Calendar,
  User,
  ShieldCheck,
  Info,
  FileCode,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";
import { parseGitHubIssueUrl } from "@/lib/validation/github-issue-url";
import {
  GitHubIssueMetadata,
  GitHubRateLimitInfo,
  InvestigationReport,
} from "@/lib/github/types";

type IntakeState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | {
      status: "success";
      issue: GitHubIssueMetadata;
      rateLimit?: GitHubRateLimitInfo;
    }
  | {
      status: "error";
      message: string;
      code?: string;
      rateLimit?: GitHubRateLimitInfo;
    };

type InvestigationState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      report: InvestigationReport;
    }
  | {
      status: "error";
      message: string;
    };


const EXAMPLE_URL = "https://github.com/facebook/react/issues/28000";

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState("");
  const [intakeState, setIntakeState] = useState<IntakeState>({ status: "idle" });
  const [investigationState, setInvestigationState] = useState<InvestigationState>({ status: "idle" });
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleUseExample = () => {
    setInputUrl(EXAMPLE_URL);
    setIntakeState({ status: "idle" });
    setInvestigationState({ status: "idle" });
    setExpandedFileIndex(null);
  };

  const handleReset = () => {
    setInputUrl("");
    setIntakeState({ status: "idle" });
    setInvestigationState({ status: "idle" });
    setExpandedFileIndex(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures in non-secure or test contexts
    }
  };

  const handleGenerateInvestigation = async () => {
    const targetUrl =
      inputUrl.trim() ||
      (intakeState.status === "success" ? intakeState.issue.htmlUrl : "");
    if (!targetUrl) return;

    setInvestigationState({ status: "loading" });

    try {
      const response = await fetch("/api/investigate-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        setInvestigationState({
          status: "error",
          message:
            json?.error ||
            "Failed to generate investigation plan. Please verify the repository tree and try again.",
        });
        return;
      }

      setInvestigationState({
        status: "success",
        report: json.data,
      });
      setExpandedFileIndex(0);
    } catch {
      setInvestigationState({
        status: "error",
        message:
          "Network or server connection error occurred while gathering repository context.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = inputUrl.trim();
    if (!trimmed) {
      setIntakeState({
        status: "error",
        message: "Please enter a GitHub issue URL to analyze.",
      });
      return;
    }

    setInvestigationState({ status: "idle" });
    setExpandedFileIndex(null);

    // 1. Client-side UX validation check
    const clientCheck = parseGitHubIssueUrl(trimmed);
    if (!clientCheck.success) {
      setIntakeState({
        status: "error",
        message: clientCheck.error,
      });
      return;
    }

    // 2. Server-side GitHub API intake call
    setIntakeState({
      status: "loading",
      message: "Fetching public issue & repository metadata from GitHub API...",
    });

    try {
      const response = await fetch("/api/issue-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        setIntakeState({
          status: "error",
          message:
            json?.error ||
            "Failed to retrieve issue metadata from GitHub. Please verify the URL and try again.",
          code: json?.code,
          rateLimit: json?.rateLimit,
        });
        return;
      }

      setIntakeState({
        status: "success",
        issue: json.data,
        rateLimit: json.rateLimit,
      });
    } catch {
      setIntakeState({
        status: "error",
        message:
          "Network or server connection error occurred. Could not reach PatchPilot server.",
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
              Stage 4: Bounded Context Active
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
          Server-Side GitHub API Integration Active
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
                  if (intakeState.status === "error") {
                    setIntakeState({ status: "idle" });
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
              disabled={intakeState.status === "loading"}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-indigo-500 shrink-0"
            >
              {intakeState.status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching Metadata...</span>
                </>
              ) : (
                <span>Fetch Issue Metadata</span>
              )}
            </button>
          </form>

          <p id="issue-url-help" className="mt-2 text-xs text-slate-500">
            Accepts public HTTPS URLs in format: <code className="text-slate-400">https://github.com/&#123;owner&#125;/&#123;repo&#125;/issues/&#123;number&#125;</code>
          </p>

          {/* Error Alert State */}
          {intakeState.status === "error" && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-100">Unable to Fetch Issue Metadata</p>
                <p className="mt-0.5 text-xs text-red-300">{intakeState.message}</p>
                {intakeState.rateLimit && (
                  <p className="mt-2 text-xs text-red-400/80">
                    GitHub Rate Limit: {intakeState.rateLimit.remaining}/{intakeState.rateLimit.limit} remaining.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success State: Comprehensive Issue Card */}
          {intakeState.status === "success" && (
            <div
              role="region"
              aria-label="GitHub Issue Metadata Result"
              className="mt-6 p-6 rounded-xl bg-slate-950 border border-indigo-500/30 text-slate-200 text-sm animate-in fade-in slide-in-from-top-1 duration-200 shadow-2xl"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        intakeState.issue.state === "open"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                      }`}
                    >
                      {intakeState.issue.state === "open" ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {intakeState.issue.state.toUpperCase()}
                    </span>

                    <span className="text-xs font-mono text-indigo-400 font-semibold">
                      #{intakeState.issue.issueNumber}
                    </span>

                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 font-medium">
                      {intakeState.issue.repository.fullName}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                    {intakeState.issue.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(intakeState.issue.htmlUrl)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Copy issue URL"
                    aria-label="Copy issue URL"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <a
                    href={intakeState.issue.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Repository & Issue Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-4 text-left">
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Author</span>
                  </div>
                  <span className="font-mono text-xs font-medium text-slate-200 truncate block">
                    @{intakeState.issue.author.login}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Opened</span>
                  </div>
                  <span className="text-xs font-medium text-slate-200 block">
                    {formatDate(intakeState.issue.createdAt)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span>Repo Stars</span>
                  </div>
                  <span className="text-xs font-medium text-slate-200 block">
                    {intakeState.issue.repository.starsCount.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Forks</span>
                  </div>
                  <span className="text-xs font-medium text-slate-200 block">
                    {intakeState.issue.repository.forksCount.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Comments</span>
                  </div>
                  <span className="text-xs font-medium text-slate-200 block">
                    {intakeState.issue.commentsCount}
                  </span>
                </div>
              </div>

              {/* Labels */}
              {intakeState.issue.labels.length > 0 && (
                <div className="text-left mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Labels
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {intakeState.issue.labels.map((label) => (
                      <span
                        key={String(label.id)}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-900 border border-slate-700/80 text-slate-200"
                      >
                        <span
                          className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                          style={{ backgroundColor: `#${label.color}` }}
                        />
                        {label.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Safe Issue Description Excerpt (Rendered purely as safe text, no HTML execution) */}
              <div className="text-left mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Issue Description Excerpt
                </span>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto leading-relaxed selection:bg-indigo-700">
                  {intakeState.issue.bodyExcerpt || "(No description provided in issue body)"}
                </div>
              </div>

              {/* Rate Limit Telemetry */}
              {intakeState.rateLimit && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>GitHub API Rate Limit:</span>
                  </div>
                  <span className="font-mono">
                    <strong className={intakeState.rateLimit.isLow ? "text-amber-400" : "text-emerald-400"}>
                      {intakeState.rateLimit.remaining}
                    </strong>{" "}
                    / {intakeState.rateLimit.limit} remaining
                  </span>
                </div>
              )}

              {/* Data and Privacy Notice */}
              <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 text-left flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-200">Data & Privacy Notice:</strong> This public issue was fetched directly via GitHub REST API. No issue or code data is stored permanently on disk or database. No user tokens are sent to client bundles, and no issue data is sent to external AI providers in Stage 4.
                </div>
              </div>

              {/* Stage 4: Bounded Repository Investigation Plan Section */}
              <div className="mt-6 pt-6 border-t border-slate-800 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FolderTree className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        Stage 4: Bounded Repository Context & Investigation Plan
                      </h4>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Scans repository tree, ranks relevant files deterministically, and bounds context (max 5 files, 100 KB total) without executing untrusted code.
                    </p>
                  </div>

                  {investigationState.status !== "loading" && (
                    <button
                      type="button"
                      id="generate-investigation-button"
                      onClick={handleGenerateInvestigation}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{investigationState.status === "success" ? "Refresh Investigation" : "Generate Investigation Plan"}</span>
                    </button>
                  )}
                </div>

                {/* Loading State */}
                {investigationState.status === "loading" && (
                  <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-200">
                      Gathering bounded repository context...
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Retrieving git tree, applying heuristic ranking, and decoding bounded source files.
                    </p>
                  </div>
                )}

                {/* Error State */}
                {investigationState.status === "error" && (
                  <div role="alert" className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-start gap-3">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-100">Investigation Plan Error</p>
                      <p className="mt-0.5 text-red-300">{investigationState.message}</p>
                    </div>
                  </div>
                )}

                {/* Success State: Detailed Investigation Plan */}
                {investigationState.status === "success" && (
                  <div className="space-y-4">
                    {/* Hypothesis Disclaimer Banner */}
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-amber-300">Hypothesis Only: Unverified by Execution</span>
                        <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                          {investigationState.report.disclaimer}
                        </p>
                      </div>
                    </div>

                    {/* Telemetry / Bounds row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Scanned Tree Items</span>
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {investigationState.report.totalScannedFiles} entries
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Selected Files</span>
                        <span className="font-mono text-xs font-bold text-indigo-400">
                          {investigationState.report.selectedFiles.length} / {investigationState.report.limits.maxFiles} max
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Bounded Context Size</span>
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {(investigationState.report.totalContextBytes / 1024).toFixed(1)} KB / {(investigationState.report.limits.maxTotalBytes / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Execution Sandbox</span>
                        <span className="font-mono text-xs font-bold text-slate-400">
                          Disabled (Read-Only)
                        </span>
                      </div>
                    </div>

                    {/* Likely Affected Areas */}
                    {investigationState.report.likelyAffectedAreas.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                          Likely Affected Module Areas
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {investigationState.report.likelyAffectedAreas.map((area) => (
                            <span
                              key={area}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-indigo-950/40 border border-indigo-500/30 text-indigo-300"
                            >
                              <Layers className="w-3 h-3 mr-1 text-indigo-400" />
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Files Accordion / Viewer */}
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Selected Relevant Files (Ranked with Selection Reasons)
                      </span>

                      <div className="space-y-2">
                        {investigationState.report.selectedFiles.map((file, idx) => {
                          const isExpanded = expandedFileIndex === idx;
                          return (
                            <div
                              key={file.path}
                              className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedFileIndex(isExpanded ? null : idx)}
                                className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors focus:outline-none"
                                aria-expanded={isExpanded}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                  )}
                                  <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                                  <span className="font-mono text-xs font-medium text-slate-200 truncate">
                                    {file.path}
                                  </span>
                                  {file.isTruncated && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Truncated
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {(file.sizeBytes / 1024).toFixed(1)} KB
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                    Score: {file.relevanceScore}
                                  </span>
                                </div>
                              </button>

                              {/* Selection Reasons */}
                              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                                {file.selectionReasons.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800"
                                  >
                                    • {reason}
                                  </span>
                                ))}
                              </div>

                              {/* File Content Preview */}
                              {isExpanded && (
                                <div className="border-t border-slate-800 p-3 bg-slate-950">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-mono text-slate-400">
                                      Bounded Preview ({file.content.split("\n").length} lines)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(file.content)}
                                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Content</span>
                                    </button>
                                  </div>
                                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed selection:bg-indigo-700">
                                    <code>{file.content}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Missing Context / Limitations List */}
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Context Limitations & Exclusions
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                        {investigationState.report.missingContext.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Proposed Next Steps */}
                    <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
                      <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider block mb-1.5">
                        Proposed Investigation Next Steps (Hypothesis)
                      </span>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-indigo-200/90">
                        {investigationState.report.proposedNextSteps.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
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
