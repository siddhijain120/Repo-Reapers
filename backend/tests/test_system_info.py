"""Tests for the Envix local system inspector and /api/system-info endpoint."""

import asyncio
from unittest.mock import patch

from docker.errors import DockerException
import httpx

from agent import system_inspector
from app.main import app


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.get(path)


def test_system_info_endpoint_returns_real_structure() -> None:
    response = asyncio.run(_get("/api/system-info"))
    assert response.status_code == 200

    data = response.json()
    for key in ("os", "cpu", "memory", "python", "git", "docker_cli", "docker_engine"):
        assert key in data

    assert data["python"]["installed"] is True
    assert isinstance(data["python"]["version"], str)
    assert isinstance(data["git"]["installed"], bool)
    assert isinstance(data["docker_cli"]["installed"], bool)
    assert isinstance(data["docker_engine"]["connected"], bool)
    assert "groq_api_key" not in str(data).lower()


def test_missing_git_and_docker_are_handled_gracefully() -> None:
    with (
        patch.object(system_inspector.shutil, "which", return_value=None),
        patch.object(
            system_inspector.docker,
            "from_env",
            side_effect=DockerException("Docker daemon not running"),
        ),
    ):
        info = system_inspector.get_system_info()

    assert info["git"]["installed"] is False
    assert info["git"]["version"] is None
    assert info["docker_cli"]["installed"] is False
    assert info["docker_cli"]["version"] is None
    assert info["docker_engine"]["connected"] is False
    assert info["docker_engine"]["server_version"] is None
    assert "not running" in (info["docker_engine"]["error"] or "")
