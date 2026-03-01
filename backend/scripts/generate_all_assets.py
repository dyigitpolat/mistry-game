import asyncio
import os
import sys
from pathlib import Path

# Add the backend and agent directories to the Python path
sys.path.append(str(Path(__file__).parent.parent))
sys.path.append(str(Path(__file__).parent.parent.parent / "agent"))

from app.services.game_engine import GameEngine

try:
    from mistry_agents.scene_generator import SceneGenerator
except ImportError:
    print("mistry_agents not found. Make sure you are in the correct virtual environment.", file=sys.stderr)
    sys.exit(1)

async def generate_hero_banner(scene_gen, scenario, sid) -> str | None:
    """Generate a high-level hero banner for the entire scenario."""
    import re
    safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
    safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
    expected_file_name = f"{safe_sid}_hero.png"
    expected_file_path = scene_gen.output_dir / expected_file_name
    if expected_file_path.exists():
        print(f"  [CACHE] Hero Banner already exists: {expected_file_path}")
        return str(expected_file_path)

    prompt = (
        f"Generate a dramatic, cinematic, noir-style hero banner illustration for a detective mystery game.\n"
        f"Title: {scenario.title}\n"
        f"Description: {scenario.description}\n"
        f"Victim: {scenario.victim}\n"
        f"Setting: {scenario.intro_narrative}\n"
        f"Style: Victorian-era detective noir, moody lighting, rich shadows, muted color palette with dramatic highlights, watercolor texture.\n"
        f"Perspective: A wide landscape shot establishing the mystery.\n"
        f"Do NOT include any text, labels, or UI elements in the image."
    )
    
    print(f"  -> Generating Hero Banner for '{scenario.title}'...")
    try:
        from google import genai
        from google.genai import types
        import mimetypes
        
        # We manually call genai because SceneGenerator is strictly tied to VisualMetadata parsing
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)],
            ),
        ]
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            image_config=types.ImageConfig(aspect_ratio="16:9", image_size="1K"),
        )
        
        result = client.models.generate_content(
            model=scene_gen.model,
            contents=contents,
            config=generate_content_config,
        )
        
        if result.candidates and result.candidates[0].content.parts:
            for part in result.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    inline_data = part.inline_data
                    data_buffer = inline_data.data
                    file_extension = mimetypes.guess_extension(inline_data.mime_type) or ".png"

                    file_name = f"{sid}_hero{file_extension}"
                    file_path = scene_gen.output_dir / file_name

                    with open(file_path, "wb") as f:
                        f.write(data_buffer)

                    print(f"  [OK] Hero Banner saved: {file_path}")
                    return str(file_path)
    except Exception as e:
        print(f"  [ERROR] Hero Banner generation failed: {e}")
        return None


async def main():
    if not os.getenv("GEMINI_API_KEY"):
        print("GEMINI_API_KEY not set. Cannot generate images.", file=sys.stderr)
        sys.exit(1)
        
    print("Initializing GameEngine and SceneGenerator...")
    engine = GameEngine()
    scene_gen = SceneGenerator()
    
    scenarios = list(engine.scenarios.items())
    print(f"Found {len(scenarios)} scenarios.")
    
    for sid, scenario in scenarios:
        if not scenario:
            continue
            
        print(f"\n=======================================================")
        print(f"Processing Scenario: {scenario.title} ({sid})")
        print(f"=======================================================")
        
        # 1. Generate Hero Banner
        await generate_hero_banner(scene_gen, scenario, sid)
        
        # 2. Generate Scene Images - access locations via game_world
        locations_dict = {}
        for name, loc in scenario.game_world.locations.items():
            locations_dict[name] = {
                "visual_metadata": {
                    "setting": loc.setting,
                    "objects": [obj.model_dump() for obj in loc.objects],
                    "connections": [conn.model_dump() for conn in loc.connections],
                }
            }
            
        print(f"  -> Generating {len(locations_dict)} location scenes...")
        results = await scene_gen.generate_all_scenes(locations_dict, sid)
        
        for loc_name, path in results.items():
            if path:
                print(f"  [OK] {loc_name}: {path}")
            else:
                print(f"  [ERROR] Failed to generate {loc_name}")
                
    print("\nAll asset generation complete.")

if __name__ == "__main__":
    asyncio.run(main())
