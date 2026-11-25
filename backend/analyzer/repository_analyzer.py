"""Safe GitHub repository cloner and static Python project analyzer.

This module never executes repository code or installs dependencies.
"""

import ast
import configparser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tomllib
from typing import Any
from urllib.parse import urlparse
import uuid

# Limits to keep cloning and static inspection fast and safe
CLONE_TIMEOUT_SECONDS = 60
MAX_FILE_COUNT = 5000
MAX_REPO_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_READ_BYTES = 512 * 1024  # 512 KB per inspected text file

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
WORKSPACE_ROOT = PROJECT_ROOT / "workspace"

_GITHUB_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
_REQ_SPLIT_RE = re.compile(r"^([A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_,.-]+\])?)\s*(.*)$")


class InvalidRepositoryURLError(ValueError):
    """Raised when a submitted URL is not a supported public GitHub repository."""


class RepositoryCloneError(RuntimeError):
    """Raised when git clone fails, times out, or exceeds safety limits."""


def validate_github_url(raw_url: str) -> tuple[str, str, str]:
    """Validate and normalize a public GitHub repository URL.

    Returns (normalized_clone_url, display_repo_name, repo_slug).
    """
    if not raw_url or not isinstance(raw_url, str):
        raise InvalidRepositoryURLError("Repository URL is required.")

    candidate = raw_url.strip()
    parsed = urlparse(candidate)

    if parsed.scheme != "https":
        raise InvalidRepositoryURLError(
            "Only HTTPS public GitHub repository URLs are supported."
        )
    if parsed.netloc.lower() != "github.com":
        raise InvalidRepositoryURLError(
            "Only github.com repositories are supported."
        )
    if parsed.username or parsed.password:
        raise InvalidRepositoryURLError(
            "URLs with embedded credentials are not allowed."
        )
    if parsed.query or parsed.fragment:
        raise InvalidRepositoryURLError(
            "URLs with query parameters or fragments are not supported."
        )

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) != 2:
        raise InvalidRepositoryURLError(
            "URL must point to a GitHub repository root (https://github.com/owner/repo)."
        )

    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    for segment in (owner, repo):
        if segment in {".", ".."} or ".." in segment or not _GITHUB_SEGMENT_RE.match(segment):
            raise InvalidRepositoryURLError("Repository owner or name contains invalid characters.")

    display_name = f"{owner}/{repo}"
    clone_url = f"https://github.com/{owner}/{repo}.git"
    return clone_url, display_name, repo


def _safe_resolve_within(root: Path, target: Path) -> Path | None:
    """Resolve target and ensure it remains strictly inside root (no traversal)."""
    try:
        resolved_root = root.resolve()
        resolved_target = target.resolve()
        if resolved_target.is_relative_to(resolved_root):
            return resolved_target
    except OSError:
        return None
    return None


