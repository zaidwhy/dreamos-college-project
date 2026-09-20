import time

import pytest

from app import context_memory as memory
from app import workspace
from app.config import settings
from app.db import connection
from app.indexer import index_vault
from app.organizer import apply_organization, suggest_for_file

# Three mutually similar files (a cluster), plus two unrelated ones.
CLUSTER_VECTORS = {
    "a.txt": [1.0, 0.0, 0.0, 0.0],
    "b.txt": [0.98, 0.2, 0.0, 0.0],
    "c.txt": [0.97, 0.0, 0.24, 0.0],
}
LONERS = {"x.txt": [0.0, 1.0, 0.0, 0.0], "y.txt": [0.0, 0.0, 0.0, 1.0]}


def _index(vault, fake_embed, vectors: dict[str, list[float]]) -> None:
    for name, vector in vectors.items():
        content = f"content of {name}"
        (vault / name).write_text(content, encoding="utf-8")
        fake_embed[content] = vector
    index_vault(vault)


@pytest.fixture
def clustered(isolated_env, fake_embed):
    _index(isolated_env, fake_embed, {**CLUSTER_VECTORS, **LONERS})
    with connection() as conn:
        conn.execute("UPDATE files SET category = 'invoices' WHERE path IN ('a.txt','b.txt','c.txt')")
        conn.execute("UPDATE files SET category = 'misc' WHERE path IN ('x.txt','y.txt')")
    return isolated_env


def _of_kind(recs, kind):
    return [r for r in recs if r.kind == kind]


# ------------------------------------------------------------------ workspaces


def test_create_list_and_delete_a_workspace(clustered):
    ws = workspace.create_workspace("Tax prep", ["a.txt", "b.txt"], "March filing")

    listed = workspace.list_workspaces()
    assert [w["name"] for w in listed] == ["Tax prep"]
    assert [f["path"] for f in listed[0]["files"]] == ["a.txt", "b.txt"]
    assert listed[0]["description"] == "March filing"

    assert workspace.delete_workspace(ws["id"]) is True
    assert workspace.list_workspaces() == []
    assert workspace.delete_workspace(ws["id"]) is False


@pytest.mark.parametrize(
    "name, paths, message",
    [
        ("   ", ["a.txt"], "1-60 characters"),
        ("x" * 61, ["a.txt"], "1-60 characters"),
        ("Ghosts", ["nope.txt"], "None of the given paths"),
    ],
)
def test_create_workspace_rejects_bad_input(clustered, name, paths, message):
    with pytest.raises(ValueError, match=message):
        workspace.create_workspace(name, paths)


def test_workspace_names_are_unique_and_unknown_paths_are_skipped(clustered):
    workspace.create_workspace("Tax prep", ["a.txt", "ghost.txt"])

    assert [f["path"] for f in workspace.list_workspaces()[0]["files"]] == ["a.txt"]
    with pytest.raises(ValueError, match="already exists"):
        workspace.create_workspace("Tax prep", ["b.txt"])


def test_workspace_follows_an_organizer_move(clustered, fake_generate_json):
    workspace.create_workspace("Tax prep", ["a.txt"])
    fake_generate_json.append({"summary": "s", "tags": ["t"], "category": "invoices", "reasoning": "r"})
    suggest_for_file("a.txt")
    apply_organization("a.txt")

    files = workspace.list_workspaces()[0]["files"]

    assert [f["path"] for f in files] == ["invoices/a.txt"]


@pytest.mark.parametrize(
    "spoken, expected",
    [
        ("Tax prep", "Tax prep"),
        ("open my tax prep workspace", "Tax prep"),
        ("prep", "Tax prep"),
        ("holiday photos", None),
        ("open my workspace", None),  # nothing left once filler words are dropped
        ("", None),
    ],
)
def test_find_workspace_from_a_spoken_name(clustered, spoken, expected):
    workspace.create_workspace("Tax prep", ["a.txt"])

    found = workspace.find_workspace(spoken)

    assert (found["name"] if found else None) == expected


