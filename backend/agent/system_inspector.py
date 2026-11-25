"""Local system inspector for detecting real OS, CPU, RAM, Python, Git, and Docker status."""

import ctypes
from datetime import datetime, timezone
import os
import platform
import shutil
import subprocess
import sys
from typing import Any

import docker
from docker.errors import DockerException


def _run_version_command(executable_path: str, args: list[str]) -> tuple[str | None, str | None]:
    """Run a CLI version command safely and return (output, error)."""
    try:
        result = subprocess.run(
            [executable_path, *args],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        output = (result.stdout or result.stderr or "").strip()
        if result.returncode == 0 and output:
            return output, None
        return None, output or f"Exited with code {result.returncode}"
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)


def _detect_memory() -> dict[str, Any]:
    """Detect total and available RAM in GB without external dependencies."""
    system_name = platform.system()

    if system_name == "Windows":
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                gb = 1024 ** 3
                return {
                    "detectable": True,
                    "total_gb": round(stat.ullTotalPhys / gb, 2),
                    "available_gb": round(stat.ullAvailPhys / gb, 2),
                }
        except Exception:
            pass

    if system_name == "Linux":
        try:
            mem_info: dict[str, int] = {}
            with open("/proc/meminfo", "r", encoding="utf-8") as handle:
                for line in handle:
                    parts = line.split(":")
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value_kb = parts[1].strip().split()[0]
                        if value_kb.isdigit():
                            mem_info[key] = int(value_kb)
            if "MemTotal" in mem_info and "MemAvailable" in mem_info:
                gb_in_kb = 1024 ** 2
                return {
                    "detectable": True,
                    "total_gb": round(mem_info["MemTotal"] / gb_in_kb, 2),
                    "available_gb": round(mem_info["MemAvailable"] / gb_in_kb, 2),
                }
        except Exception:
            pass

    return {
        "detectable": False,
        "total_gb": None,
        "available_gb": None,
    }


def _detect_git() -> dict[str, Any]:
    """Detect Git CLI installation and version."""
    git_path = shutil.which("git")
    if not git_path:
        return {
            "installed": False,
            "version": None,
            "error": "git executable not found on PATH",
        }

    output, error = _run_version_command(git_path, ["--version"])
    if output:
        version = output.removeprefix("git version ").strip()
        return {"installed": True, "version": version, "error": None}

    return {"installed": True, "version": None, "error": error}


def _detect_docker_cli() -> dict[str, Any]:
    """Detect Docker CLI installation and version (independent of Engine)."""
    docker_path = shutil.which("docker")
    if not docker_path:
        return {
            "installed": False,
            "version": None,
            "error": "docker CLI not found on PATH",
        }

    output, error = _run_version_command(docker_path, ["--version"])
    if output:
        # Typical output: "Docker version 27.3.1, build ce12230"
        cleaned = output.removeprefix("Docker version ").strip()
        return {"installed": True, "version": cleaned, "error": None}

    return {"installed": True, "version": None, "error": error}


def _detect_docker_engine() -> dict[str, Any]:
    """Detect whether the Docker Engine daemon is reachable and its server version."""
    client = None
    try:
        client = docker.from_env(timeout=3)
        client.ping()
        info = client.version()
        return {
            "connected": True,
            "server_version": info.get("Version"),
            "api_version": info.get("ApiVersion"),
            "error": None,
        }
    except DockerException as exc:
        return {
            "connected": False,
            "server_version": None,
            "api_version": None,
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "connected": False,
            "server_version": None,
            "api_version": None,
            "error": str(exc),
        }
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def get_system_info() -> dict[str, Any]:
    """Collect real local system, Python, Git, and Docker status without exposing secrets."""
    return {
        "os": {
            "system": platform.system() or None,
            "release": platform.release() or None,
            "version": platform.version() or None,
        },
        "cpu": {
            "architecture": platform.machine() or None,
            "count": os.cpu_count(),
        },
        "memory": _detect_memory(),
        "python": {
            "installed": True,
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
            "executable": os.path.basename(sys.executable),
        },
        "git": _detect_git(),
        "docker_cli": _detect_docker_cli(),
        "docker_engine": _detect_docker_engine(),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
