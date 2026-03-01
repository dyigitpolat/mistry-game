import json
import os
from pathlib import Path
from pydantic import ValidationError
from app.models.scenario import Scenario

def validate():
    new_data_path = Path("/Users/aishiknagar/Desktop/mistry-game-main/backend/data/new_data")
    files = list(new_data_path.glob("*.json"))
    
    success = 0
    failed = 0
    for f in files:
        try:
            with open(f, "r") as file:
                data = json.load(file)
            Scenario.model_validate(data)
            success += 1
        except ValidationError as e:
            print(f"Validation FAILED for {f.name}: {e}")
            failed += 1
        except Exception as e:
            print(f"Error reading {f.name}: {e}")
            failed += 1
            
    print(f"Validation summary: {success} success, {failed} failed.")

if __name__ == "__main__":
    validate()
