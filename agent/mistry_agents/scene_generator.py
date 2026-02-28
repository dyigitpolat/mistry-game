"""
Scene Image Generator — Uses Google Nanobanana (Gemini) for dynamic scene generation.

Generates scene images from VisualMetadata descriptions using the
gemini-3.1-flash-image-preview model.
"""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any, Dict, Optional

from google import genai
from google.genai import types


class SceneGenerator:
    """
    Generates scene images from VisualMetadata using Google Nanobanana.

    Uses the gemini-3.1-flash-image-preview model with image output modality
    to generate atmospheric scene images for game locations.
    """

    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = str(Path(__file__).parent.parent.parent / "backend" / "data" / "scenes")
        self.client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        self.model = "gemini-3.1-flash-image-preview"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _build_prompt(self, visual_metadata: Dict[str, Any], location_name: str) -> str:
        """Build an image generation prompt from VisualMetadata."""
        setting = visual_metadata.get("setting", "")
        surfaces = visual_metadata.get("surfaces_and_containers", []) 
        connections = visual_metadata.get("connections", [])

        # Build structured prompt for atmospheric scene generation
        prompt_parts = [
            f"Generate a dark, atmospheric, noir-style illustration of a detective game scene.",
            f"Location: {location_name}",
            f"Setting: {setting}",
        ]

        if surfaces:
            surface_names = [s.get("id", "") for s in surfaces]
            prompt_parts.append(f"Key elements in the scene: {', '.join(surface_names)}")

        if connections:
            exits = [f"{c.get('mechanism', '')} leading to {c.get('target_location', '')}" for c in connections]
            prompt_parts.append(f"Exits/connections: {', '.join(exits)}")

        prompt_parts.extend([
            "Style: Victorian-era detective noir, moody lighting, rich shadows,",
            "muted color palette with dramatic highlights, watercolor texture.",
            "Perspective: Wide-angle view from the detective's POV.",
            "Do NOT include any text, labels, or UI elements in the image.",
        ])

        return "\n".join(prompt_parts)

    async def generate_scene_image(
        self,
        visual_metadata: Dict[str, Any],
        location_name: str,
        scenario_id: str = "default",
    ) -> Optional[str]:
        """
        Generate a scene image from visual metadata.
        """
        import re
        safe_sid = re.sub(r'[^a-z0-9]', '_', scenario_id.lower())
        
        # Original logic explicitly removed apostrophes entirely, so we must replicate that
        loc_no_apos = location_name.replace("'", "").replace("’", "")
        safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
        
        # Combine and collapse multiple underscores
        combined_name = f"{safe_sid}_{safe_name}"
        expected_file_name = f"{re.sub(r'_+', '_', combined_name).strip('_')}.png"
        expected_file_path = self.output_dir / expected_file_name
        
        if expected_file_path.exists():
            return str(expected_file_path)
            
        prompt = self._build_prompt(visual_metadata, location_name)

        try:
            # Re-initialize client inside to ensure it picks up keys correctly
            client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
            
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)],
                ),
            ]

            generate_content_config = types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(
                    thinking_level="MINIMAL",
                ),
                image_config=types.ImageConfig(
                    aspect_ratio="16:9",
                    image_size="1K",
                ),
            )

            # Generate image (Sync, since python async support in simple loop might hang)
            result = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            )

            file_path = None
            if result.candidates and result.candidates[0].content.parts:
                for part in result.candidates[0].content.parts:
                    if part.inline_data and part.inline_data.data:
                        inline_data = part.inline_data
                        data_buffer = inline_data.data
                        file_extension = mimetypes.guess_extension(inline_data.mime_type) or ".png"

                        file_path = self.output_dir / expected_file_name

                        with open(file_path, "wb") as f:
                            f.write(data_buffer)

                        return str(file_path)

            return file_path

        except Exception as e:
            print(f"⚠️ Scene generation failed for {location_name}: {e}")
            return None

    async def generate_all_scenes(
        self,
        locations: Dict[str, Dict[str, Any]],
        scenario_id: str = "default",
    ) -> Dict[str, Optional[str]]:
        """
        Generate scene images for all locations in a scenario.

        Returns:
            Dict mapping location name → image file path (or None if failed)
        """
        results = {}
        for loc_name, loc_data in locations.items():
            visual_metadata = loc_data.get("visual_metadata", {})
            if visual_metadata:
                path = await self.generate_scene_image(visual_metadata, loc_name, scenario_id)
                results[loc_name] = path
            else:
                results[loc_name] = None
        return results

    async def edit_scene_image(
        self,
        existing_image_path: str,
        edit_prompt: str,
        location_name: str,
        scenario_id: str = "default",
    ) -> Optional[str]:
        """
        Edit an existing scene image (e.g., after visual metadata mutation).

        Args:
            existing_image_path: Path to the existing scene image
            edit_prompt: Description of what changed in the scene
            location_name: Name of the location
            scenario_id: ID for organizing output files

        Returns:
            File path to the edited image, or None if editing fails
        """
        try:
            # Read existing image
            with open(existing_image_path, "rb") as f:
                image_data = f.read()

            file_extension = Path(existing_image_path).suffix
            mime_type = mimetypes.guess_type(existing_image_path)[0] or "image/png"

            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=image_data, mime_type=mime_type),
                        types.Part.from_text(
                            text=f"Edit this detective game scene image: {edit_prompt}. "
                                 f"Maintain the same Victorian noir style and atmosphere."
                        ),
                    ],
                ),
            ]

            generate_content_config = types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
                image_config=types.ImageConfig(image_size="1K"),
                response_modalities=["IMAGE", "TEXT"],
            )

            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            ):
                if chunk.parts is None:
                    continue

                if chunk.parts[0].inline_data and chunk.parts[0].inline_data.data:
                    inline_data = chunk.parts[0].inline_data
                    data_buffer = inline_data.data
                    out_ext = mimetypes.guess_extension(inline_data.mime_type) or file_extension

                    safe_name = location_name.lower().replace(" ", "_").replace("'", "")
                    file_name = f"{scenario_id}_{safe_name}_edited{out_ext}"
                    file_path = self.output_dir / file_name

                    with open(file_path, "wb") as f:
                        f.write(data_buffer)

                    return str(file_path)

            return None

        except Exception as e:
            print(f"⚠️ Scene edit failed for {location_name}: {e}")
            return None

    async def generate_hero_banner(self, title: str, description: str, victim: str, narrative: str, scenario_id: str) -> str | None:
        """
        Generate a high-level hero banner for the entire scenario and save it to disk.
        """
        import re
        safe_sid = re.sub(r'[^a-z0-9]', '_', scenario_id.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        expected_file_name = f"{safe_sid}_hero.png"
        expected_file_path = self.output_dir / expected_file_name
        
        if expected_file_path.exists():
            print(f"  [CACHE] Hero Banner already exists: {expected_file_path}")
            return str(expected_file_path)

        prompt = f"""
You are an expert cinematic storyboard artist and digital painter for a premium mystery detective game.
Your task is to create a SINGLE, wide, breathtaking 'Hero Banner' image that encapsulates the mood and premise of the following murder mystery scenario.

SCENARIO TITLE: {title}
DESCRIPTION: {description}
VICTIM: {victim}
CORE NARRATIVE: {narrative}

REQUIREMENTS:
1.  **Cinematic Composition**: The image should look like a title screen, movie poster, or high-end concept art.
2.  **Mood & Tone**: Capture the specific atmosphere of the mystery (e.g., foggy Victorian London, a sterile high-tech lab, a gritty 1920s speakeasy) based on the description.
3.  **No Text**: Do NOT include any words, titles, or text in the image.
4.  **Key Elements**: Visually hint at the crime, the victim, or the central object of the mystery without giving away the solution.
5.  **Quality**: Highly detailed, dramatic lighting, rich colors, ultra-realistic digital painting style.

Create the hero banner now.
"""
        response = None
        try:
            if self.langfuse:
                trace = self.langfuse.trace(
                    name="generate_hero_banner",
                    tags=["scene_generation", "hero_banner", scenario_id]
                )
                response = await self.client.models.generate_content_async(
                    model=self.model,
                    contents=prompt,
                )
                trace.update(output="Hero Banner Generated successfully")
            else:
                response = await self.client.models.generate_content_async(
                    model=self.model,
                    contents=prompt,
                )

            if response and response.candidates:
                for part in response.candidates[0].content.parts:
                    inline_data = getattr(part, "inline_data", None)
                    if inline_data:
                        data_buffer = inline_data.data
                        with open(expected_file_path, "wb") as f:
                            f.write(data_buffer)
                        print(f"  [GENERATED] Hero Banner saved: {expected_file_path}")
                        return str(expected_file_path)
            
            print(f"  [ERROR] No image data returned for Hero Banner: {scenario_id}")
            return None

        except Exception as e:
            print(f"  [ERROR] generating hero banner: {e}")
            if self.langfuse and 'trace' in locals():
                trace.update(level="ERROR", status_message=str(e))
            return None
