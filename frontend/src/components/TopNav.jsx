import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Moon,
  RefreshCw,
  Sun,
  TerminalSquare,
  XCircle,
} from "lucide-react";

function StatusDot({ label, ok, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-[#2da44e]" : "bg-[#cf222e]"
        }`}
      />
      <span>{label}</span>
    </span>
  );
}

export function TopNav({
  theme,
  onToggleTheme,
  healthState,
  systemInfoState,
  onRefresh,
  onResetHome,
}) {
  const [showDetails, setShowDetails] = useState(false);

  const isLoading =
    healthState.status === "loading" || systemInfoState.status === "loading";
  const isConnected = healthState.status === "connected";
  const sys = systemInfoState.data;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-[var(--bg-header)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onResetHome}
          className="flex items-center gap-2.5 text-left transition hover:opacity-85"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <TerminalSquare className="h-4 w-4 text-[var(--accent-blue)]" />
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-[var(--text-secondary)]">Repo Reapers</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="font-semibold text-[var(--text-primary)]">
              Envix
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {sys && (
            <div className="hidden items-center gap-1.5 md:flex">
              <StatusDot
                label={`Python ${sys.python?.version || "?"}`}
                ok={Boolean(sys.python?.installed)}
                title={sys.python?.executable}
              />
              <StatusDot
                label="Git"
                ok={Boolean(sys.git?.installed)}
                title={sys.git?.version || sys.git?.error}
              />
              <StatusDot
                label="Docker"
                ok={Boolean(sys.docker_engine?.connected)}
                title={
                  sys.docker_engine?.connected
                    ? `Engine v${sys.docker_engine.server_version}`
                    : sys.docker_engine?.error || "Docker Engine stopped"
                }
              />
            </div>
          )}

          {/* Sunlight / Sundown Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={
              theme === "dark"
                ? "Switch to Sunlight (Light) mode"
                : "Switch to Sundown (Dark) mode"
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-[#e3b341]" />
                <span className="hidden sm:inline">Sunlight</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[#0969da]" />
                <span className="hidden sm:inline">Sundown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
          >
            <Cpu className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <span className="hidden sm:inline">System</span>
            {showDetails ? (
              <ChevronUp className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Local Agent & Docker status"
            className="inline-flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            {!isConnected ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] px-4 py-3 text-xs text-[var(--accent-red)]">
                <span>
                  <strong>Local Agent Offline:</strong> Start the FastAPI
                  backend on port 8000 and click Refresh.
                </span>
                <span className="font-mono">{healthState.error}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="text-[var(--text-secondary)]">OS</div>
                  <div className="mt-1 font-mono font-medium text-[var(--text-primary)]">
                    {sys?.os?.system} {sys?.os?.release}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="text-[var(--text-secondary)]">CPU</div>
                  <div className="mt-1 font-mono font-medium text-[var(--text-primary)]">
                    {sys?.cpu?.architecture} ({sys?.cpu?.count} cores)
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="text-[var(--text-secondary)]">Available RAM</div>
                  <div className="mt-1 font-mono font-medium text-[var(--text-primary)]">
                    {sys?.memory?.detectable
                      ? `${sys.memory.available_gb} / ${sys.memory.total_gb} GB`
                      : "Unknown"}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Git</span>
                    {sys?.git?.installed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2da44e]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[#cf222e]" />
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono font-medium text-[var(--text-primary)]">
                    {sys?.git?.version || "Missing"}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Docker CLI</span>
                    {sys?.docker_cli?.installed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2da44e]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[#cf222e]" />
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono font-medium text-[var(--text-primary)]">
                    {sys?.docker_cli?.version || "Missing"}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] p-3">
                  <div className="flex items-center justify-between text-[var(--text-secondary)]">
                    <span>Docker Engine</span>
                    {sys?.docker_engine?.connected ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2da44e]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[#cf222e]" />
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono font-medium text-[var(--text-primary)]">
                    {sys?.docker_engine?.connected
                      ? `v${sys.docker_engine.server_version}`
                      : "Stopped"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
