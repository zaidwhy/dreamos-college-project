# DreamOS

Final year B.Tech project (Dept. of Information Technology, IICT, MGM University).
Team: Zaid Ali Syed (2305139), Om Vyas (2305170), Krushna Kadam (2305165).

> Current operating systems organize files by folders. DreamOS organizes information by
> meaning - users describe what they need, and the system understands intent to retrieve it.

An AI-native desktop shell that replaces folders and filenames with semantic,
natural-language file understanding: a local FastAPI backend indexes a folder into a vector
store + knowledge base, and a Tauri + React desktop app lets you search and organize it by
describing what you want instead of remembering exact names or paths.

## Status

All six modules from the project proposal are built, tested, and packaged:

- **Natural Language Interface** - a chat-style input that classifies intent (search, open,
  related, workspace, organize) and routes to the right module (`backend/app/nl_interface.py`).
  "Open" intents (e.g. "open my resume") resolve to the best-matching file and launch it in its
  default OS application via Tauri's opener plugin, scoped to `$HOME/**` in
  `frontend/src-tauri/capabilities/default.json`.
- **Semantic Search Engine** - natural-language queries over the vault via embeddings +
  ChromaDB, with a tuned similarity threshold (`backend/app/search.py`)
- **AI File Organizer** - LLM-generated summary/tags/category per file, with a reversible
  apply/revert move into semantic folders (`backend/app/organizer.py`)
- **Knowledge Graph** - typed, weighted relationships between files: similar content
  (mean-centered embedding similarity), direct references (one file names another), and shared
  AI tags. Clusters come from average-linkage merging. Shown as an interactive graph in the app
  (`backend/app/knowledge_graph.py`)
- **Context Memory Engine** - conversation turns persisted per session, so follow-ups such as
  "open it", "open the second one" or "what's related to that" resolve against what was just
  shown. Also records which files you open, which breaks near-ties later
  (`backend/app/context_memory.py`)
- **Intelligent Workspace Manager** - proactive, explainable recommendations (related groups,
  frequently used files, duplicates, unorganized files, stale files) and named workspaces that
  open all their files in one click (`backend/app/workspace.py`)

## Architecture

```
demo-vault/          sandboxed sample data (messy, unorganized - see CLAUDE.md)
backend/              FastAPI service
  app/
    config.py         settings (paths, model names, similarity threshold)
    ollama_client.py   embeddings + JSON generation via local Ollama
    db.py              SQLite schema + connection helper
    extractors.py       text extraction + chunking
    indexer.py          walks the vault, embeds, upserts into Chroma + SQLite
    vectorstore.py       ChromaDB persistent client wrapper
    search.py            semantic search with similarity threshold + top-k dedupe
    organizer.py          AI categorization + reversible apply/revert
    knowledge_graph.py    file relationships (edges keyed by file id) + clustering
    context_memory.py     session memory, follow-up resolution, usage tracking
    workspace.py          recommendations + named workspaces
    nl_interface.py       intent classification + routing
    main.py               FastAPI routes
  tests/               offline pytest suite (mocked embeddings/LLM, no Ollama needed)
frontend/             Tauri + React desktop shell
  src/
    api.ts             typed fetch client for the backend (+ persisted session id)
    App.tsx            tabbed shell: Chat, Knowledge graph, Workspaces
    components/        Results (search/organize/workspace cards), GraphView (d3-force SVG),
                       WorkspacePanel, WorkspaceCards
    openFile.ts        opens files via the Tauri opener and reports usage
  src-tauri/           Rust/Tauri shell
```

## Running it

**One-click:** double-click `run-dreamos.bat` (or run `run-dreamos.ps1` in PowerShell). It
starts Ollama if it's not already running, pulls `nomic-embed-text`/`llama3.2` if missing,
starts the backend if it's not already running, indexes the vault, launches the app (the
built release exe if present, otherwise falls back to `npm run tauri dev`), and waits for
the window to close. On exit it stops only what it started - Ollama is left running if it
was already up, since other local projects share the same instance.

Manual steps, if you'd rather run each piece yourself:

**1. Start Ollama** (desktop app or `ollama serve`) with `nomic-embed-text` and `llama3.2`
pulled.

**2. Start the backend:**

```
cd backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8420
```

**3. Index the demo vault** (first run, or after regenerating it):

```
curl -X POST http://localhost:8420/index
```

**4. Start the desktop app:**

```
cd frontend
npm run tauri dev
```

Type a request like "find my resume" or "organize my unsorted files" into the DreamOS
window. Follow-ups work too: "find my invoices", then "open the second one". Other things
to try: "what's related to my resume", "suggest some workspaces". The Knowledge graph and
Workspaces tabs show the same data visually.

## Building an installer

```
cd frontend
npm run tauri build
```

Produces both a Windows installer at
`frontend/src-tauri/target/release/bundle/msi/DreamOS_0.1.0_x64_en-US.msi` and
`frontend/src-tauri/target/release/bundle/nsis/DreamOS_0.1.0_x64-setup.exe`. Either installs
DreamOS as a standalone desktop app with a Start Menu entry - the backend (Ollama + the
FastAPI service) still needs to be running separately, the installer only packages the
Tauri/React shell. Build artifacts are gitignored (`target/`), not committed - rebuild
locally with the command above whenever you need a fresh installer.

## Tests

```
cd backend
./.venv/Scripts/python.exe -m pytest -v
```

107 tests, fully offline - embeddings and LLM calls are mocked via fixtures in
`tests/conftest.py`, so no Ollama instance is required to run them. They run on every push
in CI (`.github/workflows/ci.yml`).

## Regenerating the demo vault

```
python backend/scripts/generate_demo_vault.py --reset
```

See `CLAUDE.md` for scope decisions, the embedding-similarity tuning note, and why the vault
is sandboxed rather than a real personal folder.

## Known limitations

- **Intent routing** uses a 3B local model (`llama3.2`). Measured on phrasings the prompt was
  never tuned on, it routes 23 of 26 messages correctly (88%); borderline wording such as "which
  files should I archive" can land on `organize` instead of `workspace`.
- **Search on very short queries is best-effort.** On a 31-query labelled set (`meeting`, `python`,
  `invoice`, plus descriptive and off-topic ones) a correct file appears for 27 of 27 valid
  queries and ranks first for 24 of 27 (13 of 14 on the held-out half). It works by returning files
  near the best hit rather than above one fixed score, plus a small keyword boost (details in
  `backend/app/search.py`). Weak matches are shown as "low confidence" and `open` will not launch
  them. A one-word query can still rank a file that merely contains the word first (`meeting notes`
  ranks `workout_log.txt`, which mentions a project meeting, above the real meeting notes), and
  off-topic file-shaped queries return low-confidence guesses instead of nothing.
- **Graph clustering** is deliberately conservative: some genuinely related files (e.g. the
  personal notes) stay unlinked rather than risk grouping unrelated ones.
- Similarity is computed pairwise, which is fine at vault scale (tens to low hundreds of
  files) but would need an approximate method for very large collections.

## Project Monitoring - I report

`docs/DreamOS-Project-Monitoring-I.docx` is the department deliverable for the Project
Monitoring - I checkpoint: literature review, requirement analysis, system design (architecture,
DFDs, UML, ER diagram, wireframe), and current implementation status. Diagram sources are in
`docs/diagrams/`.
