import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

const PYTHON_OPTIONS = [
  { value: "", label: "Auto (from repository or default 3.11)" },
  { value: "3.9", label: "Python 3.9 (python:3.9-slim)" },
  { value: "3.10", label: "Python 3.10 (python:3.10-slim)" },
  { value: "3.11", label: "Python 3.11 (python:3.11-slim)" },
  { value: "3.12", label: "Python 3.12 (python:3.12-slim)" },
  { value: "3.13", label: "Python 3.13 (python:3.13-slim)" },
];

function StatusPill({ label, status }) {
  const styles = {
    idle: "border-slate-700 bg-slate-950 text-slate-400",
    running: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    skipped: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    timed_out: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  };

  return (
    <div className={`rounded-lg border p-2.5 text-xs ${styles[status] || styles.idle}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 font-mono font-semibold uppercase">
        {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
        {(status === "failed" || status === "timed_out") && (
          <XCircle className="h-3.5 w-3.5" />
        )}
        <span>{status}</span>
      </div>
    </div>
  );
}

export function EnvironmentSimulationPanel({
  analysis,
  isPreparing,
  prepareError,
  prepareResult,
  onPrepare,
  isExecuting,
  executeError,
  executeResult,
  onExecute,
}) {
  const [approved, setApproved] = useState(false);
  const [selectedPython, setSelectedPython] = useState("");
  const [execCommand, setExecCommand] = useState("");
  const [execTimeout, setExecTimeout] = useState(30);
  const [execApproved, setExecApproved] = useState(false);

  useEffect(() => {
    const firstCandidate = analysis?.candidate_entry_points?.[0]?.command || "";
    setExecCommand(firstCandidate);
    setApproved(false);
    setExecApproved(false);
  }, [analysis]);

  const envPrepStatus = isPreparing
    ? "running"
    : prepareResult
      ? prepareResult.environment_preparation_status
      : "idle";

  const depInstallStatus = isPreparing
    ? "running"
    : prepareResult
      ? prepareResult.dependency_installation_status
      : "idle";

  const execStatus = isExecuting
    ? "running"
    : executeResult
      ? executeResult.execution_status
      : "idle";

  const badge = isPreparing || isExecuting
    ? { label: "Running in Docker", tone: "warning" }
    : executeResult
      ? executeResult.execution_status === "success"
        ? { label: "Execution Passed", tone: "success" }
        : { label: "Execution Failed", tone: "error" }
      : prepareResult
        ? prepareResult.dependency_installation_status === "failed"
          ? { label: "Install Failed", tone: "error" }
          : { label: "Env Ready", tone: "success" }
        : { label: "Awaiting Approval", tone: "neutral" };

  return (
    <DashboardPanel
      title="Environment Simulation"
      icon={Box}
      badge={badge.label}
      badgeTone={badge.tone}
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <StatusPill label="Environment Preparation" status={envPrepStatus} />
          <StatusPill label="Dependency Installation" status={depInstallStatus} />
          <StatusPill label="Project Execution" status={execStatus} />
        </div>

        {!analysis && (
          <p className="text-slate-400">
            Analyze a public GitHub repository first to prepare its isolated Docker
            environment.
          </p>
        )}

        {analysis && (
          <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div className="flex items-start gap-2 text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Step 1: Approve Dependency Installation
                </p>
                <p className="mt-1 text-amber-100/80">
                  Installing Python packages (<code className="font-mono">pip install</code>)
                  may execute untrusted package build scripts. Envix runs this inside an
                  isolated, non-privileged Docker container without modifying your host or
                  original repository Dockerfile.
                </p>
                {analysis.python_version?.status === "unknown" && (
                  <p className="mt-1.5 text-amber-200">
                    Note: Python version is unknown; Envix will default to{" "}
                    <code className="font-mono">python:3.11-slim</code> unless you select one.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="python-image-select"
                  className="mb-1 block text-[11px] font-medium text-slate-300"
                >
                  Python Base Image
                </label>
                <select
                  id="python-image-select"
                  value={selectedPython}
                  onChange={(e) => setSelectedPython(e.target.value)}
                  disabled={isPreparing}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  {PYTHON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={!approved || isPreparing}
                onClick={() => onPrepare(analysis.run_id, approved, selectedPython)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                disabled={isPreparing}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500"
              />
              <span>
                I understand that dependency installation can run package build scripts and
                approve running it inside Docker.
              </span>
            </label>
          </div>
        )}

        {prepareError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{prepareError}</span>
          </div>
        )}

        {prepareResult && (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-slate-200">
                Image: <strong className="text-cyan-300">{prepareResult.selected_image}</strong>
              </span>
              {prepareResult.image_id && (
                <span className="font-mono text-[11px] text-emerald-300">
                  ID: {prepareResult.image_id.slice(0, 19)}
                </span>
              )}
            </div>
            <p className="text-slate-400">{prepareResult.python_selection?.disclosure}</p>
            {prepareResult.error_details && (
              <p className="rounded border border-rose-500/30 bg-rose-500/10 p-2 font-mono text-[11px] text-rose-300">
                {prepareResult.error_details}
              </p>
            )}

            {/* Step 2: Project Execution Confirmation */}
            <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
              <div className="flex items-start gap-2 text-cyan-200">
                <Play className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <div>
                  <p className="font-semibold">
                    Step 2: Confirm & Approve Project Execution
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Runs inside a disposable, network-disabled container with CPU, memory, and
                    timeout limits.
                  </p>
                </div>
              </div>

              {analysis?.candidate_entry_points?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.candidate_entry_points.map((ep, idx) => (
                    <button
                      key={`${ep.command}-${idx}`}
                      type="button"
                      onClick={() => setExecCommand(ep.command)}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-cyan-300 hover:border-cyan-500"
                    >
                      Use: {ep.command}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="exec-command-input"
                    className="mb-1 block text-[11px] font-medium text-slate-300"
                  >
                    Execution Command
                  </label>
                  <input
                    id="exec-command-input"
                    type="text"
                    value={execCommand}
                    onChange={(e) => setExecCommand(e.target.value)}
                    placeholder="e.g. python app.py or pytest"
                    disabled={isExecuting}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="w-full sm:w-32">
                  <label
                    htmlFor="exec-timeout-input"
                    className="mb-1 block text-[11px] font-medium text-slate-300"
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={!execApproved || !execCommand.trim() || isExecuting}
                  onClick={() =>
                    onExecute(analysis.run_id, execCommand, execApproved, execTimeout)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Execute Project
                    </>
                  )}
                </button>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                <input
                  type="checkbox"
                  checked={execApproved}
                  onChange={(e) => setExecApproved(e.target.checked)}
                  disabled={isExecuting}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500"
                />
                <span>
                  I confirm this execution command and approve running it inside an isolated
                  Docker container (network disabled).
                </span>
              </label>

              {executeError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{executeError}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardPanel>
  );
}
