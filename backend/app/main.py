"""FastAPI application entry point for Envix."""

from datetime import datetime, timezone
import platform
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent.system_inspector import get_system_info
from ai.groq_assistant import diagnose_run_with_groq
from analyzer.repository_analyzer import (
    InvalidRepositoryURLError,
    RepositoryCloneError,
    analyze_repository,
)
from app.config import settings
from docker_manager.docker_runner import (
    DEFAULT_TIMEOUT_SECONDS,
    InvalidCommandError,
    PreparedImageMissingError,
    execute_in_container,
)
from docker_manager.environment_builder import (
    ApprovalRequiredError,
    DockerUnavailableError,
    WorkspaceNotFoundError,
    prepare_and_install_environment,
)


class AnalyzeRequest(BaseModel):
    """Request payload for repository analysis."""

    repo_url: str


class PrepareRequest(BaseModel):
    """Request payload for approved Docker environment preparation and pip install."""

    run_id: str
    approved: bool = False
    python_version: str | None = None


class ExecuteRequest(BaseModel):
    """Request payload for approved project execution inside Docker."""

    run_id: str
    command: str
    approved: bool = False
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS


class AIExplainRequest(BaseModel):
    """Request payload for Groq AI log diagnosis."""

    run_id: str

app = FastAPI(
    title=f"{settings.app_name} API",
    description=settings.subtitle,
    version=settings.version,
)

# Allow the local React (Vite) dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def get_health() -> dict:
    """Return real-time backend health and active milestone capabilities."""
    return {
        "status": "healthy",
        "service": f"{settings.app_name} Backend",
        "team": settings.team_name,
        "version": settings.version,
        "environment": settings.environment,
        "python_version": platform.python_version(),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "groq_configured": bool(settings.groq_api_key),
        "capabilities": {
            "health": True,
            "system_info": True,
            "repo_analysis": True,
            "docker_simulation": True,
            "ai_diagnosis": True,
        },
    }


@app.get("/api/system-info")
def get_system_status() -> dict:
    """Return real-time local OS, CPU, RAM, Python, Git, and Docker status."""
    return get_system_info()


@app.post("/api/analyze")
def analyze_repo_endpoint(payload: AnalyzeRequest) -> dict:
    """Clone and statically analyze a public GitHub Python repository."""
    try:
        return analyze_repository(payload.repo_url)
    except InvalidRepositoryURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RepositoryCloneError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/prepare")
def prepare_environment_endpoint(payload: PrepareRequest) -> dict:
    """Build an isolated Docker environment and run approved dependency installation."""
    try:
        return prepare_and_install_environment(
            run_id=payload.run_id,
            approved=payload.approved,
            python_version=payload.python_version,
        )
    except ApprovalRequiredError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DockerUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/ai/explain")
def ai_explain_endpoint(payload: AIExplainRequest) -> dict:
    """Analyze sanitized installation and runtime logs using Groq AI."""
    try:
        return diagnose_run_with_groq(payload.run_id)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/report/{run_id}")
def get_final_report(run_id: str) -> dict:
    """Assemble the final recovery report from persisted M3-M6 artifacts."""
    import json
    from docker_manager.environment_builder import _validate_run_id

    try:
        run_dir = _validate_run_id(run_id)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    def _load(name: str) -> dict | None:
        p = run_dir / name
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None

    return {
        "run_id": run_id,
        "analysis": _load("analysis.json"),
        "prepare": _load("prepare.json"),
        "execution": _load("execution.json"),
        "diagnosis": _load("diagnosis.json"),
    }


@app.post("/api/execute")
def execute_project_endpoint(payload: ExecuteRequest) -> dict:
    """Run the confirmed project command inside its prepared disposable container."""
    try:
        return execute_in_container(
            run_id=payload.run_id,
            command=payload.command,
            approved=payload.approved,
            timeout_seconds=payload.timeout_seconds,
        )
    except (ApprovalRequiredError, InvalidCommandError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (WorkspaceNotFoundError, PreparedImageMissingError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DockerUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/ai/explain")
def ai_explain_endpoint(payload: AIExplainRequest) -> dict:
    """Analyze sanitized installation and runtime logs using Groq AI."""
    try:
        return diagnose_run_with_groq(payload.run_id)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/report/{run_id}")
def get_final_report(run_id: str) -> dict:
    """Assemble the final recovery report from persisted M3-M6 artifacts."""
    import json
    from docker_manager.environment_builder import _validate_run_id

    try:
        run_dir = _validate_run_id(run_id)
    except WorkspaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    def _load(name: str) -> dict | None:
        p = run_dir / name
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None

    return {
        "run_id": run_id,
        "analysis": _load("analysis.json"),
        "prepare": _load("prepare.json"),
        "execution": _load("execution.json"),
        "diagnosis": _load("diagnosis.json"),
    }
