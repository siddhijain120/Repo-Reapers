import { useCallback, useEffect, useState } from "react";
import { BookMarked } from "lucide-react";
import {
  analyzeRepository,
  executeProject,
  explainWithAI,
  fetchHealth,
  fetchSystemInfo,
  prepareEnvironment,
} from "./api/client";
import { ConsolePanel } from "./components/ConsolePanel";
import { RepoSearchHero } from "./components/RepoSearchHero";
import { StageWorkspace } from "./components/StageWorkspace";
import { TopNav } from "./components/TopNav";
import { WorkflowStepper } from "./components/WorkflowStepper";

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("envix-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("envix-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const [healthState, setHealthState] = useState({
    status: "loading",
    data: null,
    error: null,
  });
  const [systemInfoState, setSystemInfoState] = useState({
    status: "loading",
    data: null,
    error: null,
  });

  const [activeStep, setActiveStep] = useState("analysis");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const [prepareResult, setPrepareResult] = useState(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState("");
  const [executeResult, setExecuteResult] = useState(null);

  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [diagnosisResult, setDiagnosisResult] = useState(null);

  const checkBackendHealth = useCallback(async () => {
    setHealthState((prev) => ({ ...prev, status: "loading", error: null }));
    setSystemInfoState((prev) => ({ ...prev, status: "loading", error: null }));

    const [healthResult, sysResult] = await Promise.allSettled([
      fetchHealth(),
      fetchSystemInfo(),
    ]);

    if (healthResult.status === "fulfilled") {
      setHealthState({
        status: "connected",
        data: healthResult.value,
        error: null,
      });
    } else {
      setHealthState({
        status: "error",
        data: null,
        error:
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : "Unable to reach backend",
      });
    }

    if (sysResult.status === "fulfilled") {
      setSystemInfoState({
        status: "connected",
        data: sysResult.value,
        error: null,
      });
    } else {
      setSystemInfoState({
        status: "error",
        data: null,
        error:
          sysResult.reason instanceof Error
            ? sysResult.reason.message
            : "Unable to inspect local system",
      });
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const handleResetHome = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisError("");
    setPrepareResult(null);
    setPrepareError("");
    setExecuteResult(null);
    setExecuteError("");
    setDiagnosisResult(null);
    setDiagnosisError("");
    setActiveStep("analysis");
  }, []);

  const handleAnalyzeRepository = useCallback(async (repoUrl) => {
    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setPrepareError("");
    setPrepareResult(null);
    setExecuteError("");
    setExecuteResult(null);
    setDiagnosisError("");
    setDiagnosisResult(null);
    try {
      const data = await analyzeRepository(repoUrl);
      setAnalysisResult(data);
      setActiveStep("analysis");
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Repository analysis failed"
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handlePrepareEnvironment = useCallback(
    async (runId, approved, pythonVersion) => {
      setIsPreparing(true);
      setPrepareError("");
      setPrepareResult(null);
      setExecuteError("");
      setExecuteResult(null);
      try {
        const data = await prepareEnvironment({
          runId,
          approved,
          pythonVersion,
        });
        setPrepareResult(data);
      } catch (err) {
        setPrepareError(
          err instanceof Error ? err.message : "Environment preparation failed"
        );
      } finally {
        setIsPreparing(false);
      }
    },
    []
  );

  const handleExecuteProject = useCallback(
    async (runId, command, approved, timeoutSeconds) => {
      setIsExecuting(true);
      setExecuteError("");
      setExecuteResult(null);
      try {
        const data = await executeProject({
          runId,
          command,
          approved,
          timeoutSeconds,
        });
        setExecuteResult(data);
      } catch (err) {
        setExecuteError(
          err instanceof Error ? err.message : "Project execution failed"
        );
      } finally {
        setIsExecuting(false);
      }
    },
    []
  );

  const handleDiagnoseWithAI = useCallback(async (runId) => {
    setIsDiagnosing(true);
    setDiagnosisError("");
    setDiagnosisResult(null);
    try {
      const data = await explainWithAI(runId);
      setDiagnosisResult(data);
    } catch (err) {
      setDiagnosisError(
        err instanceof Error ? err.message : "AI diagnosis failed"
      );
    } finally {
      setIsDiagnosing(false);
    }
  }, []);

  const steps = [
    {
      id: "analysis",
      label: "Code & Analysis",
      enabled: Boolean(analysisResult),
      done: Boolean(analysisResult),
    },
    {
      id: "install",
      label: "Build & Deps",
      enabled: Boolean(analysisResult),
      done: Boolean(prepareResult),
    },
    {
      id: "execute",
      label: "Run & Logs",
      enabled: Boolean(prepareResult),
      done: Boolean(executeResult),
    },
    {
      id: "diagnose",
      label: "AI Diagnosis",
      enabled: Boolean(prepareResult || executeResult),
      done: Boolean(diagnosisResult),
    },
    {
      id: "report",
      label: "Final Report",
      enabled: Boolean(analysisResult),
      done: Boolean(diagnosisResult || executeResult),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopNav
        theme={theme}
        onToggleTheme={toggleTheme}
        healthState={healthState}
        systemInfoState={systemInfoState}
        onRefresh={checkBackendHealth}
        onResetHome={handleResetHome}
      />

      {!analysisResult ? (
        <main className="mx-auto max-w-7xl px-4 sm:px-6">
          <RepoSearchHero
            compact={false}
            backendConnected={healthState.status === "connected"}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            onAnalyze={handleAnalyzeRepository}
          />
        </main>
      ) : (
        <>
          <div className="bg-[var(--bg-header)] pt-4">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <BookMarked className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-base font-semibold text-[var(--accent-blue)]">
                  {analysisResult.repo_name}
                </span>
                <span className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                  Public
                </span>
                <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
                  run: {analysisResult.run_id}
                </span>
              </div>

              <RepoSearchHero
                compact={true}
                backendConnected={healthState.status === "connected"}
                isAnalyzing={isAnalyzing}
                analysisError={analysisError}
                onAnalyze={handleAnalyzeRepository}
              />
            </div>

            <WorkflowStepper
              steps={steps}
              activeStep={activeStep}
              onSelectStep={setActiveStep}
            />
          </div>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <StageWorkspace
                  activeStep={activeStep}
                  onSelectStep={setActiveStep}
                  analysis={analysisResult}
                  isPreparing={isPreparing}
                  prepareError={prepareError}
                  prepareResult={prepareResult}
                  onPrepare={handlePrepareEnvironment}
                  isExecuting={isExecuting}
                  executeError={executeError}
                  executeResult={executeResult}
                  onExecute={handleExecuteProject}
                  isDiagnosing={isDiagnosing}
                  diagnosisError={diagnosisError}
                  diagnosisResult={diagnosisResult}
                  onDiagnose={handleDiagnoseWithAI}
                />
              </div>

              <div className="lg:col-span-5">
                <ConsolePanel
                  isPreparing={isPreparing}
                  prepareResult={prepareResult}
                  isExecuting={isExecuting}
                  executeResult={executeResult}
                />
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
}
