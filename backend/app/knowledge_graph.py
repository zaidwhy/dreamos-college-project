"""Knowledge Graph: derives typed, weighted relationships between indexed files.

Edges are stored against files.id rather than the path, because the organizer renames paths
on apply/revert - an id survives the rename, so no edge needs re-syncing after a move.

Edge kinds:
  similar     undirected  cosine similarity of the two files' mean chunk embeddings
  references  directed    file A's text names file B's filename ("previous versions: resume_final")
  shared_tag  undirected  files sharing several AI-generated tags (Jaccard weight)
"""

import math
import re
from collections import Counter
from dataclasses import dataclass

from app import vectorstore
from app.config import settings
from app.db import connection
from app.extractors import ExtractionError, extract_text

SIMILAR = "similar"
REFERENCES = "references"
SHARED_TAG = "shared_tag"


@dataclass
class RelatedFile:
    path: str
    name: str
    kinds: list[str]
    weight: float
    abs_path: str


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _prepare_vectors(vectors: dict[str, list[float]]) -> dict[str, list[float]]:
    """Mean-centers the file vectors so cosine reflects what makes a file *different* from the
    typical file, not the direction every embedding shares. Below three files the mean is
    dominated by the files themselves, so no similarity is reported at all.
    """
    if not settings.graph_center_vectors:
        return vectors
    if len(vectors) < 3:
        return {}
    dim = len(next(iter(vectors.values())))
    mean = [sum(v[i] for v in vectors.values()) / len(vectors) for i in range(dim)]
    return {path: [x - m for x, m in zip(vec, mean)] for path, vec in vectors.items()}


def _reference_patterns(name: str) -> list[re.Pattern]:
    """Patterns whose appearance in another file's text counts as a reference to `name`."""
    needles = [name.lower()]
    stem = name.rsplit(".", 1)[0].lower()
    # A bare stem like "notes" would match ordinary prose everywhere, so only trust stems
    # that look like deliberate identifiers (long enough, with a separator or digit).
    if len(stem) >= 6 and re.search(r"[_\-\d]", stem):
        needles.append(stem)
    return [re.compile(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])") for n in needles]


def _add_similar_edges(edges: dict, vectors: dict[str, list[float]], by_path: dict) -> None:
    paths = sorted(p for p in vectors if p in by_path)
    candidates: dict[str, list[tuple[float, str]]] = {p: [] for p in paths}
    for i, a in enumerate(paths):
        for b in paths[i + 1 :]:
            score = _cosine(vectors[a], vectors[b])
            if score >= settings.graph_similarity_threshold:
                candidates[a].append((score, b))
                candidates[b].append((score, a))

    # Keep each file's strongest few neighbours; an edge survives if either end picks it,
    # which stops a hub file from drowning the graph in near-identical links.
    for a, scored in candidates.items():
        for score, b in sorted(scored, reverse=True)[: settings.graph_top_k]:
            low, high = sorted((by_path[a]["id"], by_path[b]["id"]))
            edges[(low, high, SIMILAR)] = round(score, 4)


def _add_reference_edges(edges: dict, files: list) -> None:
    texts: dict[int, str] = {}
    for f in files:
        try:
            texts[f["id"]] = extract_text(settings.vault_dir / f["path"]).lower()
        except (ExtractionError, OSError):
            texts[f["id"]] = ""

    for target in files:
        patterns = _reference_patterns(target["name"])
        for source in files:
            if source["id"] == target["id"]:
                continue
            if any(p.search(texts[source["id"]]) for p in patterns):
                edges[(source["id"], target["id"], REFERENCES)] = 1.0


def _add_shared_tag_edges(edges: dict, files: list) -> None:
    tagsets = {f["id"]: {t for t in (f["tags"] or "").split(",") if t} for f in files}
    ids = sorted(tagsets)
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            shared = tagsets[a] & tagsets[b]
            if len(shared) >= settings.graph_min_shared_tags:
                edges[(a, b, SHARED_TAG)] = round(len(shared) / len(tagsets[a] | tagsets[b]), 4)


