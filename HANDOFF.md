# DreamOS - Handoff

Last updated: 2026-10-06

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
- 107 backend tests, all offline. CI (`.github/workflows/ci.yml`) now actually exists and passes.

## Session 2026-10-06: scale, privacy, final deck and report

- **Privacy audit** (`backend/app/privacy.py`, `GET /privacy/audit`, Privacy tab in the app): reads
  live config, lists each network endpoint and whether it is loopback. Does not inspect traffic;
  the report says to check with `netstat -ano` (backend must listen on 127.0.0.1 only).
- **Two measured fixes:**
  - `localhost` resolved to IPv6 first on this machine, adding about 1 s to every embedding call.
    Config, frontend API and the demo-vault generator now use `127.0.0.1`. Embedding calls drop to
    about 15 ms; search p50 went from about 2 s to about 50 ms.
  - Knowledge-graph similarity is now a NumPy matrix product, and shared tags use an inverted
    index. An equivalence test checks it against the original loop on random vectors.
- **Scale benchmark** `backend/scripts/bench_scale.py` (synthetic vaults, real models; one process
  per size). Summary committed in `docs/benchmarks/`; raw output lives in `backend/data/bench/`,
  which is gitignored. Results after the fixes: 500 files index 19.4/s, graph 1.7 s, search p50 51
  ms; 2,000 files graph 24.8 s (was 246 s); 5,000 files index 11.2/s, graph 143 s, search p50 204
  ms. **The graph rebuild is still the limit at 5,000 files.** Its reference check and clustering
  remain pairwise.
- **Final deck** `docs/deck/build_deck_final.js` -> `DreamOS-Final-Monitoring.pptx` (27 slides,
  checked in PowerPoint). **Blackbook** `docs/blackbook/build_blackbook.js` ->
  `DreamOS-Final-Year-Project-Report.docx` (31 pages, index format, TOC populated in Word). Both read
  `docs/benchmarks/`.
- **Tests: 116 passing** (`backend/.venv`). CI green on the last pushes.
- **Environment:** the backend `.venv` had disappeared and was rebuilt from `requirements.txt`
  (numpy is now pinned there). `frontend/node_modules` was reinstalled with `npm ci`.

**Resolved 2026-10-10:** guide is Dr. Minakshi R. Rajput (blackbook cover, certificate,
acknowledgement, deck title slide, paper acknowledgement). MGM logo (`docs/assets/mgm-logo.png`) is on
the blackbook cover and certificate and the deck title slide. IoT upgrade dropped by Zaid.
**Also open:** IEEE paper (`docs/paper/`) needs guide + RM faculty approval before submission, then
submission proof goes to the RM faculty; reformat to the venue template once conference links arrive.

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
- Context follow-ups are matched by rules first (ordinals, bare "it"/"that"); the model's
  `refers_to_previous` flag is only a last resort, tried after a confident direct search on the
  extracted `query` has already failed (`_open`/`_related` in `nl_interface.py`, fixed 2026-09-23 -
  see below). Bare "open it" is forced to `open` even if the model says `search`.

## Bugs found and fixed while doing this

- `.gitignore` had `*[Repaired]*`, a character class that ignored almost every NEW file (and had
  silently dropped the CI workflow from an earlier commit). Escaped to `*\[Repaired\]*`.
- The Ollama model store on this machine was empty (0 bytes); `nomic-embed-text` and `llama3.2`
  were re-pulled. Check `ollama list` before any demo.
- A long-running backend started before an endpoint was added returns 404 for it (no `--reload`).
  Restart it after backend changes. (The UI swallows failed usage reports on purpose.)
- **Stale context override, FIXED 2026-09-23.** Reported live via screenshot: "find my invoices"
  then "what's related to my resume" answered about an invoice file. Root cause, confirmed by
  calling the classifier directly: `llama3.2` deterministically sets `refers_to_previous: true` for
  "what's related to my resume" (it echoes the "what's related to X" example in the system prompt),
  even though `query: "resume"` is correctly extracted and a real, independently-searchable topic.
  `_open`/`_related` trusted that flag unconditionally, via a single `referenced` value computed in
  `handle_message`. Fixed by splitting it into `referenced` (rule-based only, trusted first) and
  `weak_referenced` (also accepts the model flag, tried only if a direct search on `query` comes up
  empty or below `search_similarity_threshold`). Reverting the precedence made the new regression
  tests fail (confirmed), so they have teeth. 3 new tests in `test_nl_interface.py`; 110 total.

## Known issues / open items

- **Short-query search: FIXED 2026-09-20, with measurements.** Was: "meeting" returned nothing. Built
  a 31-query labelled set from the vault contents (tune and held-out halves) and compared options:
  (a) fixed 0.55 cutoff: correct file in results for 20/27; (b) nomic `search_query:`/`search_document:`
  prefixes: top-1 21->24/27 but a fixed cutoff still cannot separate `meeting` (0.56) from junk
  (0.57), needs a full re-embed and retunes every threshold - NOT adopted; (c) LLM query expansion:
  top-1 fell to 13/27 - rejected; (d) adopted: relative cutoff (`search_floor` 0.47, within
  `search_relative_margin` 0.06 of the best) + keyword boost (`search_lexical_weight` 0.08): correct
  file in results 27/27, top-1 24/27 (held-out 13/14), precision 0.82, no re-embedding. `open` only
  launches at or above `search_similarity_threshold` (0.55). Residuals: `meeting notes` ranks
  `workout_log.txt` first (it says "project meeting"); 3 of 4 off-topic queries return
  labelled low-confidence guesses. Eval scripts were scratch (not in the repo); the numbers are here.
- One cosmetic label overlap in the graph view between two unlinked files at the bottom.
- **Monitoring II deliverables are done (2026-09-20):** `docs/DreamOS-Project-Monitoring-II.docx`
  (19-page report; regenerate with `NODE_PATH="$(npm root -g)" node docs/build_report_m2.js`, then
  open it in Word and update the TOC field - docx-js leaves it empty) and `docs/DreamOS-Project-Monitoring-II.pptx` (22 slides mirroring the report;
  `docs/build_pptx_m2.js`). Diagrams in `docs/diagrams/` were rewritten for all six modules. The
  Monitoring-I docx and decks are kept unchanged as the earlier submission record.
- pptxgenjs gotcha, found the hard way: `addShape("oval")` is not a valid shape name (use
  `"ellipse"`). Viewers tolerate it but real PowerPoint calls the file corrupt, which is why an
  earlier deck produced a `[Repaired]` copy. Always confirm a generated .pptx opens via PowerPoint
  COM (`$app.Presentations.Open(...)`); it can also `Export` slide PNGs for visual QA.
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
