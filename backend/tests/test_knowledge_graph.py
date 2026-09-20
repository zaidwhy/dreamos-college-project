from app import knowledge_graph as kg
from app.config import settings
from app.db import connection
from app.indexer import index_vault
from app.organizer import apply_organization, suggest_for_file

# Distinct unit vectors: orthogonal to each other, so files only relate when a test says so.
V_A = [1.0, 0.0, 0.0, 0.0]
V_A_NEAR = [0.98, 0.2, 0.0, 0.0]
V_B = [0.0, 1.0, 0.0, 0.0]
V_C = [0.0, 0.0, 1.0, 0.0]
V_D = [0.0, 0.0, 0.0, 1.0]


def _add(vault, fake_embed, name: str, content: str, vector: list[float]) -> None:
    (vault / name).write_text(content, encoding="utf-8")
    fake_embed[content] = vector


def _edges() -> set[tuple[str, str, str]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT s.path AS src, d.path AS dst, e.kind
            FROM file_edges e
            JOIN files s ON s.id = e.src_id
            JOIN files d ON d.id = e.dst_id
            """
        ).fetchall()
    return {(r["src"], r["dst"], r["kind"]) for r in rows}


def _linked(edges, a: str, b: str, kind: str) -> bool:
    return (a, b, kind) in edges or (b, a, kind) in edges


def _set_tags(path: str, tags: str) -> None:
    with connection() as conn:
        conn.execute("UPDATE files SET tags = ? WHERE path = ?", (tags, path))


def test_similar_edge_links_near_vectors_and_skips_unrelated(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "a.txt", "resume one", V_A)
    _add(vault, fake_embed, "b.txt", "resume two", V_A_NEAR)
    _add(vault, fake_embed, "c.txt", "quarterly invoice", V_C)
    index_vault(vault)

    kg.rebuild()
    edges = _edges()

    assert _linked(edges, "a.txt", "b.txt", kg.SIMILAR)
    assert not any("c.txt" in (src, dst) for src, dst, _ in edges)


def test_reference_edge_is_directed_and_needs_a_real_filename(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "resume_final.txt", "the resume body", V_A)
    _add(vault, fake_embed, "latest.txt", "older copy lives in resume_final, keep for reference", V_B)
    _add(vault, fake_embed, "notes.txt", "scratch space", V_C)
    # Mentions the bare word "notes" in prose - must NOT count as a reference to notes.txt.
    _add(vault, fake_embed, "diary.txt", "took some notes about the day", V_D)
    index_vault(vault)

    kg.rebuild()
    edges = _edges()

    assert ("latest.txt", "resume_final.txt", kg.REFERENCES) in edges
    assert ("resume_final.txt", "latest.txt", kg.REFERENCES) not in edges
    assert not any(kind == kg.REFERENCES and dst == "notes.txt" for _, dst, kind in edges)


def test_reference_edge_matches_a_full_filename_even_when_the_stem_is_generic(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "notes.txt", "scratch space", V_A)
    _add(vault, fake_embed, "index.txt", "see notes.txt for the details", V_B)
    index_vault(vault)

    kg.rebuild()

    assert ("index.txt", "notes.txt", kg.REFERENCES) in _edges()


def test_shared_tag_edge_needs_enough_overlap(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "a.txt", "alpha", V_A)
    _add(vault, fake_embed, "b.txt", "bravo", V_B)
    _add(vault, fake_embed, "c.txt", "charlie", V_C)
    index_vault(vault)
    _set_tags("a.txt", "billing,march,invoice")
    _set_tags("b.txt", "billing,march,payment")
    _set_tags("c.txt", "billing,journal")  # only one tag in common with a/b

    kg.rebuild()
    edges = _edges()

    assert _linked(edges, "a.txt", "b.txt", kg.SHARED_TAG)
    assert not _linked(edges, "a.txt", "c.txt", kg.SHARED_TAG)
    assert not _linked(edges, "b.txt", "c.txt", kg.SHARED_TAG)


def test_rebuild_replaces_stale_edges_and_is_idempotent(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "a.txt", "one", V_A)
    _add(vault, fake_embed, "b.txt", "two", V_A_NEAR)
    index_vault(vault)
    with connection() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM files ORDER BY id").fetchall()]
        conn.execute(
            "INSERT INTO file_edges (src_id, dst_id, kind, weight) VALUES (?, ?, 'shared_tag', 0.5)",
            (ids[0], ids[1]),
        )

    first = kg.rebuild()
    second = kg.rebuild()

    assert first == second
    assert not _linked(_edges(), "a.txt", "b.txt", kg.SHARED_TAG)  # the hand-inserted edge is gone


def test_related_files_merges_kinds_and_works_from_either_side(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "resume_final.txt", "the resume body", V_A)
    _add(vault, fake_embed, "resume_v3.txt", "newer resume, supersedes resume_final", V_A_NEAR)
    _add(vault, fake_embed, "unrelated.txt", "grocery list", V_C)
    index_vault(vault)
    kg.rebuild()

    from_newer = kg.related_files("resume_v3.txt")
    from_older = kg.related_files("resume_final.txt")

    assert [r.path for r in from_newer] == ["resume_final.txt"]
    assert set(from_newer[0].kinds) == {kg.SIMILAR, kg.REFERENCES}
    assert from_newer[0].weight == 1.0  # the reference outranks the similarity score
    assert [r.path for r in from_older] == ["resume_v3.txt"]
    assert kg.related_files("does-not-exist.txt") == []


def test_edges_survive_an_organizer_move(isolated_env, fake_embed, fake_generate_json):
    vault = isolated_env
    _add(vault, fake_embed, "a.txt", "invoice one", V_A)
    _add(vault, fake_embed, "b.txt", "invoice two", V_A_NEAR)
    index_vault(vault)
    kg.rebuild()

    fake_generate_json.append(
        {"summary": "an invoice", "tags": ["billing"], "category": "invoices", "reasoning": "financial"}
    )
    suggest_for_file("a.txt")
    apply_organization("a.txt")

    # No rebuild: the edge is keyed on the file id, so it follows the file to its new path.
    related = kg.related_files("invoices/a.txt")
    assert [r.path for r in related] == ["b.txt"]


def test_get_graph_reports_degree(isolated_env, fake_embed):
    vault = isolated_env
    _add(vault, fake_embed, "a.txt", "one", V_A)
    _add(vault, fake_embed, "b.txt", "two", V_A_NEAR)
    _add(vault, fake_embed, "c.txt", "three", V_C)
    index_vault(vault)
    kg.rebuild()

    graph = kg.get_graph()
    degree = {n["name"]: n["degree"] for n in graph["nodes"]}

    assert degree == {"a.txt": 1, "b.txt": 1, "c.txt": 0}
    assert len(graph["edges"]) == 1


def test_clusters_groups_connected_files_and_respects_min_size(isolated_env, fake_embed, monkeypatch):
    vault = isolated_env
    # a-b-c form a chain of similar files (a~b, b~c); d-e are a separate pair.
    _add(vault, fake_embed, "a.txt", "a", [1.0, 0.0, 0.0, 0.0])
    _add(vault, fake_embed, "b.txt", "b", [0.9, 0.44, 0.0, 0.0])
    _add(vault, fake_embed, "c.txt", "c", [0.6, 0.8, 0.0, 0.0])
    _add(vault, fake_embed, "d.txt", "d", [0.0, 0.0, 1.0, 0.0])
    _add(vault, fake_embed, "e.txt", "e", [0.0, 0.0, 0.98, 0.2])
    index_vault(vault)
    monkeypatch.setattr(settings, "graph_similarity_threshold", 0.85)
    kg.rebuild()

    groups = kg.clusters(min_size=3)

    with connection() as conn:
        by_id = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM files").fetchall()}
    assert [sorted(by_id[i] for i in g) for g in groups] == [["a.txt", "b.txt", "c.txt"]]
    assert len(kg.clusters(min_size=2)) == 2


# ------------------------------------------------------------ mean-centering
# Real embeddings share a large common direction, so every pair looks alike on raw cosine.

# Every vector leads with the same large component (10); only the trailing part differs.
GROUPED = {
    "a1.txt": [10.0, 3.0, 0.0, 0.0, 0.0, 0.0],
    "a2.txt": [10.0, 2.8, 0.3, 0.0, 0.0, 0.0],
    "b1.txt": [10.0, 0.0, 0.0, 3.0, 0.0, 0.0],
    "b2.txt": [10.0, 0.0, 0.0, 2.8, 0.3, 0.0],
    "c1.txt": [10.0, 0.0, 0.0, 0.0, 0.0, 3.0],
    "c2.txt": [10.0, 0.0, 0.3, 0.0, 0.0, 2.8],
}


def _index_grouped(vault, fake_embed):
    for name, vector in GROUPED.items():
        _add(vault, fake_embed, name, f"body of {name}", vector)
    index_vault(vault)


def test_centering_links_true_neighbours_that_raw_cosine_cannot_tell_from_noise(
    isolated_env, fake_embed, monkeypatch
):
    _index_grouped(isolated_env, fake_embed)

    monkeypatch.setattr(settings, "graph_center_vectors", False)
    kg.rebuild()
    raw = {e for e in _edges() if e[2] == kg.SIMILAR}

    monkeypatch.setattr(settings, "graph_center_vectors", True)
    monkeypatch.setattr(settings, "graph_similarity_threshold", 0.25)
    kg.rebuild()
    centered = _edges()

    assert len(raw) > 3  # raw cosine links across groups: the shared component swamps everything
    assert {frozenset(e[:2]) for e in centered} == {
        frozenset({"a1.txt", "a2.txt"}),
        frozenset({"b1.txt", "b2.txt"}),
        frozenset({"c1.txt", "c2.txt"}),
    }


def test_centering_reports_no_similarity_for_a_corpus_too_small_to_have_a_typical_file(
    isolated_env, fake_embed, monkeypatch
):
    monkeypatch.setattr(settings, "graph_center_vectors", True)
    _add(isolated_env, fake_embed, "a.txt", "one", V_A)
    _add(isolated_env, fake_embed, "b.txt", "two", V_A_NEAR)
    index_vault(isolated_env)

    kg.rebuild()

    assert _edges() == set()


# ------------------------------------------------------------ cluster splitting


def _set_edges(vault, fake_embed, names: list[str], weighted_pairs: list[tuple[str, str, float]]):
    """Indexes `names`, then replaces whatever edges indexing produced with exactly these."""
    for name in names:
        _add(vault, fake_embed, f"{name}.txt", f"body of {name}", V_A)
    index_vault(vault)
    with connection() as conn:
        ids = {r["name"].removesuffix(".txt"): r["id"] for r in conn.execute("SELECT id, name FROM files").fetchall()}
        conn.execute("DELETE FROM file_edges")
        conn.executemany(
            "INSERT INTO file_edges (src_id, dst_id, kind, weight) VALUES (?, ?, 'similar', ?)",
            [(ids[a], ids[b], w) for a, b, w in weighted_pairs],
        )


def _cluster_names() -> list[list[str]]:
    with connection() as conn:
        by_id = {r["id"]: r["name"].removesuffix(".txt") for r in conn.execute("SELECT id, name FROM files").fetchall()}
    return sorted(sorted(by_id[i] for i in g) for g in kg.clusters())


def test_two_tight_groups_joined_by_one_weak_bridge_are_not_one_cluster(isolated_env, fake_embed):
    _set_edges(
        isolated_env, fake_embed,
        ["a1", "a2", "a3", "b1", "b2", "b3"],
        [
            ("a1", "a2", 0.5), ("a2", "a3", 0.5), ("a1", "a3", 0.5),   # group A: fully linked
            ("b1", "b2", 0.5), ("b2", "b3", 0.5), ("b1", "b3", 0.5),   # group B: fully linked
            ("a3", "b1", 0.26),                                        # the lone weak bridge
        ],
    )

    assert _cluster_names() == [["a1", "a2", "a3"], ["b1", "b2", "b3"]]


def test_a_densely_linked_group_stays_whole(isolated_env, fake_embed):
    names = ["p", "q", "r", "s"]
    _set_edges(
        isolated_env, fake_embed, names,
        [(a, b, 0.3) for i, a in enumerate(names) for b in names[i + 1:]],
    )

    assert _cluster_names() == [["p", "q", "r", "s"]]


def test_a_loose_chain_of_files_is_never_reported_as_one_topic(isolated_env, fake_embed):
    _set_edges(
        isolated_env, fake_embed,
        ["c1", "c2", "c3", "c4", "c5"],
        [("c1", "c2", 0.4), ("c2", "c3", 0.35), ("c3", "c4", 0.3), ("c4", "c5", 0.28)],
    )

    # Each file is linked only to the next, so the ends share nothing. Whatever groups come
    # out, no single one may span the whole chain.
    groups = _cluster_names()
    assert all(len(g) < 5 for g in groups)
    assert not any({"c1", "c5"} <= set(g) for g in groups)
