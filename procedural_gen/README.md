# procedural-gen

Procedural generation of whodunnit mystery stories from user inputs.

## Usage

```bash
uv run procedural-gen [input_id]   # default input_id: 1
# or
uv run python main.py [input_id]
```

Input: `data/input/<id>.json` (e.g. `{"culprit_names": ["Professor Moriarty"]}`).  
Output: `data/output/<id>.json` with: `title`, `culprits`, `characters` (non-culprit role characters), `locations`, `clues`, `items` (evidence), and `story` (full narrative).
