"""Isolated Docker environment builder and dependency installer.

Security properties:
- Requires explicit user approval before running pip install.
- Never overwrites the original repository Dockerfile.
- Never mounts host folders, host secrets, or the host Docker socket.
- Never runs privileged containers.
- Enforces memory, CPU, PID, and timeout limits and cleans up temporary resources.
"""

import json
from pathlib import Path
import re
import shutil
from typing import Any

import docker
from docker.errors import DockerException

from analyzer.repository_analyzer import WORKSPACE_ROOT
from docker_manager.compatibility import select_install_command, select_python_image

_RUN_ID_RE = re.compile(r"^[a-f0-9]{6,32}$")
BUILD_TIMEOUT_SECONDS = 180
INSTALL_TIMEOUT_SECONDS = 180
CONTAINER_MEM_LIMIT = "1g"
CONTAINER_NANO_CPUS = 1_000_000_000  # 1 vCPU
CONTAINER_PIDS_LIMIT = 256


class ApprovalRequiredError(PermissionError):
    """Raised when dependency installation is requested without explicit approval."""


class WorkspaceNotFoundError(FileNotFoundError):
    """Raised when the requested run_id workspace or analysis.json does not exist."""


class DockerUnavailableError(RuntimeError):
    """Raised when the Docker Engine daemon is unreachable."""


def _validate_run_id(run_id: str) -> Path:
    """Validate run_id format and resolve its workspace directory safely."""
    if not run_id or not _RUN_ID_RE.match(run_id):
        raise WorkspaceNotFoundError("Invalid run_id format.")

    root_resolved = WORKSPACE_ROOT.resolve()
    run_dir = (WORKSPACE_ROOT / run_id).resolve()
    if not run_dir.is_relative_to(root_resolved) or not run_dir.is_dir():
        raise WorkspaceNotFoundError(f"Workspace for run_id '{run_id}' was not found.")
    return run_dir


def _generate_dockerfile(base_image: str) -> str:
    """Generate a clean, non-executing Dockerfile for environment preparation."""
    return (
        f"FROM {base_image}\n"
        "ENV PYTHONDONTWRITEBYTECODE=1 \\\n"
        "    PYTHONUNBUFFERED=1 \\\n"
        "    PIP_DISABLE_PIP_VERSION_CHECK=1\n"
        "WORKDIR /app\n"
        "COPY app/ /app/\n"
    )


def _prepare_build_context(repo_dir: Path, build_context_dir: Path, base_image: str) -> Path:
    """Copy repo into an isolated build_context directory and write generated Dockerfile."""
    if build_context_dir.exists():
        shutil.rmtree(build_context_dir, ignore_errors=True)
    build_context_dir.mkdir(parents=True, exist_ok=True)

    target_app_dir = build_context_dir / "app"
    shutil.copytree(
        repo_dir,
        target_app_dir,
        symlinks=False,
        ignore=shutil.ignore_patterns(".git", "__pycache__", ".venv", "venv", "node_modules"),
    )

    dockerfile_path = build_context_dir / "Dockerfile"
    dockerfile_path.write_text(_generate_dockerfile(base_image), encoding="utf-8")
    return dockerfile_path


