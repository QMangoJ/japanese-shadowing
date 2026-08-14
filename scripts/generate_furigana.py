#!/usr/bin/env python3
"""Generate complete Ruby readings from the canonical Japanese transcript text.

The other Japanese-learning project keeps its text and pronunciation separate:
verified plain Japanese is the source of truth, then pykakasi creates ruby
annotations at build time.  This avoids relying on a scan OCR engine to read
tiny printed furigana mixed with the main dialogue.

Run from the repository root:
  python3 scripts/generate_furigana.py
  python3 scripts/generate_furigana.py --only 10

Input/output: public/transcripts/jp/*.txt -> public/transcripts/jp-ruby/*.txt
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import pykakasi

ROOT = Path(__file__).resolve().parents[1]
KANJI = re.compile(r"[㐀-鿿豈-﫿々〆]")
RUBY_TOKEN = re.compile(r"\{\{.+?\|.+?\}\}")
KAKASI = pykakasi.kakasi()


def ruby(text: str) -> str:
    """Return the app's {{surface|reading}} representation for every kanji term."""
    if not text or not KANJI.search(text):
        return text
    result: list[str] = []
    for item in KAKASI.convert(text):
        original = item["orig"]
        reading = item["hira"]
        if not KANJI.search(original) or not reading:
            result.append(original)
            continue

        # Keep shared kana outside Ruby, e.g. 食べる -> {{食|た}}べる.
        base, kana = original, reading
        suffix = ""
        prefix = ""
        while base and kana and base[-1] == kana[-1]:
            suffix = base[-1] + suffix
            base, kana = base[:-1], kana[:-1]
        while base and kana and base[0] == kana[0]:
            prefix += base[0]
            base, kana = base[1:], kana[1:]
        if not base or not kana or not KANJI.search(base):
            result.append(original)
            continue
        result.append(f"{prefix}{{{{{base}|{kana}}}}}{suffix}")
    return "".join(result)


def ruby_document(text: str) -> str:
    """Fill only missing ruby, keeping existing book-derived readings as overrides."""
    ending = "\n" if text.endswith("\n") else ""
    lines: list[str] = []
    for line in text.splitlines():
        parts: list[str] = []
        cursor = 0
        for match in RUBY_TOKEN.finditer(line):
            parts.append(ruby(line[cursor:match.start()]))
            parts.append(match.group(0))
            cursor = match.end()
        parts.append(ruby(line[cursor:]))
        lines.append("".join(parts))
    return "\n".join(lines) + ending


def ruby_directories() -> list[tuple[Path, Path]]:
    return [
        (ROOT / "public" / "transcripts" / "jp", ROOT / "public" / "transcripts" / "jp-ruby"),
        # The intermediate book source PDF has not yet been supplied, so its
        # existing ruby transcript remains the canonical source for now.
        (ROOT / "public" / "transcripts" / "intermediate" / "jp-ruby", ROOT / "public" / "transcripts" / "intermediate" / "jp-ruby"),
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate complete Japanese ruby transcripts.")
    parser.add_argument("--only", type=int, nargs="*", help="Section/track numbers to regenerate.")
    parser.add_argument("--check", action="store_true", help="Report planned output without writing files.")
    options = parser.parse_args()

    targets = {f"{number:02d}.txt" for number in options.only} if options.only else None
    generated = 0
    for source_dir, output_dir in ruby_directories():
        for source in sorted(source_dir.glob("*.txt")):
            if targets and source.name not in targets:
                continue
            source_text = source.read_text(encoding="utf-8")
            output = ruby_document(source_text)
            if not options.check:
                (output_dir / source.name).write_text(output, encoding="utf-8")
            generated += 1
    action = "Checked" if options.check else "Generated"
    print(f"{action} complete ruby text for {generated} transcript files.")


if __name__ == "__main__":
    main()
