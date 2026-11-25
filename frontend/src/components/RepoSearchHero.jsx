import { useState } from "react";
import { AlertCircle, BookMarked, GitBranch, Loader2, Search } from "lucide-react";

const GITHUB_PUBLIC_REPO_REGEX =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;

export function RepoSearchHero({
  compact = false,
  backendConnected,
  isAnalyzing,
  analysisError,
  onAnalyze,
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  const submitUrl = async (urlToUse) => {
    setValidationError("");
    const trimmed = urlToUse.trim();

    if (!trimmed) {
      setValidationError("Enter a public GitHub repository URL to begin.");
      return;
    }
    if (!GITHUB_PUBLIC_REPO_REGEX.test(trimmed)) {
      setValidationError(
        "Use a public GitHub repository root URL like https://github.com/owner/repo"
      );
      return;
    }
    if (!backendConnected) {
      setValidationError(
        "Local Agent is offline. Start the FastAPI backend and click Refresh."
      );
      return;
    }

    await onAnalyze(trimmed);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitUrl(repoUrl);
  };

  const errorText = validationError || analysisError;

  if (compact) {
    return (
      <div className="w-full sm:w-auto sm:min-w-[360px]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-secondary)]" />
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder="Switch repo: https://github.com/owner/repo"
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] py-1.5 pl-9 pr-3 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Analyze"
            )}
          </button>
        </form>
        {errorText && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--accent-red)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-14 sm:py-20">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-blue)]">
          <BookMarked className="h-4 w-4" />
          <span>Envix Workbench</span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Test and fix Python repositories in Docker
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          Paste any public GitHub Python repository URL. Envix clones it
          locally, inspects dependencies without running code, tests the build
          in Docker, and explains errors with Groq AI.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex flex-1 items-center">
            <GitBranch className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--text-secondary)]" />
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
              className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent-green)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-green-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Repository"
            )}
          </button>
        </form>

        {errorText && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[var(--accent-red-border)] bg-[var(--accent-red-bg)] px-3.5 py-2.5 text-sm text-[var(--accent-red)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]">
          <span>Try sample:</span>
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => {
              const sample = "https://github.com/pypa/sampleproject";
              setRepoUrl(sample);
              submitUrl(sample);
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--accent-blue)] transition hover:border-[var(--accent-blue)]"
          >
            pypa/sampleproject
          </button>
        </div>
      </div>
    </div>
  );
}