def prepare_and_install_environment(
    run_id: str,
    approved: bool,
    python_version: str | None = None,
) -> dict[str, Any]:
    """Prepare an isolated Docker image and run approved dependency installation."""
    if not approved:
        raise ApprovalRequiredError(
            "Explicit user approval is required before installing dependencies."
        )

    run_dir = _validate_run_id(run_id)
    repo_dir = run_dir / "repo"
    analysis_file = run_dir / "analysis.json"

    if not repo_dir.is_dir() or not analysis_file.is_file():
        raise WorkspaceNotFoundError(
            f"Analysis results for run_id '{run_id}' are missing. Re-run repository analysis."
        )

    analysis = json.loads(analysis_file.read_text(encoding="utf-8"))
    python_selection = select_python_image(analysis, user_selected_version=python_version)
    install_plan = select_install_command(analysis)
    selected_image = python_selection["image"]

    build_context_dir = run_dir / "build_context"
    prep_tag = f"envix-prep-{run_id}:latest"
    final_repo = f"envix-env-{run_id}"

    logs: list[str] = []
    client = None
    container = None

    try:
        client = docker.from_env(timeout=BUILD_TIMEOUT_SECONDS)
        client.ping()
    except DockerException as exc:
        raise DockerUnavailableError(
            f"Docker Engine is not reachable: {exc}"
        ) from exc

    try:
        _prepare_build_context(repo_dir, build_context_dir, selected_image)
        logs.append(f"[envix] Selected base image: {selected_image}")
        logs.append(f"[envix] {python_selection['disclosure']}")
        logs.append("[envix] Building isolated environment image (original repo untouched)...")

        build_stream = client.api.build(
            path=str(build_context_dir),
            tag=prep_tag,
            rm=True,
            forcerm=True,
            decode=True,
            timeout=BUILD_TIMEOUT_SECONDS,
        )

        build_error: str | None = None
        for chunk in build_stream:
            if "stream" in chunk:
                line = chunk["stream"].rstrip("\r\n")
                if line:
                    logs.append(line)
            if "error" in chunk:
                build_error = str(chunk["error"]).strip()
                logs.append(f"[build-error] {build_error}")

        if build_error:
            return {
                "run_id": run_id,
                "selected_image": selected_image,
                "python_selection": python_selection,
                "environment_preparation_status": "failed",
                "docker_build_status": "failed",
                "dependency_installation_status": "skipped",
                "install_command": install_plan["command_display"],
                "exit_code": None,
                "logs": "\n".join(logs),
                "error_details": build_error,
                "image_id": None,
            }

        prep_image = client.images.get(prep_tag)

        if not install_plan["has_dependencies"]:
            logs.append("[envix] No dependency file detected; skipping pip install.")
            result = {
                "run_id": run_id,
                "selected_image": selected_image,
                "python_selection": python_selection,
                "environment_preparation_status": "success",
                "docker_build_status": "success",
                "dependency_installation_status": "skipped",
                "install_command": None,
                "exit_code": 0,
                "logs": "\n".join(logs),
                "error_details": None,
                "image_id": prep_image.id,
            }
            (run_dir / "prepare.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            return result

        logs.append(f"[envix] Running approved install: {install_plan['command_display']}")
        container = client.containers.run(
            image=prep_tag,
            command=install_plan["command"],
            detach=True,
            privileged=False,
            network_disabled=False,  # Network needed only for pip install
            mem_limit=CONTAINER_MEM_LIMIT,
            nano_cpus=CONTAINER_NANO_CPUS,
            pids_limit=CONTAINER_PIDS_LIMIT,
            working_dir="/app",
        )

        wait_result = container.wait(timeout=INSTALL_TIMEOUT_SECONDS)
        exit_code = int(wait_result.get("StatusCode", -1))
        raw_logs = container.logs(stdout=True, stderr=True).decode(
            "utf-8", errors="replace"
        )
        if raw_logs.strip():
            logs.append(raw_logs.rstrip())

        if exit_code == 0:
            final_image = container.commit(repository=final_repo, tag="latest")
            logs.append(f"[envix] Dependency installation succeeded (image {final_image.short_id}).")
            result = {
                "run_id": run_id,
                "selected_image": selected_image,
                "python_selection": python_selection,
                "environment_preparation_status": "success",
                "docker_build_status": "success",
                "dependency_installation_status": "success",
                "install_command": install_plan["command_display"],
                "exit_code": exit_code,
                "logs": "\n".join(logs),
                "error_details": None,
                "image_id": final_image.id,
            }
            (run_dir / "prepare.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            return result

        error_line = (
            raw_logs.strip().splitlines()[-1]
            if raw_logs.strip()
            else f"pip exited with status code {exit_code}"
        )
        logs.append(f"[envix] Dependency installation failed with exit code {exit_code}.")
        result = {
            "run_id": run_id,
            "selected_image": selected_image,
            "python_selection": python_selection,
            "environment_preparation_status": "success",
            "docker_build_status": "success",
            "dependency_installation_status": "failed",
            "install_command": install_plan["command_display"],
            "exit_code": exit_code,
            "logs": "\n".join(logs),
            "error_details": error_line,
            "image_id": None,
        }
        (run_dir / "prepare.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    except Exception as exc:
        logs.append(f"[envix] Error during environment simulation: {exc}")
        return {
            "run_id": run_id,
            "selected_image": selected_image,
            "python_selection": python_selection,
            "environment_preparation_status": "failed",
            "docker_build_status": "failed",
            "dependency_installation_status": "failed",
            "install_command": install_plan["command_display"],
            "exit_code": None,
            "logs": "\n".join(logs),
            "error_details": str(exc),
            "image_id": None,
        }
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                pass
        if build_context_dir.exists():
            shutil.rmtree(build_context_dir, ignore_errors=True)
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
