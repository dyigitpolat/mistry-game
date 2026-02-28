"""Download the WhoDunIt dataset from HuggingFace into the data/ directory."""

from datasets import load_dataset
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "whodunit"
DATA_DIR.mkdir(parents=True, exist_ok=True)

print("Downloading kjgpta/WhoDunIt dataset...")
ds = load_dataset("kjgpta/WhoDunIt")

for split_name, split_data in ds.items():
    out_path = DATA_DIR / f"{split_name}.parquet"
    split_data.to_parquet(str(out_path))
    print(f"  Saved {split_name} split ({len(split_data)} rows) -> {out_path}")

print("Done.")
