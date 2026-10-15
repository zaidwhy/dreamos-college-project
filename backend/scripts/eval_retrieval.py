"""Retrieval comparison on the demo vault: DreamOS against two keyword baselines.

Systems compared, all over the same 37 files and the same labelled queries:
  filename   - lexical match on the file name only (what a name-index tool such as Everything does)
  keyword    - BM25 over file name + full text (a lexical content index, the Windows Search /
               Spotlight style of matching; same tokenisation as DreamOS's keyword boost)
  embedding  - DreamOS embeddings only (best chunk cosine), no keyword boost, no cutoff
  dreamos    - the shipped pipeline: embeddings + keyword boost + relative cutoff

Each query was written and labelled with its relevant file(s) BEFORE the run, from the vault
contents. A query is labelled "no shared words" automatically when none of its content words
(after the same stop-word and plural folding the system uses) occurs in a relevant file's name or
text; those are the queries a purely lexical system cannot answer by construction. The label set
is small and written by the project authors, so the report presents this as a controlled
comparison, not a benchmark of real-world quality.

Usage (from backend/):
    ./.venv/Scripts/python.exe scripts/eval_retrieval.py

Needs Ollama running with nomic-embed-text. Uses a temporary copy of the vault and a temporary
data directory; nothing in demo-vault/ or the app data is touched.
Writes ../docs/benchmarks/retrieval_comparison.json.
"""

import json
import math
import os
import shutil
import statistics
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
REPO = BACKEND.parent
K = 8  # every system returns at most this many files

# (query, relevant files). Written before the run.
QUERIES = [
    ("invoice BlueRidge hosting", {"inv_003.txt"}),
    ("Ajanta Ellora caves trip", {"travel_plan.txt"}),
    ("chai recipe ginger cardamom", {"recipe.txt"}),
    ("workout log badminton", {"workout_log.txt"}),
    ("quicksort implementation", {"script1.py"}),
    ("Flask library book search", {"old_flask_app.py"}),
    ("OWASP LLM Top 10", {"misc_notes_v2.txt", "standup.txt"}),
    ("list of the core modules to build first", {"module_list.txt"}),
    ("canteen receipt lunch", {"scan0007.txt"}),
    ("knowledge graph design meeting", {"mtg_04_12.txt"}),
    ("sandboxed demo vault decision", {"notes.txt", "faculty_feedback.txt"}),
    ("Kent Beck quote", {"quotes.txt"}),
    ("SQL marks query lab", {"sql_practice.txt"}),
    ("billing March domain renewal", {"billing_march.txt"}),
    ("debounce helper function", {"helper.js"}),
    ("who attended the team sync", {"notes.txt"}),
    ("daily standup embedding progress", {"standup.txt"}),
    ("early version of the specification", {"spec_v1.txt"}),
    ("old readme draft", {"readme_old.txt"}),
    ("architecture of the backend and storage", {"architecture_notes.txt"}),
    ("earnings from a side job for a small shop", {"recieved_payment.txt"}),
    ("present for my mother", {"gift_ideas.txt"}),
    ("bill from the college cafeteria", {"scan0007.txt"}),
    ("how to brew a hot drink with spices", {"recipe.txt"}),
    ("physical activity diary", {"workout_log.txt"}),
    ("holiday to historic sites in Maharashtra", {"travel_plan.txt"}),
    ("sorting algorithm from my data structures class", {"script1.py"}),
    ("how to remember my login credentials", {"password_hint_DO_NOT_SHARE.txt"}),
    ("remarks from our mentor about what to improve",
     {"faculty_feedback.txt", "followups.txt", "review_call_transcript.txt"}),
    ("unfinished job application document of Krushna", {"Untitled document.txt"}),
    ("the latest version of my job application document", {"final_final_v3.txt"}),
    ("reasons we chose this project over the other two ideas", {"proposal_draft.txt", "mtg_04_12.txt"}),
    ("psychology book takeaways about intuition and deliberation", {"book_notes.txt"}),
    ("spending breakdown for the semester", {"untitled_spreadsheet_notes.txt", "billing_march.txt"}),
    ("diary entry about a frustrating day fixing wrong results", {"journal_march.txt"}),
    ("scratch code to call the local model vector endpoint", {"test123.py"}),
]