def rebuild() -> dict:
    """Recomputes every edge from scratch. Cheap enough at vault scale (pairwise over files)
    and idempotent, so it is safe to call after any index run.
    """
    vectors = _prepare_vectors(vectorstore.get_file_vectors())
    with connection() as conn:
        files = conn.execute("SELECT id, path, name, tags FROM files").fetchall()
        by_path = {f["path"]: f for f in files}

        edges: dict[tuple[int, int, str], float] = {}
        _add_similar_edges(edges, vectors, by_path)
        _add_reference_edges(edges, files)
        _add_shared_tag_edges(edges, files)

        conn.execute("DELETE FROM file_edges")
        conn.executemany(
            "INSERT INTO file_edges (src_id, dst_id, kind, weight) VALUES (?, ?, ?, ?)",
            [(src, dst, kind, weight) for (src, dst, kind), weight in edges.items()],
        )
    return {"nodes": len(files), "edges": len(edges)}


def get_graph() -> dict:
    with connection() as conn:
        nodes = conn.execute("SELECT id, path, name, category FROM files ORDER BY id").fetchall()
        edge_rows = conn.execute("SELECT src_id, dst_id, kind, weight FROM file_edges").fetchall()

    degree: Counter = Counter()
    for e in edge_rows:
        degree[e["src_id"]] += 1
        degree[e["dst_id"]] += 1

    return {
        "nodes": [
            {
                "id": n["id"],
                "path": n["path"],
                "name": n["name"],
                "category": n["category"],
                "degree": degree[n["id"]],
                "abs_path": str((settings.vault_dir / n["path"]).resolve()),
            }
            for n in nodes
        ],
        "edges": [
            {"source": e["src_id"], "target": e["dst_id"], "kind": e["kind"], "weight": e["weight"]}
            for e in edge_rows
        ],
    }


def related_files(path: str, limit: int = 5) -> list[RelatedFile]:
    with connection() as conn:
        row = conn.execute("SELECT id FROM files WHERE path = ?", (path,)).fetchone()
        if row is None:
            return []
        rows = conn.execute(
            """
            SELECT f.path, f.name, e.kind, e.weight
            FROM file_edges e
            JOIN files f ON f.id = CASE WHEN e.src_id = :id THEN e.dst_id ELSE e.src_id END
            WHERE e.src_id = :id OR e.dst_id = :id
            """,
            {"id": row["id"]},
        ).fetchall()

    merged: dict[str, RelatedFile] = {}
    for r in rows:
        existing = merged.get(r["path"])
        if existing is None:
            merged[r["path"]] = RelatedFile(
                path=r["path"],
                name=r["name"],
                kinds=[r["kind"]],
                weight=r["weight"],
                abs_path=str((settings.vault_dir / r["path"]).resolve()),
            )
        else:
            existing.kinds.append(r["kind"])
            existing.weight = max(existing.weight, r["weight"])

    return sorted(merged.values(), key=lambda r: r.weight, reverse=True)[:limit]


def clusters(min_size: int | None = None) -> list[list[int]]:
    """Groups of closely related files (any edge kind), largest first, as lists of file ids.

    Average-linkage agglomerative clustering over the stored edges: repeatedly merge the two
    groups with the highest average edge weight between their members, stopping once no pair
    of groups averages above `graph_cluster_min_link`. Plain connected components would chain
    two unrelated groups together through a single weak edge; here that edge is averaged over
    every member pair and stays far below the bar.
    """
    min_size = min_size or settings.workspace_min_cluster_size
    with connection() as conn:
        edge_rows = conn.execute("SELECT src_id, dst_id, weight FROM file_edges").fetchall()

    # One undirected weight per pair: the strongest of its edge kinds.
    pair_weight: dict[tuple[int, int], float] = {}
    for e in edge_rows:
        pair = (min(e["src_id"], e["dst_id"]), max(e["src_id"], e["dst_id"]))
        pair_weight[pair] = max(pair_weight.get(pair, 0.0), e["weight"])

    members: dict[int, set[int]] = {n: {n} for pair in pair_weight for n in pair}
    link = dict(pair_weight)  # (group, group) -> summed member-pair weight, low id first

    while True:
        best = None
        for (a, b), total in link.items():
            average = total / (len(members[a]) * len(members[b]))
            if average >= settings.graph_cluster_min_link and (best is None or average > best[0]):
                best = (average, a, b)
        if best is None:
            break

        _, keep, absorb = best
        members[keep] |= members.pop(absorb)
        merged: dict[tuple[int, int], float] = {}
        for (a, b), total in link.items():
            if {a, b} == {keep, absorb}:
                continue
            a, b = (keep if a == absorb else a), (keep if b == absorb else b)
            pair = (min(a, b), max(a, b))
            merged[pair] = merged.get(pair, 0.0) + total
        link = merged

    return sorted(
        (sorted(m) for m in members.values() if len(m) >= min_size),
        key=len,
        reverse=True,
    )
