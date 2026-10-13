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

import numpy as np

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


def _reference_needles(name: str) -> list[str]:
    """Strings whose appearance in another file's text counts as a reference to `name`."""
    needles = [name.lower()]
    stem = name.rsplit(".", 1)[0].lower()
    # A bare stem like "notes" would match ordinary prose everywhere, so only trust stems
    # that look like deliberate identifiers (long enough, with a separator or digit).
    if len(stem) >= 6 and re.search(r"[_\-\d]", stem):
        needles.append(stem)
    return needles


def _needle_pattern(needle: str) -> re.Pattern:
    return re.compile(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])")


def _reference_patterns(name: str) -> list[re.Pattern]:
    return [_needle_pattern(n) for n in _reference_needles(name)]


def _add_similar_edges(edges: dict, vectors: dict[str, list[float]], by_path: dict) -> None:
    """Vectorised with numpy: one matrix product gives every pairwise cosine at once.

    Same result as the original pairwise loop: for each file keep its top `graph_top_k` neighbours
    among those at or above the threshold, and let an edge survive if either end keeps it.
    """
    paths = sorted(p for p in vectors if p in by_path)
    if len(paths) < 2:
        return
    matrix = np.asarray([vectors[p] for p in paths], dtype=np.float64)
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0
    unit = matrix / norms[:, None]
    sims = unit @ unit.T
    np.fill_diagonal(sims, -np.inf)

    k = min(settings.graph_top_k, len(paths) - 1)
    neighbours = np.argpartition(-sims, k - 1, axis=1)[:, :k]
    ids = [by_path[p]["id"] for p in paths]
    for i, row in enumerate(neighbours):
        for j in row:
            score = float(sims[i, j])
            if score >= settings.graph_similarity_threshold:
                low, high = sorted((ids[i], ids[int(j)]))
                edges[(low, high, SIMILAR)] = round(score, 4)


_TOKEN = re.compile(r"[a-z0-9]+")


def _add_reference_edges(edges: dict, files: list) -> None:
    """A reference is a bounded occurrence of a file's name (or deliberate-looking stem) in another
    file's text. Checking every (source, target) pair with a regex is quadratic: 50 million
    searches at 5,000 files, which was 170 s of a 174 s graph rebuild. Instead each needle is
    filed under its rarest alphanumeric token, and a source text is only checked against the
    needles whose token it contains. A bounded occurrence of a needle always contains each of
    the needle's tokens as a whole alphanumeric run, so no reference is lost; the result is
    identical to the exhaustive check (a test compares the two).
    """
    texts: dict[int, str] = {}
    for f in files:
        try:
            texts[f["id"]] = extract_text(settings.vault_dir / f["path"]).lower()
        except (ExtractionError, OSError):
            texts[f["id"]] = ""

    needles: list[tuple[int, list[str], re.Pattern]] = []
    frequency: Counter = Counter()
    for target in files:
        for needle in _reference_needles(target["name"]):
            tokens = _TOKEN.findall(needle)
            needles.append((target["id"], tokens, _needle_pattern(needle)))
            frequency.update(set(tokens))

    by_token: dict[str, list[tuple[int, re.Pattern]]] = {}
    unindexed: list[tuple[int, re.Pattern]] = []  # needles with no alphanumeric run at all
    for target_id, tokens, pattern in needles:
        if not tokens:
            unindexed.append((target_id, pattern))
            continue
        rarest = min(tokens, key=lambda t: (frequency[t], t))
        by_token.setdefault(rarest, []).append((target_id, pattern))

    for source_id, text in texts.items():
        if not text:
            continue
        candidates = list(unindexed)
        for token in set(_TOKEN.findall(text)):
            candidates.extend(by_token.get(token, ()))
        for target_id, pattern in candidates:
            key = (source_id, target_id, REFERENCES)
            if target_id != source_id and key not in edges and pattern.search(text):
                edges[key] = 1.0


