import hashlib
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app import knowledge_graph, vectorstore
from app.config import settings
from app.db import connection
from app.extractors import ExtractionError, chunk_text, extract_text
from app.ollama_client import OllamaError, embed


@dataclass
class IndexResult:
    indexed: list[str] = field(default_factory=list)
    skipped_unchanged: list[str] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)
    graph_edges: int | None = None


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def index_one_file(conn: sqlite3.Connection, vault_dir: Path, path: Path, rel_path: str) -> None:
    """Embeds and upserts a single file's chunks + metadata row. Raises ExtractionError/OllamaError
    on failure - callers decide whether to catch or propagate.
    """
    content_hash = _hash_file(path)
    text = extract_text(path)
    chunks = chunk_text(text)
    if not chunks:
        raise ExtractionError("No extractable text content")

    vectorstore.delete_chunks_for_path(rel_path)
    embeddings = [embed(chunk) for chunk in chunks]
    chunk_ids = [f"{rel_path}::{i}" for i in range(len(chunks))]
    vectorstore.upsert_chunks(rel_path, chunk_ids, chunks, embeddings)

    stat = path.stat()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO files (path, original_path, name, extension, size_bytes,
                            mtime, content_hash, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            size_bytes=excluded.size_bytes,
            mtime=excluded.mtime,
            content_hash=excluded.content_hash,
            indexed_at=excluded.indexed_at
        """,
        (
            rel_path,
            rel_path,
            path.name,
            path.suffix.lower(),
            stat.st_size,
            stat.st_mtime,
            content_hash,
            now,
        ),
    )


def index_vault(vault_dir: Path | None = None) -> IndexResult:
    vault_dir = vault_dir or settings.vault_dir
    result = IndexResult()

    candidates = sorted(
        p
        for p in vault_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in settings.supported_extensions
    )

    with connection() as conn:
        for path in candidates:
            rel_path = str(path.relative_to(vault_dir))
            try:
                content_hash = _hash_file(path)
                existing = conn.execute(
                    "SELECT content_hash FROM files WHERE path = ?", (rel_path,)
                ).fetchone()
                if existing and existing["content_hash"] == content_hash:
                    result.skipped_unchanged.append(rel_path)
                    continue

                index_one_file(conn, vault_dir, path, rel_path)
                result.indexed.append(rel_path)
            except (ExtractionError, OllamaError) as exc:
                result.errors[rel_path] = str(exc)

    # Rebuilt only after the write transaction above has committed - a second connection
    # writing edges while the indexer's own transaction is still open would hit a SQLite lock.
    if result.indexed:
        result.graph_edges = knowledge_graph.rebuild()["edges"]

    return result
