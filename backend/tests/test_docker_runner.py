"""Tests for the isolated Docker project execution engine and /api/execute."""

import asyncio

import httpx
import pytest

from app.main import app
from docker_manager.docker_runner import (
    InvalidCommandError,
    execute_in_container,
    validate_execution_command,
)
from docker_manager.environment_builder import ApprovalRequiredError


async def _post(path: str, json_body: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post(path, json=json_body)


def test_execute_requires_explicit_approval() -> None:
    with pytest.raises(ApprovalRequiredError):
        execute_in_container(run_id="abcdef123456", command="python app.py", approved=False)

    response = asyncio.run(
        _post("/api/execute", {"run_id": "abcdef123456", "command": "python app.py", "approved": False})
    )
    assert response.status_code == 400
    assert "approval" in response.json()["detail"].lower()


@pytest.mark.parametrize(
    "bad_cmd",
    [
        "",
        "python app.py; rm -rf /",
        "python app.py && whoami",
        "python app.py | cat",
        "python $(whoami).py",
        "python app.py > out.txt",
    ],
)
def test_validate_execution_command_blocks_shell_injection(bad_cmd: str) -> None:
    with pytest.raises(InvalidCommandError):
        validate_execution_command(bad_cmd, timeout_seconds=30)


def test_validate_execution_command_enforces_timeout_bounds() -> None:
    with pytest.raises(InvalidCommandError):
        validate_execution_command("python app.py", timeout_seconds=1)
    with pytest.raises(InvalidCommandError):
        validate_execution_command("python app.py", timeout_seconds=999)

    argv, timeout = validate_execution_command("python -m sample", timeout_seconds=20)
    assert argv == ["python", "-m", "sample"]
    assert timeout == 20
