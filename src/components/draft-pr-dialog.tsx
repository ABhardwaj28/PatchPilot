"use client";

import React, { useState } from "react";
import {
  GitPullRequest,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  GitBranch,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import { PatchProposal } from "@/lib/llm/types";
import { VerificationResult } from "@/lib/verification/types";
import { DraftPRResult } from "@/lib/pr/types";
import { generateSafeBranchName, isSafeBranchName } from "@/lib/pr/branch-helper";

interface DraftPRSectionProps {
  proposal: PatchProposal;
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  verificationResult?: VerificationResult | null;
}

export function DraftPRSection({
  proposal,
  owner,
  repo,
  issueNumber,
  issueTitle,
  verificationResult,
}: DraftPRSectionProps) {
  const defaultBranch = generateSafeBranchName(issueNumber);
  const [branchName, setBranchName] = useState<string>(defaultBranch);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmDraftPolicy, setConfirmDraftPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DraftPRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedBranch, setCopiedBranch] = useState(false);

  const isBranchValid = isSafeBranchName(branchName);
  const canSubmit = confirmReviewed && confirmDraftPolicy && isBranchValid && !isSubmitting;

  const handleCreateDraftPR = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/create-draft-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          issueNumber,
          issueTitle,
          targetPath: proposal.targetPath,
          unifiedDiff: proposal.unifiedDiff,
          verificationStatus: verificationResult?.status || "unverified",
          branchName,
          userConfirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create draft pull request.");
      }

      setResult(data.draftPR);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "An unexpected error occurred during draft PR generation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBranch = async () => {
    if (result?.branchName) {
      await navigator.clipboard.writeText(result.branchName);
      setCopiedBranch(true);
      setTimeout(() => setCopiedBranch(false), 2000);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Stage 7
            </span>
            <h3 className="text-base font-semibold text-white">
              Human-Gated Draft Pull Request
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create an isolated draft pull request on a dedicated branch. Automated merging is disabled by security policy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Human Review Gate</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <span>Draft Only</span>
          </span>
        </div>
      </div>

      {/* Safety Policy Notice */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <ShieldAlert className="w-4 h-4 text-indigo-400" />
          <span>Governance & Branch Protection Rule</span>
        </div>
        <p className="text-slate-400 leading-relaxed pl-6">
          PatchPilot opens PRs strictly in <strong>Draft status</strong> on a dedicated feature branch. Direct pushes to <code className="text-indigo-300">main</code>, <code className="text-indigo-300">master</code>, or protected branches are blocked.
        </p>
      </div>

      {/* If PR already created, show result view */}
      {result ? (
        <div className="space-y-4 pt-2">
          <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-300 text-sm">
                  Draft Pull Request Created (Draft #{result.prNumber})
                </span>
                {result.isMock && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Mock Mode
                  </span>
                )}
              </div>

              <a
                href={result.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dedicated Branch:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <code className="text-indigo-300 font-mono text-[11px]">{result.branchName}</code>
                  <button
                    onClick={handleCopyBranch}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                    title="Copy branch name"
                  >
                    {copiedBranch ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Base Branch:</span>
                </span>
                <code className="text-slate-200 font-mono text-[11px]">{result.baseBranch}</code>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Generated Draft PR Description
              </span>
              <div className="p-3.5 rounded-lg bg-slate-950 font-mono text-xs leading-relaxed text-slate-300 border border-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {result.body}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Configuration & Human Confirmation Form */
        <div className="space-y-5">
          {/* Branch Name Input */}
          <div className="space-y-2">
            <label htmlFor="pr-branch-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Dedicated Branch Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
                <GitBranch className="w-4 h-4 text-slate-500" />
              </div>
              <input
                id="pr-branch-input"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="patchpilot/fix-issue-..."
                disabled={isSubmitting}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
              />
            </div>
            {!isBranchValid && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Branch name is invalid or targets a protected branch (main, master, prod, release).</span>
              </p>
            )}
          </div>

          {/* Verification Status Context */}
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs flex items-center justify-between">
            <span className="text-slate-400">Attached Verification Status:</span>
            <span
              className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                verificationResult?.status === "passed"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
              }`}
            >
              {verificationResult?.status || "Unverified (Stage 6 Not Run)"}
            </span>
          </div>

          {/* Mandatory Human Review Checkboxes */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="block text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Human Review Gates (Required)
            </span>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={confirmReviewed}
                onChange={(e) => setConfirmReviewed(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
              />
              <span>
                I have reviewed the proposed patch diff and confirmed it does not introduce obvious logic or security flaws.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={confirmDraftPolicy}
                onChange={(e) => setConfirmDraftPolicy(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 cursor-pointer"
              />
              <span>
                I understand that PatchPilot will open a <strong>Draft Pull Request</strong> on a separate branch and will <strong>never merge automatically</strong>.
              </span>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleCreateDraftPR}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting Draft PR...</span>
                </>
              ) : (
                <>
                  <GitPullRequest className="w-4 h-4 text-white" />
                  <span>Submit Approved Draft PR</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