def bm25(query_terms, docs, k1=1.5, b=0.75):
    """docs: {name: [terms]}. Returns ranked [(name, score)] with score > 0."""
    n = len(docs)
    avgdl = sum(len(t) for t in docs.values()) / n
    df = {}
    for terms in docs.values():
        for t in set(terms):
            df[t] = df.get(t, 0) + 1
    ranked = []
    for name, terms in docs.items():
        score = 0.0
        for q in query_terms:
            f = terms.count(q)
            if not f:
                continue
            idf = math.log(1 + (n - df[q] + 0.5) / (df[q] + 0.5))
            score += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(terms) / avgdl))
        if score > 0:
            ranked.append((name, score))
    ranked.sort(key=lambda x: -x[1])
    return ranked


def metrics(ranks):
    """ranks: list of rank (1-based) of the first relevant file, or None."""
    n = len(ranks)
    return {
        "queries": n,
        "hit_at_1": sum(1 for r in ranks if r == 1) / n,
        "hit_at_3": sum(1 for r in ranks if r is not None and r <= 3) / n,
        "hit_at_8": sum(1 for r in ranks if r is not None) / n,
        "mrr": statistics.mean((1 / r) if r else 0.0 for r in ranks),
    }


def first_rank(names, relevant):
    for i, name in enumerate(names[:K], start=1):
        if name in relevant:
            return i
    return None