def _add_shared_tag_edges(edges: dict, files: list) -> None:
    """Uses an inverted index (tag -> files) so only files that share a tag are ever compared."""
    tagsets = {f["id"]: {t for t in (f["tags"] or "").split(",") if t} for f in files}
    files_with_tag: dict[str, list[int]] = {}
    for fid, tags in tagsets.items():
        for tag in tags:
            files_with_tag.setdefault(tag, []).append(fid)

    shared_counts: Counter = Counter()
    for fids in files_with_tag.values():
        for i, a in enumerate(fids):
            for b in fids[i + 1 :]:
                shared_counts[(min(a, b), max(a, b))] += 1

    for (a, b), shared in shared_counts.items():
        if shared >= settings.graph_min_shared_tags:
            union = len(tagsets[a] | tagsets[b])
            edges[(a, b, SHARED_TAG)] = round(shared / union, 4)


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


def cluster_pairs(pair_weight: dict[tuple[int, int], float], min_link: float, min_size: int) -> list[list[int]]:
    """Average-linkage agglomerative clustering over undirected pair weights (low id first).

    Repeatedly merges the two groups with the highest average member-pair weight (missing
    pairs count as 0) until no pair of groups averages at or above `min_link`. Uses per-group
    adjacency and a lazily invalidated max-heap, so a merge only touches the merged group's
    neighbours; the earlier version rescanned and rebuilt the whole link table on every merge
    (20 s at 5,000 files). Ties are broken by lowest group ids, so results are deterministic.
    """
    import heapq

    members: dict[int, set[int]] = {}
    adjacency: dict[int, dict[int, float]] = {}  # group -> {other group: summed member-pair weight}
    for (a, b), weight in pair_weight.items():
        members.setdefault(a, {a})
        members.setdefault(b, {b})
        adjacency.setdefault(a, {})[b] = weight
        adjacency.setdefault(b, {})[a] = weight

    version = {g: 0 for g in members}
    heap: list[tuple[float, int, int, int, int]] = []

    def push(a: int, b: int) -> None:
        low, high = (a, b) if a < b else (b, a)
        average = adjacency[low][high] / (len(members[low]) * len(members[high]))
        if average >= min_link:
            heapq.heappush(heap, (-average, low, high, version[low], version[high]))

    for a, neighbours in adjacency.items():
        for b in neighbours:
            if a < b:
                push(a, b)

    while heap:
        _, keep, absorb, v_keep, v_absorb = heapq.heappop(heap)
        if keep not in members or absorb not in members:
            continue
        if version[keep] != v_keep or version[absorb] != v_absorb:
            continue  # stale: one side has merged since this entry was pushed

        members[keep] |= members.pop(absorb)
        version[keep] += 1
        del version[absorb]
        del adjacency[keep][absorb]
        for other, total in adjacency.pop(absorb).items():
            if other == keep:
                continue
            adjacency[keep][other] = adjacency[keep].get(other, 0.0) + total
            adjacency[other][keep] = adjacency[keep][other]
            del adjacency[other][absorb]
        for other in adjacency[keep]:
            push(keep, other)

    return sorted(
        (sorted(m) for m in members.values() if len(m) >= min_size),
        key=len,
        reverse=True,
    )


def clusters(min_size: int | None = None) -> list[list[int]]:
    """Groups of closely related files (any edge kind), largest first, as lists of file ids.

    Average-linkage clustering over the stored edges (see `cluster_pairs`). Plain connected
    components would chain two unrelated groups together through a single weak edge; here that
    edge is averaged over every member pair and stays far below the bar.
    """
    min_size = min_size or settings.workspace_min_cluster_size
    with connection() as conn:
        edge_rows = conn.execute("SELECT src_id, dst_id, weight FROM file_edges").fetchall()

    # One undirected weight per pair: the strongest of its edge kinds.
    pair_weight: dict[tuple[int, int], float] = {}
    for e in edge_rows:
        pair = (min(e["src_id"], e["dst_id"]), max(e["src_id"], e["dst_id"]))
        pair_weight[pair] = max(pair_weight.get(pair, 0.0), e["weight"])

    return cluster_pairs(pair_weight, settings.graph_cluster_min_link, min_size)
