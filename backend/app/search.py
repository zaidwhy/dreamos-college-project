import re
from dataclasses import dataclass

from app import vectorstore
from app.config import settings
from app.db import connection
from app.ollama_client import embed


_STOPWORDS = {
    "the", "and", "for", "with", "from", "about", "some", "something", "find", "show", "what", "did",
    "how", "are", "was", "you", "who", "that", "this", "not", "its", "has", "have", "had", "can",
    "all", "any", "get", "got", "one", "out",
}


def _terms(text: str) -> set[str]:
    """Lower-cased content words, with a trailing plural 's' folded so "invoices" matches "invoice"."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {
        w[:-1] if len(w) > 3 and w.endswith("s") else w
        for w in words
        if len(w) >= 3 and w not in _STOPWORDS
    }


@dataclass
class SearchHit:
    path: str
    name: str
    category: str | None
    summary: str | None
    snippet: str
    similarity: float
    abs_path: str


def hit_for_path(path: str) -> SearchHit | None:
    """Builds a hit for a file the user referred to explicitly (e.g. "open it"), so no
    similarity score applies - it is reported as a full 1.0 match.
    """
    with connection() as conn:
        row = conn.execute(
            "SELECT name, category, summary FROM files WHERE path = ?", (path,)
        ).fetchone()
    if row is None:
        return None
    return SearchHit(
        path=path,
        name=row["name"],
        category=row["category"],
        summary=row["summary"],
        snippet=row["summary"] or "",
        similarity=1.0,
        abs_path=str((settings.vault_dir / path).resolve()),
    )


def semantic_search(query: str, top_k: int | None = None) -> list[SearchHit]:
    top_k = top_k or settings.search_top_k
    query_embedding = embed(query)

    # Every chunk is scored (not just the nearest few): the keyword boost below can lift a file
    # whose embedding alone would not have made the shortlist. Fine at vault scale.
    raw = vectorstore.query(query_embedding, top_k=max(top_k * 3, vectorstore.count()))
    ids = raw["ids"][0]
    documents = raw["documents"][0]
    metadatas = raw["metadatas"][0]
    distances = raw["distances"][0]  # cosine distance = 1 - cosine similarity

    best_per_file: dict[str, tuple[float, str]] = {}
    text_per_file: dict[str, list[str]] = {}
    for _id, document, metadata, distance in zip(ids, documents, metadatas, distances):
        similarity = 1 - distance
        path = metadata["path"]
        text_per_file.setdefault(path, []).append(document)
        if path not in best_per_file or similarity > best_per_file[path][0]:
            best_per_file[path] = (similarity, document)

    query_terms = _terms(query)
    if query_terms and settings.search_lexical_weight > 0:
        with connection() as conn:
            names = {r["path"]: r["name"] for r in conn.execute("SELECT path, name FROM files").fetchall()}
        for path, (similarity, document) in list(best_per_file.items()):
            file_terms = _terms(" ".join(text_per_file[path])) | _terms(names.get(path, "").rsplit(".", 1)[0])
            matched = len(query_terms & file_terms) / len(query_terms)
            best_per_file[path] = (min(1.0, similarity + settings.search_lexical_weight * matched), document)

    ranked = sorted(best_per_file.items(), key=lambda item: item[1][0], reverse=True)
    if not ranked:
        return []
    # Cut relative to the best hit, not at one fixed score: a good answer to a short query can
    # score 0.54 while an unrelated long one scores 0.60, so an absolute bar drops real matches.
    cutoff = max(settings.search_floor, ranked[0][1][0] - settings.search_relative_margin)
    ranked = [item for item in ranked if item[1][0] >= cutoff][:top_k]

    hits = []
    with connection() as conn:
        for path, (similarity, document) in ranked:
            row = conn.execute(
                "SELECT name, category, summary FROM files WHERE path = ?", (path,)
            ).fetchone()
            if row is None:
                continue
            snippet = document[:280] + ("..." if len(document) > 280 else "")
            hits.append(
                SearchHit(
                    path=path,
                    name=row["name"],
                    category=row["category"],
                    summary=row["summary"],
                    snippet=snippet,
                    similarity=round(similarity, 4),
                    abs_path=str((settings.vault_dir / path).resolve()),
                )
            )
    return hits
