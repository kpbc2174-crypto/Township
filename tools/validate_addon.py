from __future__ import annotations

import json
import sys
from pathlib import Path

BP = Path("Township BP")
RP = Path("Township RP")


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Invalid JSON: {path}: {exc}")


def main() -> None:
    for root in (BP, RP):
        if not root.is_dir():
            fail(f"Missing pack root: {root}")
        if not (root / "manifest.json").is_file():
            fail(f"Missing manifest: {root / 'manifest.json'}")

    bp_manifest = load_json(BP / "manifest.json")
    rp_manifest = load_json(RP / "manifest.json")

    bp_uuid = bp_manifest["header"]["uuid"]
    rp_uuid = rp_manifest["header"]["uuid"]

    bp_dependencies = {item.get("uuid") for item in bp_manifest.get("dependencies", [])}
    rp_dependencies = {item.get("uuid") for item in rp_manifest.get("dependencies", [])}
    if rp_uuid not in bp_dependencies:
        fail("Behavior Pack does not depend on the Resource Pack UUID.")
    if bp_uuid not in rp_dependencies:
        fail("Resource Pack does not depend on the Behavior Pack UUID.")

    count = 0
    for root in (BP, RP):
        for path in root.rglob("*.json"):
            load_json(path)
            count += 1

    print(f"Validated {count} JSON files and BP/RP manifest linking.")


if __name__ == "__main__":
    main()
