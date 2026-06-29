import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

for b64_file in ROOT.rglob("*.png.b64"):
    png_file = b64_file.with_suffix("")
    data = "".join(b64_file.read_text(encoding="utf-8").split())
    png_file.write_bytes(base64.b64decode(data))
    print(f"Decoded {b64_file.relative_to(ROOT)} -> {png_file.relative_to(ROOT)}")
