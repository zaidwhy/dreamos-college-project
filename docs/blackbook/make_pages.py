"""Finds the printed page number of every Table / Figure caption in the exported report PDF and
writes pages.json (read by build_blackbook.js for the lists and in-text page references).

Usage: py -3.14 docs/blackbook/make_pages.py [path-to-pdf]
Body pages are those whose running header contains the report title; the printed page number is
the 1-based position of the page within that run (the body section restarts numbering at 1).
Captions are recognised as bold lines starting with 'Table <n>' / 'Figure <n>' / 'Table B.1'.
"""
import json
import re
import sys
from pathlib import Path

import fitz

HERE = Path(__file__).resolve().parent
pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "DreamOS-Final-Year-Project-Report.pdf"
doc = fitz.open(pdf)
HEADER = "IICT, MGM University 2026-2027"

body_start = None
for i, page in enumerate(doc):
    if HEADER in page.get_text():
        body_start = i
        break
if body_start is None:
    sys.exit("no body pages found (header text missing)")

pat = re.compile(r"^(Table [A-Z0-9]+\.[0-9]+|Figure [0-9]+\.[0-9]+) - ")
pages = {}
for i in range(body_start, len(doc)):
    printed = i - body_start + 1
    for block in doc[i].get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = line["spans"]
            if not spans:
                continue
            text = "".join(s["text"] for s in spans)
            m = pat.match(text)
            if not m:
                continue
            label = m.group(1)
            pages.setdefault(label, printed)

out = HERE / "pages.json"
old = json.loads(out.read_text()) if out.exists() else {}
out.write_text(json.dumps(dict(sorted(pages.items())), indent=2))
print("body starts at pdf page", body_start + 1, "| captions found:", len(pages), "| changed:", pages != old)
