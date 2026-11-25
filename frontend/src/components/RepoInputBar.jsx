import { useState } from "react";
import { AlertCircle, GitBranch, Loader2, Search } from "lucide-react";

const GITHUB_PUBLIC_REPO_REGEX =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;

export function RepoInputBar({
  backendConnected,
  isAnalyzing,
  analysisError,
  onAnalyze,
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setValidationError("");

    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setValidationError("Please enter a public GitHub repository URL.");
      return;
    }

    if (!GITHUB_PUBLIC_REPO_REGEX.test(trimmed)) {
      setValidationError(
        "Enter a valid public GitHub repository URL (for example: https://github.com/owner/repo)."
      );
      return;
    }

    if (!backendConnected) {
      setValidationError(
        "Cannot start analysis while the backend is offline. Start the FastAPI server and click Refresh."
      );
      return;
    }

    await onAnalyze(trimmed);
  };

  const displayError = validationError || analysisError;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Target Public Python Repository
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Public GitHub repositories only
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            id="github-repo-url"
            type="url"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <button
          type="submit"
          disabled={isAnalyzing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Analyze Repository
            </>
          )}
        </button>
      </form>

      {displayError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </section>
  );
}
