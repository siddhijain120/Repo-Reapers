"""Tests for Groq AI log sanitization, graceful fallback, and /api/ai/explain."""

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from ai import groq_assistant
from ai.groq_assistant import diagnose_run_with_groq, sanitize_logs
from app.main import app


async def _post(path: str, json_body: dict) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.post(path, json=json_body)


def test_sanitize_logs_redacts_secrets_and_truncates() -> None:
    raw = (
        "GROQ_API_KEY=gsk_SecretValue1234567890\n"
        "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret\n"
        "https://alice:supersecret@github.com/org/repo\n"
        "Path: C:\\Users\\Alice\\Desktop\\secret\n"
        + ("x" * 5000)
    )
    cleaned = sanitize_logs(raw, max_chars=400)
    assert "gsk_SecretValue" not in cleaned
    assert "eyJhbGciOiJIUzI1NiJ9" not in cleaned
    assert "supersecret" not in cleaned
    assert "Alice" not in cleaned
    assert len(cleaned) <= 460


def test_diagnose_handles_missing_api_key_gracefully(tmp_path: Path) -> None:
    run_dir = tmp_path / "abcdef123456"
    run_dir.mkdir()
    (run_dir / "analysis.json").write_text('{"repo_name": "a/b"}', encoding="utf-8")

    fake_settings = SimpleNamespace(groq_api_key="", groq_model="openai/gpt-oss-120b")
    with (
        patch.object(groq_assistant, "_validate_run_id", return_value=run_dir),
        patch.object(groq_assistant, "settings", fake_settings),
    ):
        res = diagnose_run_with_groq("abcdef123456")

    assert res["ai_available"] is False
    assert "GROQ_API_KEY" in res["error"]


def test_ai_explain_returns_404_for_missing_run() -> None:
    response = asyncio.run(_post("/api/ai/explain", {"run_id": "000000000000"}))
    assert response.status_code == 404
