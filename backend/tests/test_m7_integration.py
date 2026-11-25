"""M7 integration tests for failure modes, report assembly, and graceful degradation."""

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from docker.errors import DockerException
from groq import APIConnectionError
import httpx

from ai import groq_assistant
from app.main import app
from docker_manager import compatibility, environment_builder


async def _get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.get(path)


async def _post(path: str, json_body: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post(path, json=json_body)


def test_prepare_returns_503_when_docker_unavailable(tmp_path: Path) -> None:
    run_dir = tmp_path / "abcdef123456"
    (run_dir / "repo").mkdir(parents=True)
    (run_dir / "analysis.json").write_text(
        '{"run_id": "abcdef123456", "python_version": {"status": "unknown"}, "detected_config_files": []}',
        encoding="utf-8",
    )

    with (
        patch.object(environment_builder, "WORKSPACE_ROOT", tmp_path),
        patch.object(
            environment_builder.docker,
            "from_env",
            side_effect=DockerException("Cannot connect to the Docker daemon"),
        ),
    ):
        response = asyncio.run(
            _post("/api/prepare", {"run_id": "abcdef123456", "approved": True})
        )

    assert response.status_code == 503
    assert "docker" in response.json()["detail"].lower()


def test_ai_explain_handles_groq_connection_error_gracefully(tmp_path: Path) -> None:
    run_dir = tmp_path / "abcdef123456"
    run_dir.mkdir()
    (run_dir / "analysis.json").write_text('{"repo_name": "a/b"}', encoding="utf-8")

    fake_settings = SimpleNamespace(
        groq_api_key="gsk_test_dummy_key_123456",
        groq_model="openai/gpt-oss-120b",
    )

    class _FailingGroq:
        def __init__(self, api_key: str) -> None:
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(
                    create=lambda **kwargs: (_ for _ in ()).throw(
                        APIConnectionError(request=httpx.Request("POST", "https://api.groq.com"))
                    )
                )
            )

    with (
        patch.object(groq_assistant, "_validate_run_id", return_value=run_dir),
        patch.object(groq_assistant, "settings", fake_settings),
        patch.object(groq_assistant, "Groq", _FailingGroq),
    ):
        response = asyncio.run(_post("/api/ai/explain", {"run_id": "abcdef123456"}))

    assert response.status_code == 200
    data = response.json()
    assert data["ai_available"] is False
    assert "error" in data and data["error"] is not None


def test_select_install_command_without_requirements_txt() -> None:
    no_deps = compatibility.select_install_command({"detected_config_files": ["README.md"]})
    assert no_deps["has_dependencies"] is False
    assert no_deps["command"] is None


def test_report_endpoint_assembles_persisted_artifacts(tmp_path: Path) -> None:
    run_dir = tmp_path / "abcdef123456"
    run_dir.mkdir()
    (run_dir / "analysis.json").write_text('{"repo_name": "a/b"}', encoding="utf-8")
    (run_dir / "prepare.json").write_text('{"selected_image": "python:3.11-slim"}', encoding="utf-8")

    with patch.object(environment_builder, "WORKSPACE_ROOT", tmp_path):
        response = asyncio.run(_get("/api/report/abcdef123456"))

    assert response.status_code == 200
    data = response.json()
    assert data["analysis"]["repo_name"] == "a/b"
    assert data["prepare"]["selected_image"] == "python:3.11-slim"
    assert data["execution"] is None
