"""CLI entrypoint: load input by id, generate story, write output."""

from __future__ import annotations

import json
from pathlib import Path

from src.llm.openai_api import OpenAILLM, load_env
from src.procedural_gen.generation import generate_story


def get_data_root() -> Path:
    """Project data root (data/ under project root)."""
    # Assume we run from project root; data/ is next to pyproject.toml
    cwd = Path.cwd()
    if (cwd / "data" / "input").is_dir():
        return cwd / "data"
    # Else look for procedural_gen/data when run from repo root
    for d in [cwd, *cwd.parents]:
        data = d / "data"
        if (data / "input").is_dir():
            return data
    return cwd / "data"


def load_input(input_id: str, data_root: Path | None = None) -> dict:
    """Load input JSON for the given id. Same id ties input to output."""
    root = data_root or get_data_root()
    path = root / "input" / f"{input_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Input file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_input_path(path: Path) -> dict:
    """Load input JSON from the given path."""
    path = Path(path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Input file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_output(
    input_id: str,
    result: dict,
    data_root: Path | None = None,
) -> Path:
    """Write generated result (culprits + story) to output JSON file. Returns path written."""
    root = data_root or get_data_root()
    out_dir = root / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{input_id}.json"
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def save_output_path(result: dict, path: Path) -> Path:
    """Write generated result to the given output path. Returns path written."""
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def run(
    input_path: str | Path = "data/input/input.json",
    output_path: str | Path = "data/output/output.json",
    *,
    data_root: Path | None = None,
    llm: OpenAILLM | None = None,
) -> dict:
    """Load input from path, generate story with customization, save to output path. Returns result dict with culprits and story."""
    load_env()
    input_path = Path(input_path).resolve()
    output_path = Path(output_path).resolve()
    params = load_input_path(input_path)

    # UI-shaped params (all optional): Foundation, Cast, Culprit & motive, Length, Phases
    template_vars = {}
    if params.get("case_title") is not None:
        template_vars["case_title"] = params["case_title"]
    if params.get("time_period") is not None:
        template_vars["time_period"] = params["time_period"]
    if params.get("setting_location") is not None:
        template_vars["setting_location"] = params["setting_location"]
    if params.get("setting_description") is not None:
        template_vars["setting_description"] = params["setting_description"]
    if params.get("genre") is not None:
        template_vars["genre"] = params["genre"]
    if params.get("crime_summary") is not None:
        template_vars["crime_summary"] = params["crime_summary"]
    if params.get("characters") is not None:
        template_vars["characters"] = params["characters"]
    if params.get("culprit") is not None:
        template_vars["culprit"] = params["culprit"]
    if params.get("motive") is not None:
        template_vars["motive"] = params["motive"]
    if params.get("critical_evidence") is not None:
        template_vars["critical_evidence"] = params["critical_evidence"]
    if params.get("story_length") is not None:
        template_vars["story_length"] = params["story_length"]
    if params.get("story_phases") is not None:
        template_vars["story_phases"] = params["story_phases"]

    if llm is None:
        llm = OpenAILLM()

    result = generate_story(llm, **template_vars)
    save_output_path(result, output_path)
    return result
