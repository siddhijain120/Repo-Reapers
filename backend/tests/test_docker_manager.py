"""Tests for Docker compatibility selection, safety guards, and /api/prepare."""

import asyncio
from pathlib import Path

import httpx
import pytest

from app.main import app
from docker_manager.compatibility import select_install_command, select_python_image
from docker_manager.environment_builder import (
    ApprovalRequiredError,
    _prepare_build_context,
    _validate_run_id,
    WorkspaceNotFoundError,
    prepare_and_install_environment,
)


async def _post(path: str, json_body: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post(path, json=json_body)


def test_select_python_image_respects_declared_and_discloses_default() -> None:
    declared = select_python_image(
        {"python_version": {"status": "detected", "declared": ">=3.12"}}
    )
    assert declared["image"] == "python:3.13-slim"
    assert declared["source"] == "declared"

    unknown = select_python_image({"python_version": {"status": "unknown"}})
    assert unknown["image"] == "python:3.11-slim"
    assert unknown["source"] == "default"
    assert "defaulted" in unknown["disclosure"].lower()


def test_select_python_image_rejects_arbitrary_images() -> None:
    with pytest.raises(ValueError):
        select_python_image({}, user_selected_version="3.11-alpine; rm -rf /")


def test_select_install_command_prefers_requirements_txt() -> None:
    plan = select_install_command(
        {"detected_config_files": ["README.md", "requirements.txt", "pyproject.toml"]}
    )
    assert plan["has_dependencies"] is True
    assert plan["command_display"] == "pip install --no-cache-dir -r requirements.txt"


def test_prepare_requires_explicit_approval() -> None:
    with pytest.raises(ApprovalRequiredError):
        prepare_and_install_environment(run_id="abcdef123456", approved=False)

    response = asyncio.run(
        _post("/api/prepare", {"run_id": "abcdef123456", "approved": False})
    )
    assert response.status_code == 400
    assert "approval" in response.json()["detail"].lower()


def test_validate_run_id_blocks_path_traversal() -> None:
    with pytest.raises(WorkspaceNotFoundError):
        _validate_run_id("../secret")


def test_prepare_build_context_does_not_overwrite_repo_dockerfile(tmp_path: Path) -> None:
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    original_dockerfile = repo_dir / "Dockerfile"
    original_dockerfile.write_text("FROM python:3.8\n# original\n", encoding="utf-8")

    build_ctx = tmp_path / "build_context"
    generated_df = _prepare_build_context(repo_dir, build_ctx, "python:3.11-slim")

    assert generated_df.exists()
    assert "FROM python:3.11-slim" in generated_df.read_text(encoding="utf-8")
    assert original_dockerfile.read_text(encoding="utf-8") == "FROM python:3.8\n# original\n"
