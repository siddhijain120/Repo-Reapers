"""Tests for the Envix backend health endpoint and CORS configuration."""

import asyncio
import httpx

from app.main import app


async def _get(path: str, headers: dict | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        return await client.get(path, headers=headers)


def test_health_endpoint_returns_real_status() -> None:
    response = asyncio.run(_get("/api/health"))
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Envix Backend"
    assert data["team"] == "Repo Reapers"
    assert isinstance(data["python_version"], str) and len(data["python_version"]) > 0
    assert isinstance(data["timestamp_utc"], str) and len(data["timestamp_utc"]) > 0
    assert isinstance(data["groq_configured"], bool)
    assert data["capabilities"]["health"] is True
    assert "groq_api_key" not in data


def test_cors_allows_vite_dev_server() -> None:
    response = asyncio.run(
        _get("/api/health", headers={"Origin": "http://localhost:5173"})
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
