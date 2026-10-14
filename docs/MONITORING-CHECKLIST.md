# Final Monitoring - 14 Oct 2026, 3 PM, FF44

Guide: Dr. Minakshi R. Rajput. Team: Zaid Ali Syed (2305139), Om Vyas (2305170), Krushna Kadam (2305165).

## What the panel asked for, and where it is

| # | Requirement | Where |
|---|---|---|
| 1 | Complete implementation and demonstration | `run-dreamos.bat` (release app); script in `docs/DEMO-SCRIPT.md` (sections 1-10, about 12 min) |
| 2 | Results and testing | Deck "Part 4"; report Chapters 6 and 7; `python -m pytest -q` in `backend/` (123 tests) |
| 3 | Results validation | Deck "How we know the results are right"; report Section 7.2.2; `docs/benchmarks/*.json`; scripts `backend/scripts/eval_retrieval.py`, `bench_scale.py` |
| 4 | Individual contribution | Deck "Individual contribution"; report Appendix D |
| 5 | Project report soft copy | `docs/blackbook/DreamOS-Final-Year-Project-Report.docx` and `.pdf` (43 pages) |
| 6 | Final PPT | `docs/deck/DreamOS-Final-Monitoring.pptx` and `.pdf` (30 slides) |

Extra: IEEE paper `docs/paper/DreamOS-IEEE-Paper.pdf` (6 pages; anonymous copy for double-blind review).

## Before 3 PM (10 minutes)

1. Ollama running: `ollama list` shows `nomic-embed-text` and `llama3.2` (the app also shows a banner if not).
2. `python backend/scripts/reset_demo_state.py` (clears rehearsal memory and workspaces).
3. `run-dreamos.bat` once to warm the models; ask one question and wait for the answer.
4. `demo-extras/electricity_bill.txt` ready for the organiser step.
5. Copy `monitoring-pack/` to a pen drive as a backup.

## Numbers you may be asked for (all from committed result files)

- Retrieval, 36 labelled queries: DreamOS first-place 94% (MRR 0.97), BM25 56% (0.61), filename 33% (0.35). No shared word (10): 0.80 vs 0.00 vs 0.00.
- Scale (500 / 2,000 / 5,000 synthetic files): graph rebuild 0.4 / 1.3 / 3.2 s; index 25 / 86 / 276 s; search p50 35 / 107 / 205 ms; precision@5 1.00 (synthetic topics only).
- Before fixes: graph rebuild 17 / 246 s at 500 / 2,000 files; 143 s at 5,000 after vectorising similarity only.
- Intent routing: 88% (23 of 26) on held-out phrasings. 123 automated tests.
- Honest limits: 36 queries written by the team; baselines are our reference implementations, not the commercial products; synthetic scale data; dense similarity matrix (about 200 MB at 5,000 files).