def _read_text_safe(file_path: Path) -> str | None:
    """Read a UTF-8 text file up to MAX_READ_BYTES without executing anything."""
    try:
        if file_path.is_symlink():
            return None
        if file_path.stat().st_size > MAX_READ_BYTES:
            return None
        return file_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def _clone_repository(clone_url: str, run_dir: Path) -> Path:
    """Shallow-clone a public GitHub repo into an isolated workspace directory."""
    git_path = shutil.which("git")
    if not git_path:
        raise RepositoryCloneError("Git CLI is not installed or not found on PATH.")

    repo_dir = run_dir / "repo"
    run_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    try:
        result = subprocess.run(
            [
                git_path,
                "clone",
                "--depth",
                "1",
                "--single-branch",
                "--no-local",
                clone_url,
                str(repo_dir),
            ],
            capture_output=True,
            text=True,
            timeout=CLONE_TIMEOUT_SECONDS,
            env=env,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(run_dir, ignore_errors=True)
        raise RepositoryCloneError(
            f"Git clone timed out after {CLONE_TIMEOUT_SECONDS} seconds."
        ) from exc
    except OSError as exc:
        shutil.rmtree(run_dir, ignore_errors=True)
        raise RepositoryCloneError(f"Failed to run git clone: {exc}") from exc

    if result.returncode != 0:
        shutil.rmtree(run_dir, ignore_errors=True)
        err = (result.stderr or result.stdout or "Unknown git error").strip()
        raise RepositoryCloneError(f"Git clone failed: {err}")

    return repo_dir


def _walk_repository(repo_dir: Path) -> dict[str, Any]:
    """Walk the cloned repository safely, enforcing file-count and size limits."""
    files: list[Path] = []
    total_size = 0
    truncated = False
    warnings: list[str] = []

    for current_root, dir_names, file_names in os.walk(repo_dir, followlinks=False):
        # Skip .git metadata and common virtual/cache directories
        dir_names[:] = [
            d for d in dir_names
            if d not in {".git", "__pycache__", ".venv", "venv", "node_modules"}
            and not (Path(current_root) / d).is_symlink()
        ]
        for fname in file_names:
            candidate = Path(current_root) / fname
            if candidate.is_symlink():
                continue
            safe_path = _safe_resolve_within(repo_dir, candidate)
            if safe_path is None:
                continue
            try:
                total_size += safe_path.stat().st_size
            except OSError:
                continue

            files.append(safe_path)
            if len(files) >= MAX_FILE_COUNT:
                truncated = True
                warnings.append(
                    f"Repository exceeded {MAX_FILE_COUNT} files; inspection stopped early."
                )
                break
            if total_size > MAX_REPO_SIZE_BYTES:
                truncated = True
                warnings.append(
                    f"Repository exceeded {MAX_REPO_SIZE_BYTES // (1024 * 1024)} MB limit; inspection stopped early."
                )
                break
        if truncated:
            break

    return {
        "files": files,
        "total_size_bytes": total_size,
        "truncated": truncated,
        "warnings": warnings,
    }


def _parse_requirement_line(line: str) -> tuple[str, str] | None:
    """Parse one requirement line into (name, specifier) or None."""
    cleaned = line.split("#", 1)[0].strip()
    if not cleaned:
        return None
    if cleaned.startswith(("-", "--")):
        return None
    # Strip environment markers like ; python_version < "3.11"
    main_part = cleaned.split(";", 1)[0].strip()
    match = _REQ_SPLIT_RE.match(main_part)
    if not match:
        return None
    name = match.group(1).strip()
    spec = match.group(2).strip() or "any"
    return name, spec


def _parse_requirements_txt(content: str, source_label: str) -> tuple[list[dict], list[str]]:
    deps: list[dict] = []
    warnings: list[str] = []
    for raw_line in content.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith(("-r ", "--requirement ", "-e ", "--editable ")):
            warnings.append(
                f"{source_label} contains special pip directive '{stripped}' that was not recursively resolved."
            )
            continue
        parsed = _parse_requirement_line(raw_line)
        if parsed:
            deps.append(
                {"name": parsed[0], "specifier": parsed[1], "source": source_label}
            )
    return deps, warnings


def _parse_pyproject_toml(content: str) -> dict[str, Any]:
    """Parse pyproject.toml safely using tomllib."""
    result: dict[str, Any] = {
        "metadata": {},
        "python_requires": None,
        "dependencies": [],
        "entry_points": [],
        "warnings": [],
    }
    try:
        data = tomllib.loads(content)
    except tomllib.TOMLDecodeError as exc:
        result["warnings"].append(f"Could not parse pyproject.toml: {exc}")
        return result

    project = data.get("project", {})
    if isinstance(project, dict):
        result["metadata"] = {
            "name": project.get("name"),
            "version": project.get("version"),
            "description": project.get("description"),
            "source": "pyproject.toml",
        }
        if isinstance(project.get("requires-python"), str):
            result["python_requires"] = project["requires-python"].strip()
        for raw_dep in project.get("dependencies", []) or []:
            if isinstance(raw_dep, str):
                parsed = _parse_requirement_line(raw_dep)
                if parsed:
                    result["dependencies"].append(
                        {"name": parsed[0], "specifier": parsed[1], "source": "pyproject.toml"}
                    )
        scripts = project.get("scripts", {})
        if isinstance(scripts, dict):
            for cmd_name, target in scripts.items():
                result["entry_points"].append(
                    {
                        "path": "pyproject.toml",
                        "reason": f"Declared console script '{cmd_name}' -> {target}",
                        "command": str(cmd_name),
                        "confidence": "detected",
                    }
                )

    poetry = data.get("tool", {}).get("poetry", {})
    if isinstance(poetry, dict):
        if not result["metadata"].get("name"):
            result["metadata"] = {
                "name": poetry.get("name"),
                "version": poetry.get("version"),
                "description": poetry.get("description"),
                "source": "pyproject.toml (poetry)",
            }
        poetry_deps = poetry.get("dependencies", {})
        if isinstance(poetry_deps, dict):
            for pkg, spec in poetry_deps.items():
                if pkg.lower() == "python":
                    if not result["python_requires"] and isinstance(spec, str):
                        result["python_requires"] = spec
                    continue
                spec_str = spec if isinstance(spec, str) else "configured"
                result["dependencies"].append(
                    {"name": pkg, "specifier": spec_str, "source": "pyproject.toml (poetry)"}
                )

    return result


def _parse_setup_cfg(content: str) -> dict[str, Any]:
    """Parse setup.cfg safely using configparser."""
    result: dict[str, Any] = {
        "metadata": {},
        "python_requires": None,
        "dependencies": [],
        "entry_points": [],
    }
    parser = configparser.ConfigParser()
    try:
        parser.read_string(content)
    except configparser.Error:
        return result

    if parser.has_section("metadata"):
        result["metadata"] = {
            "name": parser.get("metadata", "name", fallback=None),
            "version": parser.get("metadata", "version", fallback=None),
            "description": parser.get("metadata", "description", fallback=None),
            "source": "setup.cfg",
        }

    if parser.has_section("options"):
        py_req = parser.get("options", "python_requires", fallback=None)
        if py_req:
            result["python_requires"] = py_req.strip()
        install_req = parser.get("options", "install_requires", fallback="")
        for line in install_req.splitlines():
            parsed = _parse_requirement_line(line)
            if parsed:
                result["dependencies"].append(
                    {"name": parsed[0], "specifier": parsed[1], "source": "setup.cfg"}
                )

    if parser.has_section("options.entry_points"):
        scripts = parser.get("options.entry_points", "console_scripts", fallback="")
        for line in scripts.splitlines():
            line = line.strip()
            if "=" in line:
                cmd_name, target = [part.strip() for part in line.split("=", 1)]
                result["entry_points"].append(
                    {
                        "path": "setup.cfg",
                        "reason": f"Declared console script '{cmd_name}' -> {target}",
                        "command": cmd_name,
                        "confidence": "detected",
                    }
                )

    return result


def _parse_setup_py_ast(content: str) -> dict[str, Any]:
    """Inspect setup.py using AST only (never executed) for literal install_requires/python_requires."""
    result: dict[str, Any] = {"python_requires": None, "dependencies": []}
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return result

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            if func_name != "setup":
                continue

            for kw in node.keywords:
                if kw.arg == "python_requires" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                    result["python_requires"] = kw.value.value.strip()
                elif kw.arg == "install_requires" and isinstance(kw.value, (ast.List, ast.Tuple)):
                    for elt in kw.value.elts:
                        if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                            parsed = _parse_requirement_line(elt.value)
                            if parsed:
                                result["dependencies"].append(
                                    {"name": parsed[0], "specifier": parsed[1], "source": "setup.py (AST)"}
                                )
    return result


def _parse_dockerfile(content: str) -> dict[str, Any]:
    """Extract base Python image and CMD/ENTRYPOINT hints from Dockerfile."""
    python_hint = None
    cmd_hint = None
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        upper = line.upper()
        if upper.startswith("FROM ") and "python:" in line.lower() and not python_hint:
            python_hint = line.split(None, 1)[1].strip()
        elif upper.startswith(("CMD ", "ENTRYPOINT ")) and not cmd_hint:
            cmd_hint = line.split(None, 1)[1].strip()
    return {"python_hint": python_hint, "cmd_hint": cmd_hint}


def _has_main_guard(py_content: str) -> bool:
    """Safely check via AST if a Python file has `if __name__ == '__main__':`."""
    try:
        tree = ast.parse(py_content)
    except SyntaxError:
        return False

    for node in tree.body:
        if isinstance(node, ast.If) and isinstance(node.test, ast.Compare):
            left = node.test.left
            if (
                isinstance(left, ast.Name)
                and left.id == "__name__"
                and len(node.test.comparators) == 1
                and isinstance(node.test.comparators[0], ast.Constant)
                and node.test.comparators[0].value == "__main__"
            ):
                return True
    return False


def analyze_repository(repo_url: str) -> dict[str, Any]:
    """Validate, shallow-clone, and statically analyze a public GitHub Python repository."""
    clone_url, display_name, repo_slug = validate_github_url(repo_url)

    run_id = uuid.uuid4().hex[:12]
    run_dir = WORKSPACE_ROOT / run_id
    repo_dir = _clone_repository(clone_url, run_dir)

    walk_info = _walk_repository(repo_dir)
    files: list[Path] = walk_info["files"]
    warnings: list[str] = list(walk_info["warnings"])

    rel_paths = [f.relative_to(repo_dir).as_posix() for f in files]
    rel_lookup = {p.lower(): p for p in rel_paths}

    config_targets = [
        "requirements.txt",
        "pyproject.toml",
        "setup.py",
        "setup.cfg",
        "dockerfile",
        "readme.md",
    ]
    detected_config_files: list[str] = []
    for target in config_targets:
        if target in rel_lookup:
            detected_config_files.append(rel_lookup[target])

    # Also detect nested or variant requirements files (e.g., requirements-dev.txt)
    for rel in rel_paths:
        lower = rel.lower()
        if (lower.endswith(".txt") and "requirements" in Path(lower).name) and rel not in detected_config_files:
            detected_config_files.append(rel)

    python_files = [p for p in rel_paths if p.endswith(".py")]

    dependencies: list[dict] = []
    candidate_entry_points: list[dict] = []
    declared_python: str | None = None
    declared_python_source: str | None = None
    inferred_python: str | None = None
    inferred_python_source: str | None = None
    metadata: dict[str, Any] = {
        "name": repo_slug,
        "version": None,
        "description": None,
        "source": "GitHub repository URL",
    }

    # 1. Inspect requirements.txt (and variants)
    for rel in detected_config_files:
        if rel.lower().endswith(".txt") and "requirements" in Path(rel.lower()).name:
            content = _read_text_safe(repo_dir / rel)
            if content is not None:
                reqs, req_warnings = _parse_requirements_txt(content, rel)
                dependencies.extend(reqs)
                warnings.extend(req_warnings)

    # 2. Inspect pyproject.toml
    if "pyproject.toml" in rel_lookup:
        content = _read_text_safe(repo_dir / rel_lookup["pyproject.toml"])
        if content is not None:
            pyproj = _parse_pyproject_toml(content)
            warnings.extend(pyproj["warnings"])
            dependencies.extend(pyproj["dependencies"])
            candidate_entry_points.extend(pyproj["entry_points"])
            if pyproj["python_requires"]:
                declared_python = pyproj["python_requires"]
                declared_python_source = "pyproject.toml"
            if pyproj["metadata"].get("name"):
                metadata = pyproj["metadata"]

    # 3. Inspect setup.cfg
    if "setup.cfg" in rel_lookup:
        content = _read_text_safe(repo_dir / rel_lookup["setup.cfg"])
        if content is not None:
            cfg = _parse_setup_cfg(content)
            dependencies.extend(cfg["dependencies"])
            candidate_entry_points.extend(cfg["entry_points"])
            if not declared_python and cfg["python_requires"]:
                declared_python = cfg["python_requires"]
                declared_python_source = "setup.cfg"
            if metadata.get("source") == "GitHub repository URL" and cfg["metadata"].get("name"):
                metadata = cfg["metadata"]

    # 4. Inspect setup.py safely via AST
    if "setup.py" in rel_lookup:
        content = _read_text_safe(repo_dir / rel_lookup["setup.py"])
        if content is not None:
            setup_ast = _parse_setup_py_ast(content)
            if not declared_python and setup_ast["python_requires"]:
                declared_python = setup_ast["python_requires"]
                declared_python_source = "setup.py (AST)"
            if not dependencies and setup_ast["dependencies"]:
                dependencies.extend(setup_ast["dependencies"])

    # 5. Inspect Dockerfile
    if "dockerfile" in rel_lookup:
        df_path = rel_lookup["dockerfile"]
        content = _read_text_safe(repo_dir / df_path)
        if content is not None:
            df = _parse_dockerfile(content)
            if df["python_hint"]:
                inferred_python = df["python_hint"]
                inferred_python_source = df_path
            if df["cmd_hint"]:
                candidate_entry_points.append(
                    {
                        "path": df_path,
                        "reason": "Dockerfile CMD/ENTRYPOINT",
                        "command": df["cmd_hint"],
                        "confidence": "inferred",
                    }
                )

    # 6. Inspect Python files for __main__ guards (without assuming main.py)
    for rel_py in python_files[:200]:
        content = _read_text_safe(repo_dir / rel_py)
        if content and _has_main_guard(content):
            candidate_entry_points.append(
                {
                    "path": rel_py,
                    "reason": "Contains `if __name__ == '__main__':` guard",
                    "command": f"python {rel_py}",
                    "confidence": "inferred",
                }
            )

    if not python_files:
        warnings.append("No Python (.py) source files were detected in this repository.")
    if not dependencies:
        warnings.append(
            "No dependencies could be extracted from requirements.txt, pyproject.toml, setup.cfg, or setup.py."
        )
    if not candidate_entry_points:
        warnings.append(
            "No clear entry point or console script was detected; manual command confirmation will be required."
        )

    if declared_python:
        python_version_info = {
            "status": "detected",
            "declared": declared_python,
            "source": declared_python_source,
            "inferred": inferred_python,
        }
    elif inferred_python:
        python_version_info = {
            "status": "inferred",
            "declared": None,
            "source": inferred_python_source,
            "inferred": inferred_python,
        }
    else:
        python_version_info = {
            "status": "unknown",
            "declared": None,
            "source": None,
            "inferred": None,
        }
        warnings.append("Python version requirement is not explicitly declared in the repository.")

    facts: list[str] = [
        f"Cloned {display_name} into isolated workspace '{run_id}'.",
        f"Detected {len(python_files)} Python file(s) and {len(detected_config_files)} configuration file(s).",
    ]
    if declared_python:
        facts.append(f"Declared Python requirement: {declared_python} (from {declared_python_source}).")
    if dependencies:
        facts.append(f"Extracted {len(dependencies)} dependency entry/entries.")

    inferred_notes: list[str] = []
    if inferred_python and not declared_python:
        inferred_notes.append(
            f"Inferred Python base '{inferred_python}' from {inferred_python_source}."
        )
    for ep in candidate_entry_points:
        if ep["confidence"] == "inferred":
            inferred_notes.append(f"Candidate command '{ep['command']}' inferred from {ep['path']}.")

    unknowns: list[str] = []
    if python_version_info["status"] == "unknown":
        unknowns.append("Required Python version is unknown (not declared).")
    if not candidate_entry_points:
        unknowns.append("Execution command is unknown (no entry point detected).")
    if not dependencies:
        unknowns.append("Runtime package dependencies are unknown or none declared.")

    result = {
        "run_id": run_id,
        "repo_name": display_name,
        "repo_url": f"https://github.com/{display_name}",
        "clone_status": "cloned",
        "workspace_dir": f"workspace/{run_id}",
        "metadata": metadata,
        "python_version": python_version_info,
        "dependencies": dependencies,
        "detected_config_files": detected_config_files,
        "python_files_count": len(python_files),
        "python_files_sample": python_files[:20],
        "candidate_entry_points": candidate_entry_points,
        "facts": facts,
        "inferred": inferred_notes,
        "unknowns": unknowns,
        "warnings": warnings,
    }

    # Persist analysis results for downstream milestones (M4+)
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "analysis.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    return result
