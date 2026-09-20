# DreamOS - Handoff

Last updated: 2026-09-20

## What this is

Final year B.Tech project (IT Dept, IICT, MGM University). Team: Zaid Ali Syed (2305139), Om Vyas
(2305170), Krushna Kadam (2305165). Private repo `github.com/zaidwhy/dreamos-college-project`, own
venv, no shared code with other projects. Indexes a sandboxed `demo-vault/`, never a real folder.

## State: all six proposed modules are built

Core three (built earlier): Natural Language Interface, Semantic Search, AI Organizer (reversible).
Built 2026-09-20 for the Monitoring on the 24th:

- **Knowledge Graph** (`backend/app/knowledge_graph.py`): `similar` / `references` / `shared_tag`
  edges in `file_edges`, rebuilt after every index run that changed something.
- **Context Memory Engine** (`context_memory.py`): `conversation_turns`, deterministic follow-up
  resolution ("open it", "the second one"), `usage_events` (opens), tie-break by most-opened.
- **Workspace Manager** (`workspace.py`): rule-based recommendations + `workspaces`.
- NL interface gained `related` and `workspace` intents; `/chat` takes a `session_id`.
- Frontend: Chat / Knowledge graph / Workspaces tabs, clickable results, `New chat`.
- 97 backend tests, all offline. CI (`.github/workflows/ci.yml`) now actually exists and passes.

## Decisions worth knowing (not derivable from the code)

- **All derived tables key on `files.id`, not path.** `organizer.apply/revert` renames paths; ids
  survive, so edges, turns, usage and workspace membership never need re-syncing after a move.
- **Graph similarity is mean-centered** (`graph_center_vectors`, thresholds 0.25 similar / 0.9
  duplicate). Measured on the real vault: raw doc-vs-doc cosine has median 0.52, max 0.83, and an
  unrelated pair (`notes`/`spec_v1`, 0.72) outscored a real invoice pair (0.67). Centering separates
  the real groups. Tests run on the raw scale (`isolated_env` in `tests/conftest.py`) with
  hand-built vectors; the centering step has its own tests.
- **Clusters use average-linkage** (`graph_cluster_min_link`), not connected components: two
  attempts at connected components plus density splitting either chained unrelated groups (7-file
  "Cv" mixing resumes with proposals) or destroyed a real group. Average linkage cannot chain.
- **Recommendations are rule-based on purpose** (reproducible, explainable, no extra LLM calls).
- **Intent prompt was evaluated, not guessed:** 32-message set plus a 26-message held-out set on
  real `llama3.2`. Old prompt 80% held-out, new prompt 88% (23 of 26). Remaining misses are
  borderline ("which files should I archive" -> organize).
- Context follow-ups are matched by rules first; the model's `refers_to_previous` flag is only a
  fallback. Bare "open it" is forced to `open` even if the model says `search`.

## Bugs found and fixed while doing this

- `.gitignore` had `*[Repaired]*`, a character class that ignored almost every NEW file (and had
  silently dropped the CI workflow from an earlier commit). Escaped to `*\[Repaired\]*`.
- The Ollama model store on this machine was empty (0 bytes); `nomic-embed-text` and `llama3.2`
  were re-pulled. Check `ollama list` before any demo.
- A long-running backend started before an endpoint was added returns 404 for it (no `--reload`).
  Restart it after backend changes. (The UI swallows failed usage reports on purpose.)

## Known issues / open items

- **Search quality on short generic queries** (pre-existing, not from this work): "meeting" returns
  nothing, "meeting notes" returns `workout_log.txt`. Descriptive queries work. Suspected cause:
  `nomic-embed-text` expects `search_query:` / `search_document:` prefixes that `ollama_client.embed`
  does not add. Fixing it means re-embedding the vault and retuning `search_similarity_threshold`
  (0.55) and the graph thresholds - a decision for Zaid, deliberately not done here.
- One cosmetic label overlap in the graph view between two unlinked files at the bottom.
- The report (`docs/DreamOS-Project-Monitoring-I.docx`) and deck still describe the 50% state.
  `docs/build_report.js` / `docs/build_pptx.js` regenerate them.
- Nothing prunes DB rows for deleted files except `backend/scripts/reset_demo_state.py`.

## How to run the demo

Read `docs/DEMO-SCRIPT.md` - every query in it was run against the real stack. Reset between
rehearsals with `python backend/scripts/reset_demo_state.py`. The release app is built at
`frontend/src-tauri/target/release/frontend.exe` (rebuild: `npm run tauri build`), and
`run-dreamos.bat` prefers it. Verified in the real desktop shell over WebView2 CDP: workspace
"Open all" and click-to-open both work with no permission errors.

## How to resume

Read this file, then `README.md` (architecture map, how to run). `CLAUDE.md` is no longer tracked
(copy in `claude-md-vault`).
