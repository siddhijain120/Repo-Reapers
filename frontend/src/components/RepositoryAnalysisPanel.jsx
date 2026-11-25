import { AlertTriangle, FileSearch, Loader2 } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

export function RepositoryAnalysisPanel({ isAnalyzing, analysis }) {
  const badge = isAnalyzing
    ? { label: "Cloning & Scanning", tone: "warning" }
    : analysis
      ? { label: analysis.clone_status || "Analyzed", tone: "success" }
      : { label: "Awaiting Repo", tone: "neutral" };

  return (
    <DashboardPanel
      title="Repository Analysis"
      icon={FileSearch}
      badge={badge.label}
      badgeTone={badge.tone}
    >
      {isAnalyzing && (
        <div className="flex items-center gap-2.5 py-6 text-xs text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          <span>
            Cloning repository into isolated workspace and inspecting files
            statically...
          </span>
        </div>
      )}

      {!isAnalyzing && !analysis && (
        <div className="space-y-3 text-xs text-slate-400">
          <p>
            No repository analyzed yet. Submit a public GitHub URL above to
            inspect{" "}
            <code className="font-mono text-slate-300">requirements.txt</code>,{" "}
            <code className="font-mono text-slate-300">pyproject.toml</code>,{" "}
            <code className="font-mono text-slate-300">setup.cfg</code>, and
            Python entry points without executing any code.
          </p>
        </div>
      )}

      {!isAnalyzing && analysis && (
        <div className="space-y-4 text-xs">
          {/* Core Summary */}
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <dt className="text-slate-400">Repository</dt>
              <dd className="mt-1 truncate font-mono font-semibold text-slate-100">
                {analysis.repo_name}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <dt className="text-slate-400">Clone Status</dt>
              <dd className="mt-1 font-mono font-semibold text-emerald-300">
                {analysis.clone_status} ({analysis.python_files_count} .py files)
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
              <dt className="text-slate-400">
                Python Version ({analysis.python_version?.status || "unknown"})
              </dt>
              <dd className="mt-1 font-mono font-semibold text-slate-100">
                {analysis.python_version?.declared ||
                  analysis.python_version?.inferred ||
                  "Not declared"}
              </dd>
            </div>
          </dl>

          {/* Detected Config Files */}
          <div>
            <h4 className="mb-1.5 font-semibold text-slate-300">
              Detected Configuration Files
            </h4>
            {analysis.detected_config_files?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.detected_config_files.map((file) => (
                  <span
                    key={file}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-cyan-300"
                  >
                    {file}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">None detected.</p>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <h4 className="mb-1.5 font-semibold text-slate-300">
              Dependencies ({analysis.dependencies?.length || 0})
            </h4>
            {analysis.dependencies?.length > 0 ? (
              <div className="max-h-32 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                <ul className="space-y-1 font-mono text-[11px]">
                  {analysis.dependencies.map((dep, idx) => (
                    <li
                      key={`${dep.name}-${idx}`}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span>
                        {dep.name}{" "}
                        <span className="text-cyan-300">{dep.specifier}</span>
                      </span>
                      <span className="text-slate-500">{dep.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-slate-500">No dependencies extracted.</p>
            )}
          </div>

          {/* Candidate Entry Points */}
          <div>
            <h4 className="mb-1.5 font-semibold text-slate-300">
              Candidate Entry Points ({analysis.candidate_entry_points?.length || 0})
            </h4>
            {analysis.candidate_entry_points?.length > 0 ? (
              <ul className="space-y-1.5">
                {analysis.candidate_entry_points.map((ep, idx) => (
                  <li
                    key={`${ep.path}-${idx}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-[11px] text-cyan-300">
                        {ep.command}
                      </code>
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {ep.confidence}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {ep.path} — {ep.reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">
                No candidate entry points detected.
              </p>
            )}
          </div>

          {/* Warnings */}
          {analysis.warnings?.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warnings
              </div>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                {analysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DashboardPanel>
  );
}
