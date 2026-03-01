"""
Scenario generation route — triggers the procedural generation pipeline
and persists the resulting game graph to MongoDB.
"""

from __future__ import annotations

import asyncio
import json
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.db.mongodb import get_database
from app.models.scenario import Scenario
from app.services.game_engine import GameEngine
from app.core.auth import get_current_user

router = APIRouter()

_project_root = Path(__file__).parent.parent.parent.parent
_procedural_gen_dir = _project_root / "procedural_gen"


class CharacterInput(BaseModel):
    type: str = "Suspect"
    name: str
    role_archetype: str = ""
    starting_location: str = ""
    persona_and_secret: str = ""


class PhaseInput(BaseModel):
    objective: str
    required_twists_or_discoveries: str = ""
    logic_complexity: str = "Medium"


class GenerateRequest(BaseModel):
    case_title: str
    time_period: Optional[str] = None
    setting_location: Optional[str] = None
    setting_description: Optional[str] = None
    genre: str = "Murder Mystery"
    crime_summary: str
    characters: List[CharacterInput] = Field(default_factory=list)
    culprit: str = ""
    motive: str = ""
    critical_evidence: List[str] = Field(default_factory=list)
    story_length: str = "med"
    story_phases: List[PhaseInput] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    scenario_id: str
    title: str
    status: str = "created"


