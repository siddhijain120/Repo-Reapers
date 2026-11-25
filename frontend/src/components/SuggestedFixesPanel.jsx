import { Download, Wrench } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

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

export function SuggestedFixesPanel({ diagnosisResult }) {
  const proposedFiles = diagnosisResult?.proposed_files || [];

  return (
    <DashboardPanel
      title="Suggested Fixes"
      icon={Wrench}
      badge={proposedFiles.length > 0 ? `${proposedFiles.length} File(s)` : "None"}
      badgeTone={proposedFiles.length > 0 ? "info" : "neutral"}
    >
      {proposedFiles.length === 0 ? (
        <p className="text-xs text-slate-400">
          Proposed fix files will appear here for your review and manual
          download after running AI Diagnosis. Envix never modifies original
          repository files automatically.
        </p>
      ) : (
        <div className="space-y-3 text-xs">
          {proposedFiles.map((item, idx) => (
            <div
              key={`${item.filename}-${idx}`}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-semibold text-cyan-300">
                  {item.filename}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    downloadTextFile(item.filename, item.proposed_content || "")
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Fix
                </button>
              </div>
              {item.explanation && (
                <p className="mt-1.5 text-[11px] text-slate-300">
                  {item.explanation}
                </p>
              )}
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-2.5 font-mono text-[11px] text-slate-200">
                {item.proposed_content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
