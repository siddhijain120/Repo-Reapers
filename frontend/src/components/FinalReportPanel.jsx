import { ClipboardCheck, Download } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

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

export function FinalReportPanel({
  analysis,
  prepareResult,
  executeResult,
  diagnosisResult,
}) {
  const hasData = Boolean(analysis || prepareResult || executeResult || diagnosisResult);

  const reportPayload = {
    repo_name: analysis?.repo_name || null,
    run_id: analysis?.run_id || null,
    python_version: analysis?.python_version || null,
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
          proposed_files_count: diagnosisResult.proposed_files?.length || 0,
        }
      : null,
  };

  return (
    <DashboardPanel
      title="Final Report"
      icon={ClipboardCheck}
      badge={hasData ? "Ready" : "Pending"}
      badgeTone={hasData ? "info" : "neutral"}
    >
      {!hasData ? (
        <p className="text-xs text-slate-400">
          The final recovery summary will combine verified repository facts,
          real Docker exit codes, AI diagnosis, and downloadable fixes once you
          analyze a repository.
        </p>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-slate-300">
              Summary for{" "}
              <strong className="font-mono text-cyan-300">
                {analysis?.repo_name}
              </strong>{" "}
              (Run <code className="font-mono">{analysis?.run_id}</code>)
            </span>
            <button
              type="button"
              onClick={() => downloadJsonReport(reportPayload, analysis?.repo_name)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              Download Report (JSON)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-slate-400">Static Analysis</div>
              <div className="mt-1 font-mono font-semibold text-emerald-300">
                {analysis?.clone_status || "done"} ({analysis?.dependencies?.length || 0} deps)
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-slate-400">Dependency Install</div>
              <div className="mt-1 font-mono font-semibold text-slate-100">
                {prepareResult
                  ? `${prepareResult.dependency_installation_status} (exit ${prepareResult.exit_code ?? "?"})`
                  : "Not run"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-slate-400">Project Execution</div>
              <div className="mt-1 font-mono font-semibold text-slate-100">
                {executeResult
                  ? `${executeResult.execution_status} (${executeResult.duration_seconds}s)`
                  : "Not run"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <div className="text-slate-400">AI Diagnosis</div>
              <div className="mt-1 font-mono font-semibold text-slate-100">
                {diagnosisResult
                  ? diagnosisResult.ai_available
                    ? `${diagnosisResult.proposed_files?.length || 0} fix(es)`
                    : "Unavailable"
                  : "Not requested"}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
