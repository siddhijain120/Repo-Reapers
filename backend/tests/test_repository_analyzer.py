"""Tests for the Envix static GitHub repository analyzer and /api/analyze."""

import asyncio
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from analyzer import repository_analyzer
from analyzer.repository_analyzer import (
    InvalidRepositoryURLError,
    _safe_resolve_within,
    analyze_repository,
    validate_github_url,
)
from app.main import app


async def _post(path: str, json_body: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post(path, json=json_body)


def test_validate_github_url_accepts_public_https() -> None:
    clone_url, display, slug = validate_github_url("https://github.com/pallets/flask/")
    assert clone_url == "https://github.com/pallets/flask.git"
    assert display == "pallets/flask"
    assert slug == "flask"


@pytest.mark.parametrize(
    "bad_url",
    [
        "",
        "http://github.com/pallets/flask",
        "https://gitlab.com/owner/repo",
        "git@github.com:pallets/flask.git",
        "https://user:pass@github.com/pallets/flask",
        "https://github.com/pallets/flask?tab=readme",
        "https://github.com/pallets",
        "https://github.com/pallets/flask/issues",
        "https://github.com/../etc",
    ],
)
def test_validate_github_url_rejects_invalid(bad_url: str) -> None:
    with pytest.raises(InvalidRepositoryURLError):
        validate_github_url(bad_url)


def test_safe_resolve_within_blocks_traversal(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    inside = root / "app.py"
    inside.write_text("print('hi')", encoding="utf-8")
    outside = tmp_path / "secret.txt"
    outside.write_text("secret", encoding="utf-8")

    assert _safe_resolve_within(root, inside) == inside.resolve()
    assert _safe_resolve_within(root, root / ".." / "secret.txt") is None


def test_static_analysis_does_not_execute_code(tmp_path: Path) -> None:
    marker_file = tmp_path / "executed_marker.txt"
    fake_repo = tmp_path / "run" / "repo"
    fake_repo.mkdir(parents=True)

    (fake_repo / "requirements.txt").write_text(
        "fastapi==0.115.0\nuvicorn>=0.30.0\n", encoding="utf-8"
    )
    (fake_repo / "pyproject.toml").write_text(
        '[project]\nname = "demo-app"\nversion = "0.2.0"\nrequires-python = ">=3.11"\n',
        encoding="utf-8",
    )
    (fake_repo / "setup.py").write_text(
        f'open(r"{marker_file}", "w").write("HACKED")\n', encoding="utf-8"
    )
    (fake_repo / "cli_runner.py").write_text(
        'if __name__ == "__main__":\n    print("run")\n', encoding="utf-8"
    )

    with (
        patch.object(repository_analyzer, "WORKSPACE_ROOT", tmp_path),
        patch.object(repository_analyzer, "_clone_repository", return_value=fake_repo),
    ):
        result = analyze_repository("https://github.com/example/demo-app")

    assert not marker_file.exists()
    assert result["repo_name"] == "example/demo-app"
    assert result["clone_status"] == "cloned"
    assert result["python_version"]["status"] == "detected"
    assert result["python_version"]["declared"] == ">=3.11"
    assert any(d["name"] == "fastapi" for d in result["dependencies"])
    assert "requirements.txt" in result["detected_config_files"]
    assert "pyproject.toml" in result["detected_config_files"]
    assert any(ep["path"] == "cli_runner.py" for ep in result["candidate_entry_points"])


def test_analyze_endpoint_rejects_invalid_url() -> None:
    response = asyncio.run(_post("/api/analyze", {"repo_url": "http://not-github.com/a/b"}))
    assert response.status_code == 400
    assert "detail" in response.json()
