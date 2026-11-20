#!/usr/bin/env python3
"""Render top-level docs/*.md pages as A4 PDFs in docs/deliverables/.

Requires pandoc, WeasyPrint, and BeautifulSoup. Local images are resolved
relative to docs/, so the PlantUML SVGs should exist before running this.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup
from weasyprint import CSS, HTML


def markdown_to_html(markdown: Path, docs_dir: Path) -> str:
    result = subprocess.run(
        [
            "pandoc",
            "--from=gfm",
            "--to=html5",
            "--wrap=none",
            "--no-highlight",
            str(markdown.name),
        ],
        cwd=docs_dir,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Pandoc failed for {markdown.name}:\n{result.stderr}")
    return result.stdout


def prepare_html(fragment: str, source: Path, docs_dir: Path) -> str:
    soup = BeautifulSoup(fragment, "html.parser")

    # HTML <details> blocks are interactive on GitHub but must be expanded in PDFs.
    for details in soup.find_all("details"):
        details["open"] = ""

    # Report missing diagrams rather than quietly producing a PDF without one.
    for img in list(soup.find_all("img", src=True)):
        src = str(img.get("src"))
        parsed = urlparse(src)
        if parsed.scheme or src.startswith("//") or src.startswith("#"):
            continue
        local_path = (docs_dir / unquote(parsed.path)).resolve()
        if local_path.is_file():
            continue
        if "assets/diagrams/plantuml/" in src:
            raise FileNotFoundError(
                f"{source.name}: missing generated UML diagram: {src}. "
                "Run the PlantUML generation step first."
            )
        print(f"Warning: {source.name}: missing image: {src}", file=sys.stderr)
        missing = soup.new_tag("div", attrs={"class": "missing-image"})
        missing.string = f"Slika nije dostupna: {img.get('alt') or src}"
        img.replace_with(missing)

    title = source.stem.replace("-", " ")
    return (
        "<!doctype html><html lang='hr'><head>"
        "<meta charset='utf-8'>"
        f"<title>{title}</title>"
        "</head><body>"
        f"{soup}"
        "</body></html>"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-dir", type=Path, default=Path("docs"))
    args = parser.parse_args()

    docs_dir = args.docs_dir.resolve()
    target_dir = docs_dir / "deliverables"
    stylesheet = Path(__file__).resolve().parent / "doc-pdf.css"
    if not docs_dir.is_dir():
        parser.error(f"Documentation directory not found: {docs_dir}")
    if not stylesheet.is_file():
        parser.error(f"PDF stylesheet not found: {stylesheet}")

    sources = sorted(docs_dir.glob("*.md"))  # Chapter pages, appendix and Home.
    if not sources:
        parser.error(f"No top-level Markdown pages found in {docs_dir}")

    target_dir.mkdir(parents=True, exist_ok=True)
    css = CSS(filename=str(stylesheet))
    for source in sources:
        fragment = markdown_to_html(source, docs_dir)
        html = prepare_html(fragment, source, docs_dir)
        target = target_dir / f"{source.stem}.pdf"
        HTML(string=html, base_url=docs_dir.as_uri() + "/").write_pdf(
            str(target), stylesheets=[css]
        )
        if target.stat().st_size < 1000:
            raise RuntimeError(f"Generated PDF looks empty: {target}")
        print(f"Created {target.relative_to(docs_dir)} ({target.stat().st_size:,} bytes)")
    print(f"Generated {len(sources)} PDF files.")


if __name__ == "__main__":
    main()
