import { useEffect, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

export function ConsolePanel({
  isPreparing,
  prepareResult,
  isExecuting,
  executeResult,
}) {
  const [activeTab, setActiveTab] = useState("install");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isExecuting || executeResult) {
      setActiveTab("runtime");
    } else if (isPreparing || prepareResult) {
      setActiveTab("install");
    }
  }, [isPreparing, prepareResult, isExecuting, executeResult]);

  const installText = isPreparing
    ? "Building Docker environment and running approved pip install..."
    : prepareResult?.logs || "No dependency installation logs yet.";

  const runtimeText = isExecuting
    ? "Executing command inside isolated Docker container (network disabled)..."
    : executeResult
      ? [
          `$ ${executeResult.command}  (duration: ${executeResult.duration_seconds}s | exit: ${executeResult.exit_code ?? "timeout"})`,
          executeResult.failure_details
            ? `\n[ERROR] ${executeResult.failure_details}`
            : "",
          `\n--- STDOUT ---\n${executeResult.stdout || "(empty)"}`,
          `\n--- STDERR ---\n${executeResult.stderr || "(empty)"}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "No runtime execution output yet.";

  const displayedText = activeTab === "install" ? installText : runtimeText;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)]">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
        <div className="flex items-center gap-1">
          <Terminal className="mr-1.5 h-4 w-4 text-[var(--text-secondary)]" />
          <button
            type="button"
            onClick={() => setActiveTab("install")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "install"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Install Logs
            {prepareResult && (
              <span
                className={`ml-1.5 ${
                  prepareResult.dependency_installation_status === "failed"
                    ? "text-[var(--accent-red)]"
                    : "text-[#2da44e]"
                }`}
              >
                ({prepareResult.dependency_installation_status})
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("runtime")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              activeTab === "runtime"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Runtime Output
            {executeResult && (
              <span
                className={`ml-1.5 ${
                  executeResult.execution_status === "success"
                    ? "text-[#2da44e]"
                    : "text-[var(--accent-red)]"
                }`}
              >
                (exit {executeResult.exit_code ?? "timeout"})
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#2da44e]" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              Copy
            </>
          )}
        </button>
      </div>

      <pre className="min-h-[380px] flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-[var(--text-primary)] lg:max-h-[620px]">
        {displayedText}
      </pre>
    </aside>
  );
}
