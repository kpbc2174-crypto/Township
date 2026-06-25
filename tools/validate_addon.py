from __future__ import annotations

import json
from pathlib import Path

BP = Path("src/behavior_pack")
RP = Path("src/resource_pack")

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        raise SystemExit(f"Invalid JSON: {path}: {error}")

def main() -> None:
    bp = load_json(BP / "manifest.json")
    rp = load_json(RP / "manifest.json")
    if rp["header"]["uuid"] not in {x.get("uuid") for x in bp.get("dependencies", [])}:
        raise SystemExit("BP does not depend on the RP UUID.")
    if bp["header"]["uuid"] not in {x.get("uuid") for x in rp.get("dependencies", [])}:
        raise SystemExit("RP does not depend on the BP UUID.")
    for root in (BP, RP):
        for path in root.rglob("*.json"):
            load_json(path)
    print("Township JSON and BP/RP dependency validation passed.")

if __name__ == "__main__":
    main()
