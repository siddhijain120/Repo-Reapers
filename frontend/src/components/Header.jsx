import { Activity, Cpu, RefreshCw } from "lucide-react";

export function Header({ healthState, onRefreshHealth }) {
  const { status } = healthState;

  const badgeConfig = {
    loading: {
      dot: "bg-amber-400 animate-pulse",
      text: "text-amber-300",
      border: "border-amber-500/30 bg-amber-500/10",
      label: "Checking Backend...",
    },
    connected: {
      dot: "bg-emerald-400",
      text: "text-emerald-300",
      border: "border-emerald-500/30 bg-emerald-500/10",
      label: "Backend Connected",
    },
    error: {
      dot: "bg-rose-400",
      text: "text-rose-300",
      border: "border-rose-500/30 bg-rose-500/10",
      label: "Backend Offline",
    },
  }[status];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Envix
              </h1>
              <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                by Repo Reapers
              </span>
            </div>
            <p className="text-sm text-slate-400">
              AI-Powered Developer Environment Recovery Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${badgeConfig.border} ${badgeConfig.text}`}
          >
            <span className={`h-2 w-2 rounded-full ${badgeConfig.dot}`} />
            <Activity className="h-3.5 w-3.5" />
            <span>{badgeConfig.label}</span>
          </div>

          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={status === "loading"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