def test_open_workspace_returns_paths_and_records_the_opens(clustered):
    ws = workspace.create_workspace("Tax prep", ["a.txt", "b.txt"])

    opened = workspace.open_workspace(ws["id"])

    assert [p.replace("\\", "/").rsplit("/", 1)[-1] for p in opened] == ["a.txt", "b.txt"]
    assert memory.open_counts() == {"a.txt": 1, "b.txt": 1}
    assert workspace.open_workspace(9999) is None


# -------------------------------------------------------------- recommendations


def test_cluster_recommendation_names_the_group_after_its_category(clustered):
    recs = _of_kind(workspace.recommend(), "cluster")

    assert len(recs) == 1
    assert recs[0].paths == ["a.txt", "b.txt", "c.txt"]
    assert recs[0].workspace_name == "Invoices"
    assert recs[0].action == "create_workspace"


def test_cluster_is_not_recommended_once_a_workspace_covers_it(clustered):
    workspace.create_workspace("Everything invoices", ["a.txt", "b.txt", "c.txt"])

    assert _of_kind(workspace.recommend(), "cluster") == []


def test_cluster_recommendation_avoids_an_existing_workspace_name(clustered):
    workspace.create_workspace("Invoices", ["x.txt"])

    recs = _of_kind(workspace.recommend(), "cluster")

    assert recs[0].workspace_name == "Invoices (2)"


def test_oversized_clusters_are_skipped_as_graph_chaining(clustered, monkeypatch):
    monkeypatch.setattr(settings, "workspace_max_cluster_size", 2)

    assert _of_kind(workspace.recommend(), "cluster") == []


def test_frequent_recommendation_appears_after_enough_opens(clustered):
    for _ in range(settings.frequent_open_threshold - 1):
        memory.record_open("a.txt")
    assert _of_kind(workspace.recommend(), "frequent") == []

    memory.record_open("a.txt")
    recs = _of_kind(workspace.recommend(), "frequent")

    assert len(recs) == 1
    assert recs[0].paths == ["a.txt"]
    assert recs[0].workspace_name == "Frequently used"
    assert "a.txt (3x)" in recs[0].detail

    workspace.create_workspace("Frequently used", ["a.txt"])
    assert _of_kind(workspace.recommend(), "frequent") == []


def test_duplicate_recommendation_flags_identical_and_near_identical_files(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "one.txt").write_text("same text", encoding="utf-8")
    (vault / "two.txt").write_text("same text", encoding="utf-8")
    (vault / "three.txt").write_text("almost the same", encoding="utf-8")
    (vault / "other.txt").write_text("something else", encoding="utf-8")
    fake_embed["same text"] = [1.0, 0.0, 0.0, 0.0]
    fake_embed["almost the same"] = [0.99, 0.1, 0.0, 0.0]
    fake_embed["something else"] = [0.0, 0.0, 1.0, 0.0]
    index_vault(vault)

    recs = _of_kind(workspace.recommend(), "duplicate")

    by_pair = {tuple(sorted(r.paths)): r for r in recs}
    assert by_pair[("one.txt", "two.txt")].detail == "Identical content."
    assert "similar" in by_pair[("one.txt", "three.txt")].detail
    assert not any("other.txt" in r.paths for r in recs)


def test_unorganized_recommendation_lists_files_without_a_category(isolated_env, fake_embed):
    _index(isolated_env, fake_embed, {**LONERS})
    with connection() as conn:
        conn.execute("UPDATE files SET category = 'misc' WHERE path = 'x.txt'")

    recs = _of_kind(workspace.recommend(), "unorganized")

    assert len(recs) == 1
    assert recs[0].paths == ["y.txt"]
    assert recs[0].action == "organize"
    assert recs[0].title == "1 file not organized yet"

    with connection() as conn:
        conn.execute("UPDATE files SET category = 'misc'")
    assert _of_kind(workspace.recommend(), "unorganized") == []


def test_stale_recommendation_excludes_files_that_were_opened(clustered):
    memory.record_open("a.txt")
    long_after = time.time() + (settings.stale_days + 10) * workspace.SECONDS_PER_DAY

    stale = _of_kind(workspace.recommend(now=long_after), "stale")

    assert len(stale) == 1
    assert "a.txt" not in stale[0].paths
    assert set(stale[0].paths) == {"b.txt", "c.txt", "x.txt", "y.txt"}
    assert _of_kind(workspace.recommend(), "stale") == []  # nothing is old yet
