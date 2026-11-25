import { AlertTriangle, BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

export function AIDiagnosisPanel({
  runId,
  canDiagnose,
  isDiagnosing,
  diagnosisError,
  diagnosisResult,
  onDiagnose,
}) {
  const badge = isDiagnosing
    ? { label: "Analyzing Logs...", tone: "warning" }
    : diagnosisResult
      ? diagnosisResult.ai_available
        ? { label: diagnosisResult.model_used || "Diagnosed", tone: "success" }
        : { label: "AI Unavailable", tone: "error" }
      : { label: "Not Requested", tone: "neutral" };

  return (
    <DashboardPanel
      title="AI Diagnosis"
      icon={BrainCircuit}
      badge={badge.label}
      badgeTone={badge.tone}
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-slate-400">
            Sends sanitized logs (secrets stripped) to Groq AI for root-cause
            explanation.
          </p>
          <button
            type="button"
            disabled={!canDiagnose || isDiagnosing}
            onClick={() => onDiagnose(runId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>

        {diagnosisError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{diagnosisError}</span>
          </div>
        )}

        {diagnosisResult && (
          <div className="space-y-3">
            {diagnosisResult.error && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-200">
                {diagnosisResult.error}
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                Likely Root Cause
              </div>
              <p className="mt-1 font-medium text-slate-100">
                {diagnosisResult.root_cause}
              </p>
              {diagnosisResult.affected_component && (
                <p className="mt-1 font-mono text-[11px] text-cyan-300">
                  Affected: {diagnosisResult.affected_component}
                </p>
              )}
            </div>

            {diagnosisResult.evidence?.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Evidence from Actual Logs
                </div>
                <ul className="mt-1.5 space-y-1 font-mono text-[11px] text-amber-200">
                  {diagnosisResult.evidence.map((line, idx) => (
                    <li key={idx} className="rounded bg-slate-900 px-2 py-1">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {diagnosisResult.explanation && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Explanation
                </div>
                <p className="mt-1 text-slate-200">
                  {diagnosisResult.explanation}
                </p>
              </div>
            )}

            {diagnosisResult.suggested_fix && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                  Suggested Fix
                </div>
                <p className="mt-1 text-slate-100">
                  {diagnosisResult.suggested_fix}
                </p>
                {diagnosisResult.why_fix_works && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Why this may work: {diagnosisResult.why_fix_works}
                  </p>
                )}
              </div>
            )}

            {diagnosisResult.uncertainty && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-[11px] text-amber-200">
                <strong>Uncertainty:</strong> {diagnosisResult.uncertainty}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardPanel>
  );
}
