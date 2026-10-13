from app.db import connection
from app.indexer import index_vault


def test_index_vault_indexes_supported_files(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "a.txt").write_text("first file content", encoding="utf-8")
    (vault / "b.md").write_text("second file content", encoding="utf-8")
    (vault / "ignored.exe").write_bytes(b"\x00\x01")

    result = index_vault(vault)

    assert sorted(result.indexed) == ["a.txt", "b.md"]
    assert result.skipped_unchanged == []
    assert result.errors == {}

    with connection() as conn:
        rows = conn.execute("SELECT path FROM files ORDER BY path").fetchall()
    assert [r["path"] for r in rows] == ["a.txt", "b.md"]


def test_index_vault_skips_unchanged_files_on_second_run(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "a.txt").write_text("stable content", encoding="utf-8")

    first = index_vault(vault)
    assert first.indexed == ["a.txt"]

    second = index_vault(vault)
    assert second.indexed == []
    assert second.skipped_unchanged == ["a.txt"]


def test_index_vault_reindexes_when_content_changes(isolated_env, fake_embed):
    vault = isolated_env
    f = vault / "a.txt"
    f.write_text("version one", encoding="utf-8")
    index_vault(vault)

    f.write_text("version two - completely different", encoding="utf-8")
    result = index_vault(vault)

    assert result.indexed == ["a.txt"]
    assert result.skipped_unchanged == []


def test_index_vault_reports_empty_file_as_error(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "empty.txt").write_text("", encoding="utf-8")

    result = index_vault(vault)

    assert result.indexed == []
    assert "empty.txt" in result.errors


def test_reindex_prunes_entries_for_files_deleted_from_the_vault(isolated_env, fake_embed):
    from app import vectorstore
    from app.db import connection

    vault = isolated_env
    for name, text, vec in [("a.txt", "alpha", [1.0, 0, 0, 0]), ("b.txt", "beta", [0, 1.0, 0, 0]), ("c.txt", "gamma", [0, 0, 1.0, 0])]:
        (vault / name).write_text(text, encoding="utf-8")
        fake_embed[text] = vec
    index_vault(vault)
    with connection() as conn:
        b_id = conn.execute("SELECT id FROM files WHERE path = 'b.txt'").fetchone()["id"]
        conn.execute("INSERT INTO usage_events (file_id, kind, created_at) VALUES (?, 'open', 'now')", (b_id,))

    (vault / "b.txt").unlink()
    result = index_vault(vault)

    assert result.pruned == ["b.txt"]
    with connection() as conn:
        assert [r["path"] for r in conn.execute("SELECT path FROM files ORDER BY path")] == ["a.txt", "c.txt"]
        assert conn.execute("SELECT COUNT(*) AS n FROM usage_events").fetchone()["n"] == 0  # cascaded
    assert "b.txt" not in {m["path"] for m in vectorstore.get_collection().get()["metadatas"]}


def test_missing_vault_folder_prunes_nothing(isolated_env, fake_embed, tmp_path):
    from app.db import connection
    from app.indexer import prune_missing

    vault = isolated_env
    (vault / "a.txt").write_text("alpha", encoding="utf-8")
    fake_embed["alpha"] = [1.0, 0, 0, 0]
    index_vault(vault)
    with connection() as conn:
        assert prune_missing(conn, tmp_path / "not-mounted") == []
        assert conn.execute("SELECT COUNT(*) AS n FROM files").fetchone()["n"] == 1
