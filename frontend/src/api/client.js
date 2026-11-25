const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * Fetch real-time health status from the Envix FastAPI backend.
 */
export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch real local system information (OS, CPU, RAM, Python, Git, Docker).
 */
export async function fetchSystemInfo() {
  const response = await fetch(`${API_BASE_URL}/api/system-info`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`System info endpoint returned HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Clone and statically analyze a public GitHub repository.
 */
export async function analyzeRepository(repoUrl) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ repo_url: repoUrl }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail || `Analysis failed with HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

/**
 * Prepare an isolated Docker environment and run approved dependency installation.
 */
export async function prepareEnvironment({ runId, approved, pythonVersion }) {
  const response = await fetch(`${API_BASE_URL}/api/prepare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      run_id: runId,
      approved,
      python_version: pythonVersion || null,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload?.detail || `Environment preparation failed with HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

/**
 * Execute the confirmed project command inside its prepared Docker container.
 */
export async function executeProject({
  runId,
  command,
  approved,
  timeoutSeconds,
}) {
  const response = await fetch(`${API_BASE_URL}/api/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      run_id: runId,
      command,
      approved,
      timeout_seconds: Number(timeoutSeconds) || 30,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload?.detail || `Execution failed with HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

/**
 * Request Groq AI root-cause diagnosis and proposed fixes from sanitized logs.
 */
export async function explainWithAI(runId) {
  const response = await fetch(`${API_BASE_URL}/api/ai/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ run_id: runId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload?.detail || `AI diagnosis failed with HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}
