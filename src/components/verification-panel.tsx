"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  WifiOff,
  UserCheck,
} from "lucide-react";
import { PatchProposal } from "@/lib/llm/types";
import { VerificationResult, VerificationStatus } from "@/lib/verification/types";
import {
  validateVerificationCommand,
  ALLOWLISTED_PRESETS,
} from "@/lib/verification/command-allowlist";

interface VerificationPanelProps {
  proposal: PatchProposal;
  owner: string;
  repo: string;
  onVerificationComplete?: (result: VerificationResult) => void;
}

export function VerificationPanel({ proposal, owner, repo, onVerificationComplete }: VerificationPanelProps) {
  const [command, setCommand] = useState<string>("npx vitest run");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commandValidation = validateVerificationCommand(command);

  const handleRunVerification = async () => {
    if (!commandValidation.isValid) {
      setError(commandValidation.reason || "Invalid command.");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/verify-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          targetPath: proposal.targetPath,
          unifiedDiff: proposal.unifiedDiff,
          command,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute patch verification.");
      }

      setResult(data.result);
      onVerificationComplete?.(data.result);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "An unexpected error occurred during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case "passed":
        return {
          bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          label: "PASSED",
        };
      case "failed":
        return {
          bg: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          label: "FAILED",
        };
      case "timed_out":
        return {
          bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          label: "TIMED OUT",
        };
      case "rejected":
        return {
          bg: "bg-rose-950/40 text-rose-300 border-rose-500/40",
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
          label: "REJECTED (POLICY)",
        };
      default:
        return {
          bg: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <Terminal className="w-4 h-4 text-slate-400" />,
          label: status.toUpperCase(),
        };
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Stage 6
            </span>
            <h3 className="text-base font-semibold text-white">
              Isolated Patch Verification Worker
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Run regression test suites against this proposed patch inside an isolated sandbox with zero host privileges.
          </p>
        </div>

        {/* Security badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
            <WifiOff className="w-3 h-3 text-emerald-400" />
            <span>Network: None</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
            <UserCheck className="w-3 h-3 text-indigo-400" />
            <span>Non-Root (UID 1000)</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/80">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>60s Limit</span>
          </span>
        </div>
      </div>

      {/* Command Configurator */}
      <div className="space-y-3">
        <label htmlFor="test-command-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Verification Test Command
        </label>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 mr-1 font-medium">Presets:</span>
          {ALLOWLISTED_PRESETS.map((preset) => (
            <button
              key={preset.command}
              type="button"
              onClick={() => {
                setCommand(preset.command);
                setError(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                command === preset.command
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                  : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700/70"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Command Input & Execution Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
              &gt;
            </div>
            <input
              id="test-command-input"
              type="text"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setError(null);
              }}
              placeholder="e.g. npm test or npx vitest run"
              disabled={isVerifying}
              className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handleRunVerification}
            disabled={isVerifying || !commandValidation.isValid}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Running in Sandbox...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>Run Isolated Verification</span>
              </>
            )}
          </button>
        </div>

        {/* Command validation error */}
        {!commandValidation.isValid && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{commandValidation.reason}</span>
          </div>
        )}
      </div>

      {/* General execution error */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Execution Results View */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Status banner */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const badge = getStatusBadge(result.status);
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  );
                })()}

                <span className="text-xs text-slate-400 font-mono">
                  Job ID: {result.jobId}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{result.durationMs}ms</span>
                </span>
                <span className="flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  <span>Exit: {result.exitCode !== null ? result.exitCode : "None"}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-indigo-300 border border-slate-700">
                  {result.sandboxType}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {result.explanation}
            </p>
          </div>

          {/* Console Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>Sandbox Execution Log</span>
              </span>

              {result.isTruncated && (
                <span className="text-[11px] text-amber-400 font-mono">
                  Output truncated to 32 KB limit
                </span>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-300 overflow-x-auto max-h-72 shadow-inner">
              <pre className="whitespace-pre-wrap">
                {result.stdoutExcerpt || "(No stdout output)"}
              </pre>
              {result.stderrExcerpt && (
                <pre className="mt-3 text-rose-400 border-t border-slate-800/80 pt-2 whitespace-pre-wrap">
                  {result.stderrExcerpt}
                </pre>
              )}
            </div>
          </div>

          {/* Sandbox Security Audit Grid */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-xs space-y-2">
            <h5 className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sandbox Isolation Audit & Enforcement</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-slate-400">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-[10px] text-slate-500 uppercase">Network</div>
                <div className="font-semibold text-emerald-400">Isolated (None)</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-[10px] text-slate-500 uppercase">Privileges</div>
                <div className="font-semibold text-indigo-300">Non-Root (1000)</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-[10px] text-slate-500 uppercase">Host Secrets</div>
                <div className="font-semibold text-emerald-400">Zero Mounted</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <div className="text-[10px] text-slate-500 uppercase">Resource Caps</div>
                <div className="font-semibold text-slate-200">512MB / 1.0 vCPU</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
