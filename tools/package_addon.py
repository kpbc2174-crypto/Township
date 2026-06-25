from __future__ import annotations

import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ((ROOT / "src/behavior_pack", "Township BP"), (ROOT / "src/resource_pack", "Township RP"))

def main() -> None:
    versions = [json.loads((root / "manifest.json").read_text(encoding="utf-8"))["header"]["version"] for root, _ in SOURCE]
    if versions[0] != versions[1]:
        raise SystemExit(f"BP/RP version mismatch: {versions}")
    output = ROOT / "dist" / ("Township_v" + "_".join(map(str, versions[0])) + ".mcaddon")
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, package_name in SOURCE:
            for path in root.rglob("*"):
                if path.is_file():
                    archive.write(path, (Path(package_name) / path.relative_to(root)).as_posix())
    print(output)

if __name__ == "__main__":
    main()
