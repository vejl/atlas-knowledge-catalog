"""Build a static browser demo and a source download. No credentials or live data."""
from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

from package import ROOT, START_HERE, source_files

SITE = ROOT / "web" / "atlas-demo"
DIST = SITE / "dist"


def build():
    DIST.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "static", DIST / "static", dirs_exist_ok=True)
    shutil.copytree(ROOT / "samples", DIST / "samples", dirs_exist_ok=True)
    (DIST / "demo").mkdir(exist_ok=True)
    shutil.copy2(ROOT / "atlas" / "seed.json", DIST / "demo" / "seed.json")
    index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    index = index.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="atlas-mode" content="browser-demo">')
    index = index.replace('<title>Atlas — Team knowledge, connected</title>', '<title>Atlas — Browser demo</title>')
    (DIST / "index.html").write_text(index, encoding="utf-8")
    (DIST / "404.html").write_text((ROOT / "static" / "not-found.html").read_text(encoding="utf-8"), encoding="utf-8")
    (DIST / "downloads").mkdir(exist_ok=True)
    download = DIST / "downloads" / "atlas-source.zip"
    with ZipFile(download, "w", ZIP_DEFLATED) as archive:
        archive.writestr("START-HERE.txt", START_HERE)
        for path, relative in source_files():
            archive.write(path, "atlas/" + relative.as_posix())
    (DIST / "_headers").write_text("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\n", encoding="utf-8")
    print(DIST)
    print("Source download: " + str(download))


if __name__ == "__main__":
    build()
