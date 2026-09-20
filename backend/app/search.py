from dataclasses import dataclass

from app import vectorstore
from app.config import settings
from app.db import connection
from app.ollama_client import embed


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

    raw = vectorstore.query(query_embedding, top_k=top_k * 3)  # over-fetch, then dedupe by file
    ids = raw["ids"][0]
    documents = raw["documents"][0]
    metadatas = raw["metadatas"][0]
    distances = raw["distances"][0]  # cosine distance = 1 - cosine similarity

    best_per_file: dict[str, tuple[float, str]] = {}
    for _id, document, metadata, distance in zip(ids, documents, metadatas, distances):
        similarity = 1 - distance
        path = metadata["path"]
        if similarity < settings.search_similarity_threshold:
            continue
        if path not in best_per_file or similarity > best_per_file[path][0]:
            best_per_file[path] = (similarity, document)

    ranked = sorted(best_per_file.items(), key=lambda item: item[1][0], reverse=True)[:top_k]

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
