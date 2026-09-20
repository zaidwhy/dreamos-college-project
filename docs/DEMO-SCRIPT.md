# DreamOS - Demo Script (Project Monitoring)

Target length: 10-12 minutes. Read the **Say** lines close to verbatim; **Do** lines are what to
click or type. Every query below was run against the real models and the demo vault, and returns
what is described. Rehearse it once end to end.

## Before you walk in

1. **Models:** run `ollama list` - it must show `nomic-embed-text` and `llama3.2`. (Check this
   first: on 2026-09-20 the model store was found empty and had to be re-pulled, about 2.3 GB.)
2. **Reset to a known state:** `python backend/scripts/reset_demo_state.py`
   (clears rehearsal memory, usage history and workspaces; rebuilds the graph). If you ran the
   organizer during rehearsal, also `python backend/scripts/generate_demo_vault.py --reset`.
3. **Warm the models:** run `run-dreamos.bat` once ahead of time. The first request after a cold
   start can take over a minute while `llama3.2` loads. `run-dreamos.bat` opens the built release
   app (`frontend/src-tauri/target/release/frontend.exe`); if that file is missing run
   `npm run tauri build` in `frontend/` first, otherwise it falls back to a slow `tauri dev`.
4. **Have ready for section 8:** `demo-extras/electricity_bill.txt` (copied into `demo-vault/` live).
5. Do not use short generic queries like "meeting" - see "Known limits" at the bottom.

---

## 1. The problem (30 sec)

**Do:** open a file explorer on `demo-vault/`.

**Say:** "This folder is deliberately messy: names like `final_final_v3`, `Untitled document`,
`scan0007`. It is what a real Downloads folder looks like. DreamOS finds and manages files by what
is *in* them, not what they are called. Nothing here is real personal data - it is a generated
sandbox."

## 2. Launch and architecture (45 sec)

**Do:** launch DreamOS (`run-dreamos.bat`). Point at the three tabs: Chat, Knowledge graph, Workspaces.

**Say:** "A Tauri desktop app over a local FastAPI service. SQLite for metadata, ChromaDB for vectors,
and Ollama running `nomic-embed-text` for embeddings and `llama3.2` for intent. Everything is local:
no cloud calls, no API keys. The proposal had six modules; all six are built."

## 3. Semantic search (60 sec)

**Do:** type `invoice from the hosting vendor`.

**Say:** "Nothing in that filename says 'invoice' or 'hosting'." Result: `inv_003.txt` at ~70% match.
"It matched on meaning: the file is about BlueRidge Cloud Hosting."

**Optional second query:** `bank password reminder` -> `password_hint_DO_NOT_SHARE.txt`.

## 4. Context memory: follow-ups (60 sec)

**Do:** type `find my invoices` (3 results), then `open the second one`, then `open it`.

**Say:** "The second message means nothing on its own. The Context Memory Engine keeps the
conversation, so 'the second one' resolves to `recieved_payment.txt`, and 'it' to the file just
opened. The memory is stored in SQLite, so it survives a restart. New chat wipes it."

## 5. Usage memory resolves ambiguity (75 sec)

**Do:** type `open my resume`.

**Say:** "There are two close candidates, so it refuses to guess - opening the wrong person's CV in
front of you would be worse than asking." Cards for `final_final_v3.txt` and `resume_final.txt` appear.
**Do:** click **Open** on `final_final_v3.txt`, then type `open my resume` again.

**Say:** "It has now learned which one I actually open, and opens it directly." (Usage history
is what the Workspace Manager mines later.)

## 6. Knowledge graph (90 sec)

**Do:** in chat type `what's related to my resume` - cards show pills such as "referenced" and
"similar content". Then open the **Knowledge graph** tab and click the `final_final_v3.txt` node.

**Say:** "Every file is a node, coloured by category. Edges are three kinds: similar content, a file
that names another file - that orange arrow: `final_final_v3` literally says 'previous versions:
resume_final' - and shared tags. Clicking a node shows what it is connected to and why. The clusters
you see - resumes, invoices, code - were never defined by me."

(Technical aside if asked: embeddings are mean-centered before comparison, because raw
`nomic-embed-text` similarity is compressed - median 0.52 across all file pairs. Raw, an unrelated
pair (`notes.txt` and `spec_v1.txt`, 0.72) outscored a genuine invoice pair (`inv_003` and
`recieved_payment`, 0.67). After centering, the real groups rank at the top.)

## 7. Workspace manager (90 sec)

**Do:** type `suggest some workspaces`, or open the **Workspaces** tab. Click
**Create 'Invoices' workspace**, then **Open all**.

**Say:** "The Workspace Manager suggests groups from the graph: four related invoice files. These are
rule-based and explainable, not LLM guesses, so they are reproducible. One click makes it a workspace
that opens all its files together. It also flags frequently used files, near-duplicates and stale
files as you use the system."

## 8. AI organizer with revert (2 min)

**Do:** copy `demo-extras/electricity_bill.txt` into `demo-vault/`, click **Reindex vault** (the status
line shows the graph gaining links), then type `organize my files`.

**Say:** "It reads the new file, proposes a category with a reason, and moves nothing yet." Read the
reasoning aloud. **Do:** click **Apply** (file moves to `invoices/`), then **Undo**.

**Say:** "And it is reversible: the file goes back and the empty folder is cleaned up. An AI that
reorganises files only earns trust if undoing is as reliable as doing."

## 9. Engineering rigour (60 sec)

**Do:** in a terminal in `backend/`: `./.venv/Scripts/python.exe -m pytest -q`

**Say:** "97 tests, fully offline - the embeddings and LLM are mocked, so they need no Ollama. They also
run on every push in CI. Beyond unit tests I measured the intent router on the real model: 88% on
phrasings it was not tuned on, and the failures are documented, not hidden."

## 10. Scope and next steps (45 sec)

**Say:** "All six proposed modules are implemented, tested and packaged as a Windows installer. What
remains is depth, not features: better retrieval for short queries, scaling the graph beyond a small
vault, and the final report and paper."

---

## Known limits (say them if asked; do not hide them)

- **Short generic queries** like "meeting" return nothing above the similarity threshold, and
  "meeting notes" returns the wrong files. Descriptive queries work: `notes from the faculty review
  call` -> `review_call_transcript.txt`. A likely cause is that `nomic-embed-text` expects
  `search_query:` / `search_document:` prefixes that the pipeline does not add.
- **Intent routing** is a 3B model: 23 of 26 held-out phrasings routed correctly. "Which files should
  I archive" can be read as `organize`.
- **Graph clustering** is conservative, so some related files (e.g. the personal notes) stay unlinked.
- Similarity is pairwise: fine for tens to low hundreds of files, not thousands.

## If something breaks live

- **First reply is very slow:** the model is loading. Say so, wait, and carry on.
- **Wrong or empty search:** switch to one of the verified queries above; do not debug on stage.
- **App will not launch:** start the backend (`./.venv/Scripts/python.exe -m uvicorn app.main:app
  --port 8420` in `backend/`) and use `npm run tauri dev`, or narrate from the architecture diagram in
  `docs/diagrams/`.