@router.post("/generate", response_model=GenerateResponse)
async def generate_scenario(
    req: GenerateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Run the procedural generation pipeline:
    1. Write input JSON to temp file
    2. Run procedural-gen CLI (story generation + game graph)
    3. Read the generated graph
    4. Validate against Scenario schema
    5. Persist to MongoDB with ownership
    6. Register in the in-memory GameEngine
    """
    input_data = req.model_dump(exclude_none=True)
    input_data["characters"] = [c.model_dump() for c in req.characters]
    input_data["story_phases"] = [p.model_dump() for p in req.story_phases]

    # --- Cache check: if a scenario with this title was generated before, return it ---
    scenario_id = _make_scenario_id(req.case_title)
    cached_path = Path(__file__).parent.parent.parent / "data" / f"{scenario_id}.json"
    if cached_path.exists():
        try:
            cached_dict = json.loads(cached_path.read_text(encoding="utf-8"))
            cached_dict["owner_id"] = user["id"]
            cached_dict["_id"] = scenario_id
            scenario = Scenario.model_validate(
                {k: v for k, v in cached_dict.items() if k != "_id"}
            )

            db = await get_database()
            if db is not None:
                await db["scenarios"].replace_one(
                    {"_id": scenario_id}, cached_dict, upsert=True,
                )

            _engine = GameEngine._shared_instance
            if _engine is not None:
                _engine.scenarios[scenario_id] = scenario

            await asyncio.sleep(5)

            return GenerateResponse(
                scenario_id=scenario_id,
                title=scenario.title,
                status="created",
            )
        except Exception:
            pass  # cache is invalid, fall through to full generation

    with tempfile.TemporaryDirectory() as tmp_dir:
        input_path = Path(tmp_dir) / "input.json"
        output_path = Path(tmp_dir) / "output.json"
        graph_path = Path(tmp_dir) / "graph.json"

        input_path.write_text(json.dumps(input_data, indent=2, ensure_ascii=False), encoding="utf-8")

        # --- Step 1: Run story generation ---
        try:
            story_result = await _run_story_generation(input_path, output_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Story generation failed: {e}")

        # --- Step 2: Run game graph generation ---
        try:
            game_graph = await _run_graph_generation(story_result, graph_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Graph generation failed: {e}")

        # --- Step 3: Validate against schema ---
        try:
            if "description" not in game_graph or not game_graph["description"]:
                game_graph["description"] = req.crime_summary[:200]
            if "author" not in game_graph or not game_graph["author"]:
                game_graph["author"] = "AI Weaver"

            # Set ownership and default to private
            game_graph["owner_id"] = user["id"]
            game_graph["visibility"] = "private"

            # Look up owner display name from NextAuth users collection
            owner_name = None
            db = await get_database()
            if db is not None:
                user_doc = await db["users"].find_one({"_id": user["id"]})
                if not user_doc:
                    from bson import ObjectId
                    try:
                        user_doc = await db["users"].find_one({"_id": ObjectId(user["id"])})
                    except Exception:
                        pass
                if user_doc:
                    owner_name = user_doc.get("name")
            game_graph["owner_name"] = owner_name or "Unknown"

            scenario = Scenario.model_validate(game_graph)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Generated graph failed validation: {e}")

        # --- Step 4: Save to MongoDB ---
        scenario_id = _make_scenario_id(scenario.title)
        scenario_dict = json.loads(scenario.model_dump_json())
        scenario_dict["_id"] = scenario_id

        if db is None:
            db = await get_database()
        if db is not None:
            await db["scenarios"].replace_one(
                {"_id": scenario_id},
                scenario_dict,
                upsert=True,
            )

        # --- Step 5: Register in GameEngine ---
        _engine = GameEngine._shared_instance
        if _engine is not None:
            _engine.scenarios[scenario_id] = scenario

        # --- Step 6: Also save graph to data/ for the engine to load on restart ---
        persist_path = Path(__file__).parent.parent.parent / "data" / f"{scenario_id}.json"
        persist_path.parent.mkdir(parents=True, exist_ok=True)
        persist_path.write_text(
            json.dumps(scenario_dict, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        return GenerateResponse(
            scenario_id=scenario_id,
            title=scenario.title,
            status="created",
        )


def _make_scenario_id(title: str) -> str:
    """Generate a filesystem-safe scenario ID from the title."""
    slug = title.lower().strip()
    slug = slug.replace("'", "").replace('"', "")
    slug = "_".join(slug.split())
    slug = "".join(c for c in slug if c.isalnum() or c == "_")
    if not slug:
        slug = f"case_{uuid.uuid4().hex[:8]}"
    return slug


async def _run_story_generation(input_path: Path, output_path: Path) -> dict:
    """
    Run the story generation step using the procedural_gen CLI via subprocess.
    Returns the story output dict.
    """
    cmd = [
        "uv", "run", "python", "-c",
        (
            "import json, sys; "
            "sys.path.insert(0, '.'); "
            "from cli.run import run; "
            f"result = run('{input_path}', '{output_path}'); "
            "print(json.dumps(result, ensure_ascii=False))"
        ),
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(_procedural_gen_dir),
    )

    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Story generation process failed (exit {proc.returncode}): {err_msg}")

    stdout_text = stdout.decode("utf-8", errors="replace").strip()
    lines = stdout_text.strip().split("\n")
    for line in reversed(lines):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

    if output_path.exists():
        return json.loads(output_path.read_text(encoding="utf-8"))

    raise RuntimeError(f"Could not parse story generation output. stdout: {stdout_text[:500]}")


async def _run_graph_generation(story_data: dict, graph_path: Path) -> dict:
    """
    Run the game graph generation step via subprocess.
    Returns the game graph dict.
    """
    story_json = json.dumps(story_data, ensure_ascii=False)

    cmd = [
        "uv", "run", "python", "-c",
        (
            "import json, sys; "
            "sys.path.insert(0, '.'); "
            "from src.procedural_gen.game_graph_generator import GameGraphGenerator; "
            f"story_data = json.loads(sys.stdin.read()); "
            "gen = GameGraphGenerator(); "
            "graph = gen.generate_graph(story_data); "
            f"gen.save_graph(graph, '{graph_path}'); "
            "print(json.dumps(graph, ensure_ascii=False))"
        ),
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(_procedural_gen_dir),
    )

    stdout, stderr = await asyncio.wait_for(
        proc.communicate(input=story_json.encode("utf-8")),
        timeout=300,
    )

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Graph generation process failed (exit {proc.returncode}): {err_msg}")

    if graph_path.exists():
        return json.loads(graph_path.read_text(encoding="utf-8"))

    stdout_text = stdout.decode("utf-8", errors="replace").strip()
    lines = stdout_text.strip().split("\n")
    for line in reversed(lines):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

    raise RuntimeError(f"Could not parse graph output. stdout: {stdout_text[:500]}")
