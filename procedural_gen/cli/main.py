"""CLI entry point: argparse and run."""

import argparse
import sys
from pathlib import Path

from cli.run import get_data_root, run

from src.procedural_gen.game_graph_generator import GameGraphGenerator


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a whodunnit story from data/input/input.json, write to data/output/output.json, then build game graph to data/graphs/graph.json.",
    )
    parser.add_argument(
        "--input",
        "-i",
        default="data/input/input.json",
        metavar="FILE",
        help="Input JSON file. Default: data/input/input.json",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="data/output/output.json",
        metavar="FILE",
        help="Output JSON file. Default: data/output/output.json",
    )
    args = parser.parse_args()

    try:
        result = run(args.input, args.output)
        print("Generated story and saved to", args.output)
        print("Title:", result.get("title", ""))
        print("Culprits:", result.get("culprits", []))
        print("Characters:", result.get("characters", []))
        print("Locations:", result.get("locations", []))
        print("Clues:", result.get("clues", []))
        print("Items:", result.get("items", []))
        print()
        print("--- Story preview (first 500 chars) ---")
        text = result.get("text", "")
        print(text[:500].rstrip())
        if len(text) > 500:
            print("...")

        # Build game graph from output and save to data/graphs/graph.json
        data_root = get_data_root()
        graph_path = data_root / "graphs" / "graph.json"
        graph_path.parent.mkdir(parents=True, exist_ok=True)
        generator = GameGraphGenerator()
        game_graph = generator.generate_graph(result)
        generator.save_graph(game_graph, str(graph_path))
        print()
        print("Graph saved to", graph_path)
    except FileNotFoundError as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