def main() -> None:
    tmp = Path(tempfile.mkdtemp(prefix="dreamos_eval_"))
    vault = tmp / "vault"
    shutil.copytree(REPO / "demo-vault", vault)
    os.environ["DREAMOS_VAULT_DIR"] = str(vault)
    os.environ["DREAMOS_DATA_DIR"] = str(tmp / "data")
    os.environ["DREAMOS_CHROMA_DIR"] = str(tmp / "data" / "chroma")
    os.environ["DREAMOS_SQLITE_PATH"] = str(tmp / "data" / "dreamos.db")
    sys.path.insert(0, str(BACKEND))

    from app import search, vectorstore
    from app.config import settings
    from app.db import init_db
    from app.indexer import index_vault
    from app.ollama_client import embed

    assert str(settings.vault_dir).startswith(str(tmp)), "must not touch the real vault"
    init_db()
    index_vault()

    files = sorted(p.name for p in vault.iterdir() if p.is_file())
    text = {f: (vault / f).read_text(encoding="utf-8", errors="ignore") for f in files}
    stem_terms = {f: search._terms(f.rsplit(".", 1)[0].replace("_", " ")) for f in files}
    doc_terms = {f: sorted(search._terms(text[f]) | stem_terms[f]) for f in files}
    # BM25 needs term frequency, so build term lists with repeats from the raw text.
    import re

    def term_list(s):
        out = []
        for w in re.findall(r"[a-z0-9]+", s.lower()):
            if len(w) >= 3 and w not in search._STOPWORDS:
                out.append(w[:-1] if len(w) > 3 and w.endswith("s") else w)
        return out

    bm_docs = {f: term_list(f.rsplit(".", 1)[0].replace("_", " ") + " " + text[f]) for f in files}

    systems = {"filename": [], "keyword": [], "embedding": [], "dreamos": []}
    per_query = []
    shared_flags = []
    for query, relevant in QUERIES:
        assert relevant <= set(files), f"unknown file in labels: {relevant - set(files)}"
        q_terms = search._terms(query)
        shares = any(q_terms & (set(doc_terms[f])) for f in relevant)
        shared_flags.append(shares)

        # filename-only lexical match
        fn = sorted(((f, len(q_terms & stem_terms[f])) for f in files), key=lambda x: -x[1])
        fn_names = [f for f, s in fn if s > 0]
        # BM25 over name + text
        kw_names = [f for f, _ in bm25(sorted(q_terms), bm_docs)]
        # embedding only: best chunk cosine per file
        raw = vectorstore.query(embed(query), top_k=max(K * 3, vectorstore.count()))
        best = {}
        for md, dist in zip(raw["metadatas"][0], raw["distances"][0]):
            sim = 1 - dist
            best[md["path"]] = max(best.get(md["path"], -1), sim)
        em_names = [p for p, _ in sorted(best.items(), key=lambda x: -x[1])]
        # shipped pipeline
        dr_hits = search.semantic_search(query, top_k=K)
        dr_names = [h.path for h in dr_hits]

        ranks = {
            "filename": first_rank(fn_names, relevant),
            "keyword": first_rank(kw_names, relevant),
            "embedding": first_rank(em_names, relevant),
            "dreamos": first_rank(dr_names, relevant),
        }
        for k, v in ranks.items():
            systems[k].append(v)
        # What the `open` action would do with this query: launch only above the confidence bar and
        # only when no close runner-up exists (same rule as app.nl_interface._open, before the
        # most-used tie-breaker, which needs usage history this evaluation does not have).
        top = dr_hits[0] if dr_hits else None
        if top is None or top.similarity < settings.search_similarity_threshold:
            decision = "abstain"
        else:
            tied = [h for h in dr_hits[:3] if top.similarity - h.similarity < settings.open_ambiguity_margin]
            decision = "ambiguous" if len(tied) > 1 else "open"
        per_query.append({"query": query, "relevant": sorted(relevant), "shares_words": shares,
                          "ranks": ranks, "dreamos_top1": dr_names[0] if dr_names else None,
                          "top_similarity": top.similarity if top else None,
                          "open_decision": decision,
                          "top1_correct": bool(top and top.path in relevant)})

    def subset(flag):
        idx = [i for i, s in enumerate(shared_flags) if s == flag]
        return {k: metrics([v[i] for i in idx]) for k, v in systems.items()}, len(idx)

    all_m = {k: metrics(v) for k, v in systems.items()}
    guarded = {"opened": 0, "opened_correct": 0, "abstained": 0, "ambiguous": 0,
               "blocked_but_top1_was_right": 0, "blocked_and_top1_was_wrong": 0}
    for q in per_query:
        d = q["open_decision"]
        if d == "open":
            guarded["opened"] += 1
            guarded["opened_correct"] += int(q["top1_correct"])
        else:
            guarded["abstained" if d == "abstain" else "ambiguous"] += 1
            guarded["blocked_but_top1_was_right" if q["top1_correct"] else "blocked_and_top1_was_wrong"] += 1
    always = {"opened": len(per_query), "opened_correct": sum(int(q["top1_correct"]) for q in per_query)}
    always["opened_wrong"] = always["opened"] - always["opened_correct"]
    guarded["opened_wrong"] = guarded["opened"] - guarded["opened_correct"]
    open_policy = {"always_open_top1": always, "guarded_open": guarded,
                   "threshold": settings.search_similarity_threshold, "ambiguity_margin": settings.open_ambiguity_margin}
    shared_m, n_shared = subset(True)
    none_m, n_none = subset(False)
    out = {
        "files": len(files),
        "queries": len(QUERIES),
        "queries_sharing_words": n_shared,
        "queries_no_shared_words": n_none,
        "k": K,
        "all": all_m,
        "sharing_words": shared_m,
        "no_shared_words": none_m,
        "open_policy": open_policy,
        "per_query": per_query,
    }
    dest = REPO / "docs" / "benchmarks" / "retrieval_comparison.json"
    dest.write_text(json.dumps(out, indent=2), encoding="utf-8")
    vectorstore.close_client()
    shutil.rmtree(tmp, ignore_errors=True)

    def row(name, m):
        return f"{name:10s} hit@1 {m['hit_at_1']:.2f}  hit@3 {m['hit_at_3']:.2f}  hit@8 {m['hit_at_8']:.2f}  MRR {m['mrr']:.2f}"

    for title, block in (("ALL", all_m), ("SHARING WORDS", shared_m), ("NO SHARED WORDS", none_m)):
        print(f"--- {title}")
        for k in ("filename", "keyword", "embedding", "dreamos"):
            print(row(k, block[k]))
    print(f"queries {len(QUERIES)}  sharing {n_shared}  none {n_none}")
    print("open policy:", json.dumps(open_policy))


if __name__ == "__main__":
    main()
