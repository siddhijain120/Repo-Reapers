import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Server,
  XCircle,
} from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

function ToolStatusCard({ name, ok, detail, subtext }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        ok
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-rose-500/25 bg-rose-500/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200">{name}</span>
        {ok ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300">
            <XCircle className="h-3.5 w-3.5" />
            Unavailable
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate font-mono text-xs text-slate-100">
        {detail}
      </div>
      {subtext && (
        <div className="mt-1 truncate text-[11px] text-slate-400" title={subtext}>
          {subtext}
        </div>
      )}
    </div>
  );
}

export function SystemStatusPanel({ healthState, systemInfoState, onRetry }) {
  const { status, data: healthData, error: healthError } = healthState;
  const {
    status: sysStatus,
    data: sysData,
    error: sysError,
  } = systemInfoState;

  const isLoading = status === "loading" || sysStatus === "loading";

  const badge =
    status === "connected"
      ? { label: "Healthy", tone: "success" }
      : isLoading
        ? { label: "Checking", tone: "warning" }
        : { label: "Error", tone: "error" };

  return (
    <DashboardPanel
      title="System Status"
      icon={Server}
      badge={badge.label}
      badgeTone={badge.tone}
    >
      {isLoading && !healthData && (
        <div className="flex items-center gap-2.5 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          <span>Inspecting backend and local environment...</span>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Backend health check failed</p>
              <p className="mt-1 text-rose-200/80">{healthError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      {status === "connected" && healthData && (
        <div className="space-y-4">
          {sysStatus === "error" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Could not load local system info: {sysError}</span>
            </div>
          )}

          {sysData && (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <ToolStatusCard
                  name="Python"
                  ok={Boolean(sysData.python?.installed)}
                  detail={`v${sysData.python?.version || "unknown"}`}
                  subtext={sysData.python?.executable || ""}
                />
                <ToolStatusCard
                  name="Git"
                  ok={Boolean(sysData.git?.installed)}
                  detail={
                    sysData.git?.installed
                      ? `v${sysData.git.version || "detected"}`
                      : "Not installed"
                  }
                  subtext={sysData.git?.error || "CLI available on PATH"}
                />
                <ToolStatusCard
                  name="Docker CLI"
                  ok={Boolean(sysData.docker_cli?.installed)}
                  detail={
                    sysData.docker_cli?.installed
                      ? sysData.docker_cli.version || "Installed"
                      : "Not installed"
                  }
                  subtext={
                    sysData.docker_cli?.error || "CLI binary detected"
                  }
                />
                <ToolStatusCard
                  name="Docker Engine"
                  ok={Boolean(sysData.docker_engine?.connected)}
                  detail={
                    sysData.docker_engine?.connected
                      ? `Server v${sysData.docker_engine.server_version || "running"}`
                      : "Not connected"
                  }
                  subtext={
                    sysData.docker_engine?.connected
                      ? `API v${sysData.docker_engine.api_version || "?"}`
                      : sysData.docker_engine?.error ||
                        "Start Docker Desktop to enable simulation"
                  }
                />
              </div>

              <dl className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <dt className="text-slate-400">Operating System</dt>
                  <dd className="mt-1 font-mono font-medium text-slate-100">
                    {sysData.os?.system || "Unknown"}{" "}
                    {sysData.os?.release || ""}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <dt className="text-slate-400">CPU</dt>
                  <dd className="mt-1 font-mono font-medium text-slate-100">
                    {sysData.cpu?.architecture || "?"} ({sysData.cpu?.count ?? "?"}{" "}
                    cores)
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                  <dt className="text-slate-400">Available RAM</dt>
                  <dd className="mt-1 font-mono font-medium text-slate-100">
                    {sysData.memory?.detectable
                      ? `${sysData.memory.available_gb} / ${sysData.memory.total_gb} GB`
                      : "Not detectable"}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      )}
    </DashboardPanel>
  );
}
