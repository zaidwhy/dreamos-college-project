"""Generates the sandboxed demo vault: a messy, unorganized flat folder of
sample files across resumes, invoices, meeting notes, code, project docs and
personal notes. Mirrors the "before" state DreamOS is meant to fix - real
content, unhelpful filenames, no folder structure.

Run: python generate_demo_vault.py [--out DIR] [--reset]
"""

import argparse
import shutil
from pathlib import Path

FILES: dict[str, str] = {
    # --- resumes / CVs (messy naming: users keep re-saving the same thing) ---
    "resume_final.txt": """Zaid Ali Syed
B.Tech Information Technology, MGM University (2024 - 2027 expected)

EXPERIENCE
- Built a resume job-fit matcher using embeddings and an LLM scoring layer, deployed on Streamlit.
- Contributed a bug-fix pull request to an open-source GraphQL ORM (gqlalchemy).

SKILLS
Python, FastAPI, React, vector databases (ChromaDB), prompt engineering, Docker.

PROJECTS
- Resume Job-Fit AI: matches a resume against a job description and scores fit with an explanation.
- TCMF: a retrieval-augmented crisis simulation research project on temporal-causal memory fusion.
""",
    "CV2.txt": """CURRICULUM VITAE - Om Vyas
Roll No. 2305170, Department of Information Technology

OBJECTIVE
Seeking a role applying AI to real-world systems, particularly developer tooling and security.

EDUCATION
B.Tech IT, MGM University, expected 2027.

TECHNICAL SKILLS
Python, JavaScript, basic Docker, SQL, Linux fundamentals.
""",
    "Untitled document.txt": """Krushna Kadam - Draft CV, do not send yet

Need to add: internship at local startup (data entry automation using Python scripts).
Need to add: certificate from the cybersecurity workshop, March 2026.

EDUCATION: B.Tech Information Technology, MGM University.
""",
    "final_final_v3.txt": """RESUME (v3 - this is the one to send)
Zaid Ali Syed | sidzaid72@gmail.com

Most recent update: added the DreamOS final year project to the projects section.
Previous versions (final_final_v2, resume_final) are outdated, keep for reference only.
""",

    # --- invoices / billing (financial paperwork, cryptic filenames) ---
    "inv_003.txt": """INVOICE #INV-2026-003
Vendor: BlueRidge Cloud Hosting
Amount Due: INR 4,250.00
Due Date: 2026-04-15
Line items: VPS hosting (March), backup storage add-on.
Status: PAID on 2026-04-10.
""",
    "billing_march.txt": """Billing summary - March 2026
Domain renewal (dreamos-project.dev): INR 899
Ollama Cloud credits top-up: INR 1,500
Total spent this month: INR 2,399
""",
    "scan0007.txt": """[Scanned receipt - OCR text]
MGM UNIVERSITY IICT CANTEEN
Item: Lunch thali x1 -- INR 90
Item: Cold coffee x1 -- INR 40
Total: INR 130
Date: 12-03-2026
""",
    "recieved_payment.txt": """Payment received from freelance client - logo design gig
Amount: INR 6,000
Date: 2026-02-18
Client: Sunrise Bakery (local business, Chhatrapati Sambhajinagar)
Note: still need to send the final invoice PDF for their records.
""",
    "untitled_spreadsheet_notes.txt": """Expense notes (was going to make a spreadsheet, never did)
Books: 1200
Bus pass: 900
Project domain + hosting: 2399
Misc project material (breadboard, sensors for another course): 650
""",

    # --- meeting notes (standups, project syncs) ---
    "notes.txt": """Team sync - DreamOS project
Attendees: Zaid, Om, Krushna
Decided: sandboxed demo vault instead of indexing real files, safer for the faculty demo.
Action item: Zaid to scaffold backend, Om to help test semantic search quality,
Krushna to prep the presentation deck update.
""",
    "mtg_04_12.txt": """Meeting - 2026-04-12
Discussed complexity ranking of the three proposals (Cognitive Spectre, DreamOS, SentinelLLM).
Faculty guide leaned toward DreamOS for "systems-level ambition" - selected it as final project.
Next meeting: review of the knowledge graph design, date TBD.
""",
    "standup.txt": """Daily standup - quick notes
Zaid: indexing pipeline working, embeddings stored in ChromaDB.
Om: comparing recall quality between nomic-embed-text and a second model.
Krushna: gathering more OWASP-style problem framing for the intro slide (from SentinelLLM deck, reused).
""",
    "review_call_transcript.txt": """Guide review call - rough transcript excerpt
Guide: "Make sure the natural language interface actually routes to different modules,
not just search everything."
Zaid: "Understood, we'll add an intent classification step before dispatch."
Guide: "Also keep the demo vault realistic - messy filenames, not clean sample data."
""",
    "followups.txt": """Follow-ups after last review
1. Add a confidence/similarity score to search results, not just a ranked list.
2. Organizer suggestions must be reversible - never overwrite/delete originals silently.
3. Knowledge graph and context memory engine are next-phase, after core 3 modules are solid.
""",

    # --- code snippets (small utility scripts, previous coursework) ---
    "script1.py": '''"""Old lab script: quicksort implementation, kept from DSA coursework."""

def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)
''',
    "test123.py": '''"""Scratch script for testing the Ollama embeddings endpoint locally."""

import requests

def embed(text: str) -> list[float]:
    resp = requests.post(
        "http://127.0.0.1:11434/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": text},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]
''',
    "helper.js": """// leftover helper from an earlier React experiment, unrelated to DreamOS
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

module.exports = { debounce };
""",
    "old_flask_app.py": '''"""Very early prototype - a Flask app for a completely different course project
(library book search). Kept for reference on how we structured routes before
switching this project to FastAPI."""

from flask import Flask, request

app = Flask(__name__)

@app.route("/search")
def search():
    query = request.args.get("q", "")
    return {"query": query, "results": []}
''',
    "sql_practice.txt": """-- DBMS lab practice queries, unrelated to DreamOS but kept in the same drive
SELECT student_name, marks FROM results WHERE marks > 75 ORDER BY marks DESC;
CREATE INDEX idx_marks ON results(marks);
""",

    # --- project docs / specs (the actual project artifacts, badly named) ---
    "spec_v1.txt": """DreamOS - early spec draft (v1, superseded)
Idea: replace folders with tags. (Later revised: full semantic search + knowledge graph.)
Modules originally planned: search, tagging. Expanded later to 6 modules per the proposal deck.
""",
    "proposal_draft.txt": """Final year project proposal - working draft
Three directions considered: Cognitive Spectre (deception platform), DreamOS (semantic OS layer),
SentinelLLM (automated LLM red-teaming). DreamOS chosen: high complexity, futuristic appeal,
strong systems-level scope for a final year submission.
""",
    "architecture_notes.txt": """DreamOS architecture notes
Backend: FastAPI service - indexing, semantic search, AI organizer, NL routing.
Storage: SQLite for file metadata, ChromaDB for embeddings (nomic-embed-text via Ollama).
Frontend: Tauri + React desktop shell, calls the local FastAPI backend.
Local LLM for organizing/tagging/routing: llama3.2 via Ollama.
""",
    "readme_old.txt": """(old readme draft, replaced by the real README.md)
DreamOS turns your messy folder into something you can just ask questions about.
""",
    "module_list.txt": """Core 3 modules (build first):
1. Natural Language Interface
2. Semantic Search Engine
3. AI File Organizer

Deferred until after review:
4. Knowledge Graph
5. Context Memory Engine
6. Intelligent Workspace Manager
""",
    "faculty_feedback.txt": """Feedback from project guide, 2026-04-20
- Like the sandboxed-vault approach for the demo - safer and repeatable.
- Push for the organizer to explain WHY it suggests a category, not just output a label.
- Semantic search needs a visible similarity/confidence score for the demo, not a black box.
""",

    # --- personal / misc (the everyday clutter real vaults have) ---
    "journal_march.txt": """Journal - mid March 2026
Long day. Spent most of it debugging why the vector search kept returning the invoice
files for a query about resumes - turned out the embedding model needed a different
similarity threshold, not a code bug. Relieved once it clicked.
""",
    "recipe.txt": """Amma's chai recipe (don't lose this one)
Water 1 cup, milk 1 cup, tea leaves 2 tsp, ginger crushed, cardamom 2 pods, sugar to taste.
Boil water with ginger + cardamom first, add tea leaves, then milk, simmer, strain.
""",
    "travel_plan.txt": """Weekend trip plan - Ajanta Ellora caves
Leaving Saturday early morning, back by Sunday night.
Need: college ID for student discount at the caves, water bottles, camera.
""",
    "book_notes.txt": """Notes from 'Thinking, Fast and Slow'
System 1 is fast/intuitive, System 2 is slow/deliberate.
Relevant to DreamOS: the NL interface should feel like System 1 (instant), but the
organizer's reasoning should be inspectable like System 2 (explainable).
""",
    "gift_ideas.txt": """Gift ideas list (keep private, for Mom's birthday)
- The cookbook she mentioned last month
- A nice shawl, she liked the blue one at the exhibition
- Maybe a plant for the balcony
""",
    "workout_log.txt": """Workout log, week of 2026-03-09
Mon: 5k run, 27 min
Wed: gym - legs day
Fri: badminton with Om and Krushna after the project meeting
""",
    "password_hint_DO_NOT_SHARE.txt": """Reminder note (not actual passwords, just hints)
College portal: usual pattern + year
Router: sticker on the back of the box
""",
    "quotes.txt": """Quotes I liked this semester
"Make it work, make it right, make it fast." - Kent Beck
"The best folder structure is the one you never have to think about."
""",

    # --- ambiguous / cross-cutting (good for testing search precision) ---
    "misc_notes_v2.txt": """Random notes dump
- Ask Krushna about the OWASP LLM Top 10 slide, might reuse framing style for DreamOS problem statement.
- Remember to back up the ChromaDB folder before the demo, in case reindexing is needed.
- Buy a new charger, old one is fraying.
""",
    "important_dont_delete.txt": """Reminder: the demo vault must stay MESSY on purpose.
If everything gets cleaned and organized before the demo, there's nothing left to
demonstrate the "before" state to faculty. Keep an untouched backup copy.
""",
    "new_doc_2026_03_11.txt": """Untitled notes from a random Tuesday
Thinking the Intelligent Workspace Manager module could suggest "related files" based on
what's been recently opened together, not just semantic similarity alone.
""",
    "backup_of_backup.txt": """This file is a backup of a backup, contents may be stale.
Old idea: let users rename files with natural language too ("call this my March invoice").
Might revisit as a stretch feature after the core 3 modules are demo-ready.
""",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "demo-vault"),
        help="Output directory for the demo vault (default: ../../demo-vault)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete and recreate the output directory before generating files",
    )
    args = parser.parse_args()

    out_dir = Path(args.out)
    if args.reset and out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, content in FILES.items():
        (out_dir / name).write_text(content, encoding="utf-8")

    print(f"Generated {len(FILES)} files in {out_dir}")


if __name__ == "__main__":
    main()
