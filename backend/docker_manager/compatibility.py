"""Docker base-image compatibility and dependency install command selector."""

import re
from typing import Any

# Allowlisted official Python slim images (no arbitrary user images permitted)
SUPPORTED_PYTHON_VERSIONS: tuple[str, ...] = ("3.9", "3.10", "3.11", "3.12", "3.13")
DEFAULT_PYTHON_VERSION = "3.11"

_VERSION_PAIR_RE = re.compile(r"(\d+)\.(\d+)")


def _parse_version_tuple(raw: str) -> tuple[int, int] | None:
    match = _VERSION_PAIR_RE.search(raw)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def _version_matches_specifier(candidate: tuple[int, int], spec_text: str) -> bool:
    """Evaluate common PEP 440 requires-python clauses like '>=3.9, <3.12'."""
    clauses = [c.strip() for c in spec_text.split(",") if c.strip()]
    if not clauses:
        return True

    for clause in clauses:
        ver = _parse_version_tuple(clause)
        if ver is None:
            continue
        if clause.startswith(">="):
            if candidate < ver:
                return False
        elif clause.startswith("<="):
            if candidate > ver:
                return False
        elif clause.startswith("!="):
            if candidate == ver:
                return False
        elif clause.startswith("=="):
            if candidate != ver:
                return False
        elif clause.startswith("~="):
            if candidate[0] != ver[0] or candidate < ver:
                return False
        elif clause.startswith(">"):
            if candidate <= ver:
                return False
        elif clause.startswith("<"):
            if candidate >= ver:
                return False
        else:
            if candidate != ver:
                return False
    return True


def select_python_image(
    analysis: dict[str, Any],
    user_selected_version: str | None = None,
) -> dict[str, Any]:
    """Select an allowlisted official Python Docker base image from M3 analysis."""
    if user_selected_version:
        cleaned = user_selected_version.strip()
        if cleaned not in SUPPORTED_PYTHON_VERSIONS:
            raise ValueError(
                f"Unsupported Python version '{cleaned}'. Supported versions: {', '.join(SUPPORTED_PYTHON_VERSIONS)}."
            )
        return {
            "version": cleaned,
            "image": f"python:{cleaned}-slim",
            "source": "user_selected",
            "disclosure": f"Using user-selected Python {cleaned} (python:{cleaned}-slim).",
        }

    py_info = analysis.get("python_version") or {}
    declared = py_info.get("declared")
    inferred = py_info.get("inferred")

    if declared:
        # Prefer the default if compatible; otherwise pick highest compatible supported version
        compatible = [
            v
            for v in SUPPORTED_PYTHON_VERSIONS
            if _version_matches_specifier(_parse_version_tuple(v), declared)
        ]
        chosen = (
            DEFAULT_PYTHON_VERSION
            if DEFAULT_PYTHON_VERSION in compatible
            else (compatible[-1] if compatible else DEFAULT_PYTHON_VERSION)
        )
        disclosure = (
            f"Selected python:{chosen}-slim to satisfy declared requirement '{declared}'."
            if compatible
            else f"Declared requirement '{declared}' did not match a supported slim tag; falling back to python:{chosen}-slim."
        )
        return {
            "version": chosen,
            "image": f"python:{chosen}-slim",
            "source": "declared",
            "disclosure": disclosure,
        }

    if inferred:
        ver_tuple = _parse_version_tuple(inferred)
        if ver_tuple:
            ver_str = f"{ver_tuple[0]}.{ver_tuple[1]}"
            if ver_str in SUPPORTED_PYTHON_VERSIONS:
                return {
                    "version": ver_str,
                    "image": f"python:{ver_str}-slim",
                    "source": "inferred",
                    "disclosure": f"Inferred Python {ver_str} from {py_info.get('source') or 'repository hints'}.",
                }

    return {
        "version": DEFAULT_PYTHON_VERSION,
        "image": f"python:{DEFAULT_PYTHON_VERSION}-slim",
        "source": "default",
        "disclosure": (
            f"Python version was not declared by the repository; "
            f"defaulted to python:{DEFAULT_PYTHON_VERSION}-slim."
        ),
    }


def select_install_command(analysis: dict[str, Any]) -> dict[str, Any]:
    """Choose the pip dependency installation command from detected config files."""
    config_files = analysis.get("detected_config_files") or []
    lower_map = {f.lower(): f for f in config_files}

    if "requirements.txt" in lower_map:
        req_file = lower_map["requirements.txt"]
        return {
            "has_dependencies": True,
            "source_file": req_file,
            "command": ["pip", "install", "--no-cache-dir", "-r", req_file],
            "command_display": f"pip install --no-cache-dir -r {req_file}",
        }

    for cfg in ("pyproject.toml", "setup.py", "setup.cfg"):
        if cfg in lower_map:
            return {
                "has_dependencies": True,
                "source_file": lower_map[cfg],
                "command": ["pip", "install", "--no-cache-dir", "."],
                "command_display": "pip install --no-cache-dir .",
            }

    return {
        "has_dependencies": False,
        "source_file": None,
        "command": None,
        "command_display": None,
    }
