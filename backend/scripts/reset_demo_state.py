"""Puts DreamOS back to a known state between demo rehearsals.

Clears everything a rehearsal leaves behind - conversation memory, usage history and
workspaces - and removes database rows (and their vectors) for files that no longer exist in
the vault, then rebuilds the knowledge graph. It never touches the files themselves; use
generate_demo_vault.py --reset for that.

Run with the backend stopped or idle:
    python backend/scripts/reset_demo_state.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import knowledge_graph, vectorstore  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import connection, init_db  # noqa: E402

REHEARSAL_TABLES = ("workspace_files", "workspaces", "usage_events", "conversation_turns")


def reset() -> dict:
    init_db()
    with connection() as conn:
        cleared = {}
        for table in REHEARSAL_TABLES:
            cleared[table] = conn.execute(f"DELETE FROM {table}").rowcount

        indexed = [row["path"] for row in conn.execute("SELECT path FROM files").fetchall()]
        missing = [p for p in indexed if not (settings.vault_dir / p).exists()]
        for path in missing:
            conn.execute("DELETE FROM files WHERE path = ?", (path,))

    for path in missing:
        vectorstore.delete_chunks_for_path(path)

    graph = knowledge_graph.rebuild()
    return {"cleared": cleared, "pruned_missing_files": missing, "graph": graph}


if __name__ == "__main__":
    result = reset()
    print("cleared:", ", ".join(f"{t}={n}" for t, n in result["cleared"].items()))
    print("pruned files no longer in the vault:", result["pruned_missing_files"] or "none")
    print(f"graph rebuilt: {result['graph']['nodes']} files, {result['graph']['edges']} links")
