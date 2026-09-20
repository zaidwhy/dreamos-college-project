import importlib.util
from pathlib import Path

from app import context_memory, workspace
from app.db import connection
from app.indexer import index_vault


def _load_reset():
    path = Path(__file__).resolve().parent.parent / "scripts" / "reset_demo_state.py"
    spec = importlib.util.spec_from_file_location("reset_demo_state", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_reset_clears_rehearsal_state_and_prunes_deleted_files(isolated_env, fake_embed):
    vault = isolated_env
    for i, name in enumerate(["keep.txt", "gone.txt"]):
        (vault / name).write_text(f"body {i}", encoding="utf-8")
        fake_embed[f"body {i}"] = [1.0 if j == i else 0.0 for j in range(4)]
    index_vault(vault)
    workspace.create_workspace("Rehearsal", ["keep.txt"])
    context_memory.record_open("keep.txt")
    context_memory.add_turn("s", "user", "hello", "other")
    (vault / "gone.txt").unlink()

    result = _load_reset().reset()

    assert result["pruned_missing_files"] == ["gone.txt"]
    assert workspace.list_workspaces() == []
    assert context_memory.open_counts() == {}
    assert context_memory.recent_turns("s") == []
    with connection() as conn:
        assert [r["path"] for r in conn.execute("SELECT path FROM files").fetchall()] == ["keep.txt"]
    assert (vault / "keep.txt").exists()  # the files themselves are never touched
