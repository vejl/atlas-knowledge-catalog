"""Package only explicitly allowed source files; never include credentials or local data."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "outputs" / "atlas-source.zip"
DIRECTORIES = {"atlas", "static", "samples", "scripts", "tests", "docs", ".github"}
FILES = {".env.example", ".gitignore", "README.md", "LICENSE", "requirements.txt",
         "requirements-dev.txt", "requirements-lock.txt", "run.py", "start-atlas.cmd",
         "PRODUCT.md", "DESIGN.md", ".impeccable/design.json"}
START_HERE = """ATLAS - FULL LOCAL APPLICATION

1. Install Python 3.14 if it is not already installed.
2. Extract this ZIP. On Windows, open the atlas folder and double-click start-atlas.cmd.
3. Open http://127.0.0.1:8000 in your browser. Keep the terminal open.

The catalogue and CSV checker work without an AI key. For real AI proposals,
copy atlas/.env.example to atlas/.env and add your own compatible provider key.
Never share that key. Windows/macOS/Linux steps are in atlas/README.md.
This archive contains source code, not an embedded Python installation.
"""


def source_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if rel.as_posix() in {"docs/learning-sk.md", "docs/project-status-sk.md"}:
            continue
        if any(part in {"__pycache__", ".pytest_cache", ".git", ".venv"} for part in rel.parts):
            continue
        if path.suffix in {".pyc", ".sqlite3", ".db", ".log"} or (path.name.startswith(".env") and path.name != ".env.example"):
            continue
        if rel.parts[0] in DIRECTORIES or rel.as_posix() in FILES:
            yield path, rel


if __name__ == "__main__":
    DESTINATION.parent.mkdir(exist_ok=True)
    with ZipFile(DESTINATION, "w", ZIP_DEFLATED) as archive:
        archive.writestr("START-HERE.txt", START_HERE)
        for path, relative in source_files():
            archive.write(path, "atlas/" + relative.as_posix())
    print(DESTINATION)
