# Envix — AI-Powered Developer Environment Recovery Platform

**Team:** Repo Reapers  
**Product:** Envix  

---

## Problem Statement
Old, abandoned, or poorly documented Python repositories frequently fail to install or run on modern developer machines due to:
- Incompatible or undeclared Python versions
- Conflicting or yanked package dependencies
- Missing packages or outdated build configurations
- Cryptic `pip` and Python tracebacks

Debugging these failures directly on a developer's host machine risks polluting local environments or running untrusted build scripts.

---

## Proposed Solution
**Envix** clones a public GitHub Python repository into an isolated workspace, statically inspects its configuration without executing code, reproduces dependency installation and project execution inside disposable Docker containers (with explicit user approval), captures real logs and exit codes, and uses **Groq AI** on sanitized logs to explain root causes and generate downloadable fix proposals.

---

## Key Features
- **Local System Inspector (`GET /api/system-info`)**: Detects real OS, CPU architecture/cores, available RAM, Python, Git, Docker CLI, and Docker Engine status.
- **Static GitHub Repository Analyzer (`POST /api/analyze`)**: Validates public HTTPS GitHub URLs, shallow-clones into `workspace/<run_id>/repo`, and statically inspects `requirements.txt`, `pyproject.toml`, `setup.cfg`, `setup.py` (AST-only), `Dockerfile`, and Python `__main__` entry points without executing repository code.
- **Isolated Docker Environment Simulation (`POST /api/prepare`)**: Selects an allowlisted official Python slim image, discloses defaults when Python version is unknown, builds in a separate `build_context/` (never overwriting the original `Dockerfile`), and runs `pip install` only after explicit user approval.
- **Controlled Project Execution Engine (`POST /api/execute`)**: Runs user-confirmed commands in a disposable, network-disabled container with CPU, memory, PID, and timeout limits, capturing real `stdout`, `stderr`, duration, and exit code.
- **Groq AI Diagnosis & Downloadable Fixes (`POST /api/ai/explain`)**: Strips secrets/tokens from logs before sending to Groq, treats logs as untrusted data, explains root causes in plain English, and generates downloadable fix files (never auto-applied).
- **Final Recovery Report (`GET /api/report/{run_id}`)**: Summarizes all verified stages and lets the user export a JSON report.

---

## Technology Stack
- **Frontend:** React, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Python, FastAPI, Uvicorn, Pydantic, `python-dotenv`
- **Repository Handling:** Git CLI
- **Environment Simulation:** Docker Desktop & Docker SDK for Python (`docker`)
- **AI Diagnosis:** Groq Python SDK (`groq`) with configurable `GROQ_MODEL`
- **Testing:** `pytest`, `httpx`

---

## Architecture

```text
[React + Vite Dashboard]
         │  (HTTP / JSON)
         ▼
[FastAPI Backend (backend/app/main.py)]
  ├── backend/agent/system_inspector.py      -> OS, CPU, RAM, Python, Git, Docker status
  ├── backend/analyzer/repository_analyzer.py -> URL validation, git clone, static AST/TOML/CFG scan
  ├── backend/docker_manager/
  │     ├── compatibility.py                 -> Python base image & pip command selection
  │     ├── environment_builder.py           -> Isolated Docker build & approved pip install
  │     └── docker_runner.py                 -> Network-disabled execution, timeouts, cleanup
  └── backend/ai/groq_assistant.py           -> Log secret sanitization & Groq AI diagnosis
```

---

## Installation Instructions

### Prerequisites
- **Python 3.11+** (tested on Python 3.13.7)
- **Node.js 18+** (tested on Node v24.20.0)
- **Git** installed and on `PATH`
- **Docker Desktop** installed and running

### 1. Backend Setup
```powershell
cd "c:\Users\Santhosh reddy\OneDrive\Desktop\Repo-Reapers\backend"
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
copy .env.example .env
```
Edit `backend/.env` and set your `GROQ_API_KEY` and `GROQ_MODEL` (for example `openai/gpt-oss-120b`).  
*(Note: If `GROQ_API_KEY` is omitted, Envix still works for system inspection, cloning, static analysis, and Docker execution.)*

### 2. Frontend Setup
```powershell
cd "c:\Users\Santhosh reddy\OneDrive\Desktop\Repo-Reapers\frontend"
npm.cmd install
```

---

## Windows Startup Instructions

Open two PowerShell terminals:

**Terminal 1 — Start FastAPI Backend:**
```powershell
cd "c:\Users\Santhosh reddy\OneDrive\Desktop\Repo-Reapers\backend"
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Start React (Vite) Frontend:**
```powershell
cd "c:\Users\Santhosh reddy\OneDrive\Desktop\Repo-Reapers\frontend"
npm.cmd run dev
```
*(Using `npm.cmd` avoids Windows PowerShell `npm.ps1` execution policy restrictions.)*

Open **http://127.0.0.1:5173/** in your browser.

### Running Tests
```powershell
cd "c:\Users\Santhosh reddy\OneDrive\Desktop\Repo-Reapers\backend"
.\.venv\Scripts\pytest.exe -v
```

---

## Supported Repository Limitations
- Public HTTPS `github.com` repositories only (private/SSH repositories are rejected).
- Dependency extraction supports `requirements.txt`, `pyproject.toml`, `setup.cfg`, and literal `setup.py` AST inspection.
- Repositories exceeding 5,000 files or 100 MB are truncated during static inspection.
- Docker base images are restricted to allowlisted official Python slim images (`3.9`–`3.13`).

## Security Limitations
- **Docker is not perfect security:** Container isolation reduces risk compared to running untrusted code directly on your host, but kernel-level container escapes are theoretically possible.
- **Dependency installation executes build scripts:** `pip install` can run arbitrary `setup.py` / PEP 517 build hooks inside the container, which is why Envix requires explicit user approval first.
- **Network rules:** Network access is enabled only during approved `pip install` and disabled (`network_disabled=True`) during project execution.
- **No auto-apply:** AI-suggested fixes are never automatically written to the repository or executed.

---

## 5-Minute Hackathon Demonstration Script
1. **0:00 – 0:45 | Problem & Dashboard Overview:** Open `http://127.0.0.1:5173/`. Point out the **System Status** panel showing live Python, Git, Docker CLI, and Docker Engine checks on Windows.
2. **0:45 – 1:45 | Static Repository Analysis:** Paste `https://github.com/pypa/sampleproject` and click **Analyze Repository**. Show the detected `pyproject.toml`, declared Python version (`>=3.9`), `peppercorn` dependency, and candidate entry point (`sample`)—without running any code.
3. **1:45 – 3:00 | Approved Docker Build & Execution:** Check the dependency approval box and click **Approve & Install Dependencies**. Show real `pip` logs in **Dependency Installation Logs**. Then confirm the execution command (`sample`), check approval, and click **Execute Project** to show real `stdout`, `exit_code: 0`, and `duration_seconds`.
4. **3:00 – 4:15 | Reproducing a Failure & AI Diagnosis:** Trigger or show a failing dependency/runtime run, then click **Diagnose with Groq AI**. Show how Envix strips secrets, explains the root cause in plain English, quotes exact log evidence, and provides a **Download Fix** button.
5. **4:15 – 5:00 | Final Report & Safety Wrap-up:** Show the **Final Report** panel and click **Download Report (JSON)**. Highlight that original files are never overwritten and AI never runs commands automatically.

---

## Team Information
- **Team Name:** Repo Reapers
- **Product:** Envix — AI-Powered Developer Environment Recovery Platform
