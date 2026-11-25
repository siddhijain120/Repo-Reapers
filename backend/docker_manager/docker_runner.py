"""Isolated Docker project execution engine.

Security properties:
- Requires explicit user approval before executing any project command.
- Rejects shell metacharacters and executes argv directly (no shell=True / sh -c).
- Disables runtime network access by default (network_disabled=True).
- Never uses privileged mode, never mounts host Docker socket, secrets, or folders.
- Enforces CPU, memory, PID, and configurable timeout limits, and cleans up containers.
"""

import json
import shlex
import time
from typing import Any

import docker
from docker.errors import DockerException

from docker_manager.environment_builder import (
    ApprovalRequiredError,
    DockerUnavailableError,
    WorkspaceNotFoundError,
    _validate_run_id,
)

MIN_TIMEOUT_SECONDS = 5
MAX_TIMEOUT_SECONDS = 120
DEFAULT_TIMEOUT_SECONDS = 30
RUNTIME_MEM_LIMIT = "512m"
RUNTIME_NANO_CPUS = 1_000_000_000
RUNTIME_PIDS_LIMIT = 128

_FORBIDDEN_SHELL_TOKENS = (";", "&&", "||", "|", "`", "$(", ">", "<", "\n", "\r")


class InvalidCommandError(ValueError):
    """Raised when an execution command is empty, malformed, or unsafe."""


class PreparedImageMissingError(RuntimeError):
    """Raised when no prepared Docker image exists for the given run_id."""


def validate_execution_command(raw_command: str, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS) -> tuple[list[str], int]:
    """Validate and split a user-confirmed execution command without shell interpolation."""
    if not raw_command or not raw_command.strip():
        raise InvalidCommandError("Execution command is required.")

    cleaned = raw_command.strip()
    for token in _FORBIDDEN_SHELL_TOKENS:
        if token in cleaned:
            raise InvalidCommandError(
                f"Shell operator '{token}' is not allowed in execution commands."
            )

    try:
        argv = shlex.split(cleaned, posix=True)
    except ValueError as exc:
        raise InvalidCommandError(f"Invalid command syntax: {exc}") from exc

    if not argv:
        raise InvalidCommandError("Execution command cannot be empty.")

    if timeout_seconds < MIN_TIMEOUT_SECONDS or timeout_seconds > MAX_TIMEOUT_SECONDS:
        raise InvalidCommandError(
            f"Timeout must be between {MIN_TIMEOUT_SECONDS} and {MAX_TIMEOUT_SECONDS} seconds."
        )

    return argv, timeout_seconds


def execute_in_container(
    run_id: str,
    command: str,
    approved: bool,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Run the confirmed project command inside its prepared disposable Docker container."""
    if not approved:
        raise ApprovalRequiredError(
            "Explicit user approval is required before executing repository code."
        )

    argv, bounded_timeout = validate_execution_command(command, timeout_seconds)
    run_dir = _validate_run_id(run_id)

    prepare_file = run_dir / "prepare.json"
    if not prepare_file.is_file():
        raise PreparedImageMissingError(
            "No prepared Docker environment found. Run environment preparation first."
        )

    prepare_data = json.loads(prepare_file.read_text(encoding="utf-8"))
    image_id = prepare_data.get("image_id")
    if not image_id:
        # Fall back to prep image if dependency install failed but base prep image exists
        image_id = f"envix-prep-{run_id}:latest"

    client = None
    container = None

    try:
        client = docker.from_env(timeout=bounded_timeout + 10)
        client.ping()
    except DockerException as exc:
        raise DockerUnavailableError(
            f"Docker Engine is not reachable: {exc}"
        ) from exc

    start_time = time.monotonic()
    timed_out = False
    exit_code: int | None = None
    stdout_text = ""
    stderr_text = ""
    failure_details: str | None = None

    try:
        container = client.containers.run(
            image=image_id,
            command=argv,
            detach=True,
            privileged=False,
            cap_drop=["ALL"],
            network_disabled=True,  # Disable runtime network access by default
            mem_limit=RUNTIME_MEM_LIMIT,
            nano_cpus=RUNTIME_NANO_CPUS,
            pids_limit=RUNTIME_PIDS_LIMIT,
            working_dir="/app",
        )

        try:
            wait_result = container.wait(timeout=bounded_timeout)
            exit_code = int(wait_result.get("StatusCode", -1))
        except Exception:
            timed_out = True
            failure_details = (
                f"Execution exceeded {bounded_timeout}s timeout and was stopped."
            )
            try:
                container.kill()
            except Exception:
                pass

        stdout_text = container.logs(stdout=True, stderr=False).decode(
            "utf-8", errors="replace"
        )
        stderr_text = container.logs(stdout=False, stderr=True).decode(
            "utf-8", errors="replace"
        )

        duration_seconds = round(time.monotonic() - start_time, 3)

        if timed_out:
            execution_status = "timed_out"
        elif exit_code == 0:
            execution_status = "success"
        else:
            execution_status = "failed"
            last_err = (
                stderr_text.strip().splitlines()[-1]
                if stderr_text.strip()
                else f"Process exited with code {exit_code}."
            )
            failure_details = last_err

        result = {
            "run_id": run_id,
            "command": command.strip(),
            "image_id": image_id,
            "execution_status": execution_status,
            "exit_code": exit_code,
            "timed_out": timed_out,
            "duration_seconds": duration_seconds,
            "timeout_seconds": bounded_timeout,
            "network_disabled": True,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "failure_details": failure_details,
        }

        (run_dir / "execution.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        return result

    except DockerException as exc:
        raise PreparedImageMissingError(
            f"Could not run container using image '{image_id}': {exc}"
        ) from exc
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                pass
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
