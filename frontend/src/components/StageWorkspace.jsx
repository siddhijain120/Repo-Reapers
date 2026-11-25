import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCode2,
  Loader2,
  Play,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";

const PYTHON_OPTIONS = [
  { value: "", label: "Auto-detect (or default to Python 3.11)" },
  { value: "3.9", label: "Python 3.9 (python:3.9-slim)" },
  { value: "3.10", label: "Python 3.10 (python:3.10-slim)" },
  { value: "3.11", label: "Python 3.11 (python:3.11-slim)" },
  { value: "3.12", label: "Python 3.12 (python:3.12-slim)" },
  { value: "3.13", label: "Python 3.13 (python:3.13-slim)" },
];

function downloadTextFile(filename, content) {
  const safeName = filename.split(/[\\/]/).pop() || "proposed_fix.txt";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJsonReport(reportObj, repoName) {
  const slug = (repoName || "envix-report").replaceAll("/", "_");
  const blob = new Blob([JSON.stringify(reportObj, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug}-report.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function StageWorkspace({
  activeStep,
  onSelectStep,
  analysis,
  isPreparing,
  prepareError,
  prepareResult,
  onPrepare,
  isExecuting,
  executeError,
  executeResult,
  onExecute,
  isDiagnosing,
  diagnosisError,
  diagnosisResult,
  onDiagnose,
}) {
  const [installApproved, setInstallApproved] = useState(false);
  const [selectedPython, setSelectedPython] = useState("");
  const [execCommand, setExecCommand] = useState("");
  const [execTimeout, setExecTimeout] = useState(30);
  const [execApproved, setExecApproved] = useState(false);

  useEffect(() => {
    const firstCandidate = analysis?.candidate_entry_points?.[0]?.command || "";
    setExecCommand(firstCandidate);
    setInstallApproved(false);
    setExecApproved(false);
  }, [analysis]);

  if (!analysis) return null;

  return (
    <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
      {/* TAB 1: CODE & ANALYSIS */}
      {activeStep === "analysis" && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Repository Overview
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Cloned to{" "}
                <code className="font-mono text-[var(--text-primary)]">
                  {analysis.workspace_dir}
                </code>{" "}
                — inspected statically without running code.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectStep("install")}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-green)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-green-hover)]"
            >
              Next: Build & Deps
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">
                Python ({analysis.python_version?.status})
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                {analysis.python_version?.declared ||
                  analysis.python_version?.inferred ||
                  "Not declared"}
              </div>
            </div>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">Python Files</div>
              <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                {analysis.python_files_count} file(s)
              </div>
            </div>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">Dependencies</div>
              <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                {analysis.dependencies?.length || 0} package(s)
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
              Configuration Files
            </h3>
            {analysis.detected_config_files?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.detected_config_files.map((file) => (
                  <span
                    key={file}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--accent-blue)]"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    {file}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                None detected.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
              Dependencies
            </h3>
            {analysis.dependencies?.length > 0 ? (
              <div className="max-h-40 overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)]">
                <ul className="divide-y divide-[var(--border-subtle)] font-mono text-xs">
                  {analysis.dependencies.map((dep, idx) => (
                    <li
                      key={`${dep.name}-${idx}`}
                      className="flex items-center justify-between px-3.5 py-2 text-[var(--text-primary)]"
                    >
                      <span>
                        {dep.name}{" "}
                        <span className="text-[var(--text-secondary)]">
                          {dep.specifier}
                        </span>
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {dep.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                No dependencies extracted.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
              Candidate Entry Points
            </h3>
            {analysis.candidate_entry_points?.length > 0 ? (
              <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)]">
                {analysis.candidate_entry_points.map((ep, idx) => (
                  <li
                    key={`${ep.command}-${idx}`}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <code className="font-mono font-medium text-[var(--text-primary)]">
                        {ep.command}
                      </code>
                      <p className="mt-0.5 text-[var(--text-secondary)]">
                        {ep.path} — {ep.reason}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                      {ep.confidence}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">
                No clear entry point detected; you can enter a command manually in
                the Run tab.
              </p>
            )}
          </div>

          {analysis.warnings?.length > 0 && (
            <div className="rounded-md border border-[var(--accent-amber-border)] bg-[var(--accent-amber-bg)] p-3.5 text-xs text-[var(--accent-amber)]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </div>
              <ul className="list-disc space-y-1 pl-4">
                {analysis.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUILD & DEPENDENCIES */}
      {activeStep === "install" && (
        <div className="space-y-5 text-sm">
          <div className="border-b border-[var(--border-subtle)] pb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Docker Environment & Dependency Install
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Builds an isolated Docker image in a separate{" "}
              <code className="font-mono text-[var(--text-primary)]">
                build_context
              </code>{" "}
              without changing your original repository.
            </p>
          </div>

          <div className="rounded-md border border-[var(--accent-amber-border)] bg-[var(--accent-amber-bg)] p-4 text-xs text-[var(--accent-amber)]">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Approval Required</p>
                <p className="mt-1 leading-relaxed">
                  Running <code className="font-mono">pip install</code> can
                  execute package build scripts inside the container. Confirm
                  below before proceeding.
                </p>
                {analysis.python_version?.status === "unknown" && (
                  <p className="mt-1.5">
                    Python version is unknown; Auto-detect defaults to{" "}
                    <code className="font-mono">python:3.11-slim</code>.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label
                htmlFor="python-image-select"
                className="mb-1.5 block font-medium text-[var(--text-primary)]"
              >
                Python Base Image
              </label>
              <select
                id="python-image-select"
                value={selectedPython}
                onChange={(e) => setSelectedPython(e.target.value)}
                disabled={isPreparing}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
              >
                {PYTHON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3 text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={installApproved}
                onChange={(e) => setInstallApproved(e.target.checked)}
                disabled={isPreparing}
                className="h-4 w-4 rounded border-[var(--border-default)]"
              />
              <span>
                I understand the risk and approve running dependency
                installation in Docker.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={!installApproved || isPreparing}
                onClick={() =>
                  onPrepare(analysis.run_id, installApproved, selectedPython)
                }
                className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-green)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreparing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Building & Installing...
                  </>
                ) : (
                  "Approve & Install Dependencies"
                )}
              </button>

              {prepareResult && (
                <button
                  type="button"
                  onClick={() => onSelectStep("execute")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                >
                  Next: Run & Logs
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {prepareError && (
            <div className="rounded-md border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] p-3 text-xs text-[var(--accent-red)]">
              {prepareError}
            </div>
          )}

          {prepareResult && (
            <div className="space-y-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[var(--text-secondary)]">
                    Environment Prep
                  </span>
                  <div className="mt-0.5 font-mono font-semibold text-[var(--text-primary)]">
                    {prepareResult.environment_preparation_status}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">
                    Dependency Install
                  </span>
                  <div
                    className={`mt-0.5 font-mono font-semibold ${
                      prepareResult.dependency_installation_status === "failed"
                        ? "text-[var(--accent-red)]"
                        : "text-[#2da44e]"
                    }`}
                  >
                    {prepareResult.dependency_installation_status}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Exit Code</span>
                  <div className="mt-0.5 font-mono font-semibold text-[var(--text-primary)]">
                    {prepareResult.exit_code ?? "N/A"}
                  </div>
                </div>
              </div>
              <p className="text-[var(--text-secondary)]">
                {prepareResult.python_selection?.disclosure}
              </p>
              {prepareResult.error_details && (
                <div className="rounded border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] p-2.5 font-mono text-xs text-[var(--accent-red)]">
                  {prepareResult.error_details}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RUN & LOGS */}
      {activeStep === "execute" && (
        <div className="space-y-5 text-sm">
          <div className="border-b border-[var(--border-subtle)] pb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Execute Project in Container
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Runs inside a disposable, network-disabled container with CPU,
              memory, and timeout limits.
            </p>
          </div>

          {analysis.candidate_entry_points?.length > 0 && (
            <div className="text-xs">
              <div className="mb-1.5 text-[var(--text-secondary)]">
                Detected commands:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.candidate_entry_points.map((ep, idx) => (
                  <button
                    key={`${ep.command}-${idx}`}
                    type="button"
                    onClick={() => setExecCommand(ep.command)}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--accent-blue)] hover:border-[var(--accent-blue)]"
                  >
                    {ep.command}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
            <div className="sm:col-span-3">
              <label
                htmlFor="exec-command-input"
                className="mb-1.5 block font-medium text-[var(--text-primary)]"
              >
                Execution Command
              </label>
              <input
                id="exec-command-input"
                type="text"
                value={execCommand}
                onChange={(e) => setExecCommand(e.target.value)}
                placeholder="e.g. python app.py or sample"
                disabled={isExecuting}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="exec-timeout-input"
                className="mb-1.5 block font-medium text-[var(--text-primary)]"
              >
                Timeout (5–120s)
              </label>
              <input
                id="exec-timeout-input"
                type="number"
                min={5}
                max={120}
                value={execTimeout}
                onChange={(e) => setExecTimeout(Number(e.target.value))}
                disabled={isExecuting}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3 text-xs text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={execApproved}
              onChange={(e) => setExecApproved(e.target.checked)}
              disabled={isExecuting}
              className="h-4 w-4 rounded border-[var(--border-default)]"
            />
            <span>
              I confirm this command and approve running it inside Docker
              (network disabled).
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <button
              type="button"
              disabled={!execApproved || !execCommand.trim() || isExecuting}
              onClick={() =>
                onExecute(analysis.run_id, execCommand, execApproved, execTimeout)
              }
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-green)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run Project
                </>
              )}
            </button>

            {(executeResult || prepareResult) && (
              <button
                type="button"
                onClick={() => onSelectStep("diagnose")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                Next: AI Diagnosis
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {executeError && (
            <div className="rounded-md border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] p-3 text-xs text-[var(--accent-red)]">
              {executeError}
            </div>
          )}

          {executeResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5 text-xs">
              <div className="flex items-center gap-2">
                {executeResult.execution_status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-[#2da44e]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[var(--accent-red)]" />
                )}
                <span className="font-semibold text-[var(--text-primary)]">
                  Status: {executeResult.execution_status}
                </span>
              </div>
              <div className="font-mono text-[var(--text-secondary)]">
                Exit: {executeResult.exit_code ?? "timeout"} | Duration:{" "}
                {executeResult.duration_seconds}s
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AI DIAGNOSIS & FIXES */}
      {activeStep === "diagnose" && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                AI Diagnosis & Fix Proposals
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Sanitizes logs (strips secrets) before sending them to Groq AI.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={(!prepareResult && !executeResult) || isDiagnosing}
                onClick={() => onDiagnose(analysis.run_id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-green)] px-3.5 py-2 font-semibold text-white transition hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDiagnosing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Diagnosing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Diagnose with Groq AI
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onSelectStep("report")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                Final Report
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {diagnosisError && (
            <div className="rounded-md border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] p-3 text-xs text-[var(--accent-red)]">
              {diagnosisError}
            </div>
          )}

          {!diagnosisResult && !isDiagnosing && (
            <p className="text-xs text-[var(--text-secondary)]">
              Click <strong>Diagnose with Groq AI</strong> to analyze your
              captured installation or runtime logs.
            </p>
          )}

          {diagnosisResult && (
            <div className="space-y-4 text-xs">
              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
                <div className="font-semibold text-[var(--accent-blue)]">
                  Root Cause ({diagnosisResult.model_used})
                </div>
                <p className="mt-1.5 text-sm font-medium text-[var(--text-primary)]">
                  {diagnosisResult.root_cause}
                </p>
                {diagnosisResult.explanation && (
                  <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
                    {diagnosisResult.explanation}
                  </p>
                )}
              </div>

              {diagnosisResult.evidence?.length > 0 && (
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-4">
                  <div className="mb-2 font-semibold text-[var(--text-primary)]">
                    Evidence from Logs
                  </div>
                  <ul className="space-y-1.5 font-mono text-xs text-[var(--accent-amber)]">
                    {diagnosisResult.evidence.map((e, i) => (
                      <li
                        key={i}
                        className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diagnosisResult.suggested_fix && (
                <div className="rounded-md border border-[#2da44e]/40 bg-[#2da44e]/10 p-4">
                  <div className="font-semibold text-[#2da44e]">
                    Suggested Fix
                  </div>
                  <p className="mt-1 text-[var(--text-primary)]">
                    {diagnosisResult.suggested_fix}
                  </p>
                  {diagnosisResult.why_fix_works && (
                    <p className="mt-1.5 text-[var(--text-secondary)]">
                      Why this works: {diagnosisResult.why_fix_works}
                    </p>
                  )}
                </div>
              )}

              {diagnosisResult.proposed_files?.length > 0 && (
                <div className="space-y-2.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Proposed Files (Review & Download)
                  </div>
                  {diagnosisResult.proposed_files.map((item, idx) => (
                    <div
                      key={`${item.filename}-${idx}`}
                      className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)]"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2">
                        <span className="font-mono font-semibold text-[var(--text-primary)]">
                          {item.filename}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            downloadTextFile(
                              item.filename,
                              item.proposed_content || ""
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Fix
                        </button>
                      </div>
                      {item.explanation && (
                        <p className="border-b border-[var(--border-subtle)] px-3.5 py-2 text-[var(--text-secondary)]">
                          {item.explanation}
                        </p>
                      )}
                      <pre className="max-h-44 overflow-auto p-3.5 font-mono text-xs text-[var(--text-primary)]">
                        {item.proposed_content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FINAL REPORT */}
      {activeStep === "report" && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Final Recovery Report
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Summary for{" "}
                <code className="font-mono text-[var(--text-primary)]">
                  {analysis.repo_name}
                </code>{" "}
                (Run <code className="font-mono">{analysis.run_id}</code>)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadJsonReport(
                  {
                    repo_name: analysis.repo_name,
                    run_id: analysis.run_id,
                    python_version: analysis.python_version,
                    environment_preparation: prepareResult
                      ? {
                          selected_image: prepareResult.selected_image,
                          dependency_installation_status:
                            prepareResult.dependency_installation_status,
                          exit_code: prepareResult.exit_code,
                        }
                      : null,
                    execution: executeResult
                      ? {
                          command: executeResult.command,
                          execution_status: executeResult.execution_status,
                          exit_code: executeResult.exit_code,
                          duration_seconds: executeResult.duration_seconds,
                          timed_out: executeResult.timed_out,
                        }
                      : null,
                    ai_diagnosis: diagnosisResult
                      ? {
                          ai_available: diagnosisResult.ai_available,
                          model_used: diagnosisResult.model_used,
                          root_cause: diagnosisResult.root_cause,
                          suggested_fix: diagnosisResult.suggested_fix,
                          proposed_files_count:
                            diagnosisResult.proposed_files?.length || 0,
                        }
                      : null,
                  },
                  analysis.repo_name
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-green)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-green-hover)]"
            >
              <Download className="h-3.5 w-3.5" />
              Download Report (JSON)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">
                1. Static Analysis
              </div>
              <div className="mt-1 font-mono font-semibold text-[#2da44e]">
                {analysis.clone_status} • {analysis.dependencies?.length || 0}{" "}
                dependency entries
              </div>
            </div>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">
                2. Dependency Install
              </div>
              <div className="mt-1 font-mono font-semibold text-[var(--text-primary)]">
                {prepareResult
                  ? `${prepareResult.dependency_installation_status} (exit ${prepareResult.exit_code ?? "?"})`
                  : "Not run"}
              </div>
            </div>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">
                3. Project Execution
              </div>
              <div className="mt-1 font-mono font-semibold text-[var(--text-primary)]">
                {executeResult
                  ? `${executeResult.execution_status} (${executeResult.duration_seconds}s)`
                  : "Not run"}
              </div>
            </div>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5">
              <div className="text-[var(--text-secondary)]">4. AI Diagnosis</div>
              <div className="mt-1 font-mono font-semibold text-[var(--text-primary)]">
                {diagnosisResult
                  ? diagnosisResult.ai_available
                    ? `${diagnosisResult.proposed_files?.length || 0} fix file(s)`
                    : "Unavailable"
                  : "Not requested"}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3.5 text-xs text-[var(--text-secondary)]">
            Cloned files are stored locally at{" "}
            <code className="font-mono text-[var(--text-primary)]">
              {analysis.workspace_dir}/repo
            </code>
            . Envix never modifies your original repository or host environment.
          </div>
        </div>
      )}
    </div>
  );
}
