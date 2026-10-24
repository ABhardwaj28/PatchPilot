"use client";

import React, { useState } from "react";
import { Copy, Check, Download, ShieldAlert, FileCode, Sparkles } from "lucide-react";
import { PatchProposal } from "@/lib/llm/types";

interface DiffViewerProps {
  proposal: PatchProposal;
  issueNumber: number;
}

export function DiffViewer({ proposal, issueNumber }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(proposal.unifiedDiff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([proposal.unifiedDiff], { type: "text/x-diff;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patchpilot-issue-${issueNumber}.patch`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "high":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  // Split lines for readable diff rendering
  const diffLines = proposal.unifiedDiff.split(/\r?\n/);

  return (
    <div className="mt-8 space-y-6">
      {/* Explicit Unverified Warning Banner (Mandatory Security Policy) */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-300">Status: Proposed — not executed or verified</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-400/20 text-amber-200 border border-amber-400/30">
                Unverified Patch
              </span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              This code diff was formulated as a candidate solution by an AI model. It has <strong>NOT</strong> been executed, compiled, or tested against regression suites. Execution remains disabled until isolated sandbox verification is active.
            </p>
          </div>
        </div>
      </div>

      {/* Proposal Summary Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-medium text-slate-200">Target File:</span>
            <code className="rounded bg-slate-800 px-2.5 py-1 text-xs font-mono text-indigo-300">
              {proposal.targetPath}
            </code>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskBadge(proposal.estimatedRisk)}`}>
              Risk: {proposal.estimatedRisk.toUpperCase()}
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
              <Sparkles className="h-3 w-3" />
              {proposal.isMock ? `Mock Provider (${proposal.model})` : `Provider: ${proposal.provider} (${proposal.model})`}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Rationale & Explanation
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3.5 rounded-lg border border-slate-800/60">
            {proposal.explanation}
          </p>
        </div>

        {/* Diff Actions Header */}
        <div className="flex items-center justify-between pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Unified Diff Preview
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
              title="Copy unified diff to clipboard"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
              {copied ? "Copied" : "Copy Diff"}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
              title="Download patch file"
            >
              <Download className="h-3.5 w-3.5" />
              Download .patch
            </button>
          </div>
        </div>

        {/* Code Diff Display */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs overflow-x-auto p-4 leading-5 shadow-inner">
          {diffLines.map((line, idx) => {
            let lineClass = "text-slate-300";
            if (line.startsWith("+") && !line.startsWith("+++")) {
              lineClass = "text-emerald-400 bg-emerald-950/40 font-medium";
            } else if (line.startsWith("-") && !line.startsWith("---")) {
              lineClass = "text-rose-400 bg-rose-950/40 font-medium";
            } else if (line.startsWith("@@")) {
              lineClass = "text-indigo-400 bg-indigo-950/30 font-medium";
            } else if (line.startsWith("---") || line.startsWith("+++")) {
              lineClass = "text-slate-500 font-semibold";
            }

            return (
              <div key={idx} className={`px-2 py-0.5 rounded-sm whitespace-pre ${lineClass}`}>
                {line || " "}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
