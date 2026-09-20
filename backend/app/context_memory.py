"""Context Memory Engine: session-aware conversation memory and usage memory.

Every chat turn is persisted, so follow-ups such as "open it", "the second one" or "what is
related to that" resolve against what was just shown - and survive an app restart. The same
module records which files the user opens, which the Workspace Manager mines for patterns.

Turns store file *ids*, not paths: the organizer can rename a file between turns, and an id
still resolves to the file's current path.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.config import settings
from app.db import connection
from app.search import SearchHit

MAX_SESSION_ID_LENGTH = 100

_ORDINAL_INDEX = {
    "first": 0, "1st": 0, "second": 1, "2nd": 1, "third": 2, "3rd": 2,
    "fourth": 3, "4th": 3, "fifth": 4, "5th": 4,
}
_ORDINAL_PATTERN = re.compile(
    r"\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\s+(one|file|result|match|hit|document)\b"
)
_LAST_ONE_PATTERN = re.compile(r"\blast\s+(one|file|result|match|hit|document)\b")
_PRONOUN_PATTERN = re.compile(r"\b(it|that|this|them|those|these|same)\b")

# A message made only of these is a bare follow-up ("open it", "what's related to that").
# Any word outside this set is real content, which the semantic search should handle instead.
_FOLLOWUP_FILLER = {
    "open", "show", "launch", "view", "display", "pull", "up", "bring", "me", "please", "can",
    "could", "you", "i", "want", "to", "the", "a", "an", "it", "that", "this", "these", "those",
    "them", "same", "one", "file", "files", "again", "now", "what", "what's", "whats", "is",
    "are", "related", "similar", "like", "more", "find", "and", "also", "of", "for", "about",
}


@dataclass
class Turn:
    role: str
    message: str
    intent: str | None
    paths: list[str] = field(default_factory=list)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def valid_session_id(session_id: str) -> bool:
    return bool(session_id) and len(session_id) <= MAX_SESSION_ID_LENGTH


def _ids_for_paths(conn, paths: list[str]) -> list[int]:
    ids = []
    for path in paths:
        row = conn.execute("SELECT id FROM files WHERE path = ?", (path,)).fetchone()
        if row:
            ids.append(row["id"])
    return ids


def _paths_for_ids(conn, ids: list[int]) -> list[str]:
    paths = []
    for file_id in ids:
        row = conn.execute("SELECT path FROM files WHERE id = ?", (file_id,)).fetchone()
        if row:
            paths.append(row["path"])
    return paths


def add_turn(
    session_id: str,
    role: str,
    message: str,
    intent: str | None = None,
    paths: list[str] | None = None,
) -> None:
    with connection() as conn:
        ids = _ids_for_paths(conn, paths or [])
        conn.execute(
            """
            INSERT INTO conversation_turns (session_id, role, message, intent, file_ids, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (session_id, role, message, intent, json.dumps(ids), _now()),
        )


def recent_turns(session_id: str, limit: int | None = None) -> list[Turn]:
    """The last `limit` turns of a session, oldest first."""
    with connection() as conn:
        if limit is None:
            rows = conn.execute(
                "SELECT role, message, intent, file_ids FROM conversation_turns "
                "WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT role, message, intent, file_ids FROM conversation_turns "
                "WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
            rows = list(reversed(rows))
        return [
            Turn(
                role=r["role"],
                message=r["message"],
                intent=r["intent"],
                paths=_paths_for_ids(conn, json.loads(r["file_ids"] or "[]")),
            )
            for r in rows
        ]


def clear_session(session_id: str) -> int:
    with connection() as conn:
        cursor = conn.execute("DELETE FROM conversation_turns WHERE session_id = ?", (session_id,))
        return cursor.rowcount


def last_result_paths(session_id: str) -> list[str]:
    """Files from the most recent assistant turn that showed any, in the order they were shown."""
    for turn in reversed(recent_turns(session_id)):
        if turn.role == "assistant" and turn.paths:
            return turn.paths
    return []


def format_for_prompt(session_id: str) -> str:
    turns = recent_turns(session_id, settings.memory_turns_in_prompt)
    if not turns:
        return ""
    lines = ["Conversation so far (oldest first):"]
    for turn in turns:
        speaker = "User" if turn.role == "user" else "Assistant"
        line = f"{speaker}: {turn.message}"
        if turn.paths:
            names = ", ".join(p.rsplit("/", 1)[-1] for p in turn.paths)
            line += f" [files shown, in order: {names}]"
        lines.append(line)
    return "\n".join(lines)


def resolve_reference(session_id: str, message: str, model_says_followup: bool = False) -> str | None:
    """Maps a follow-up message ("open it", "the second one") to a file from the last results.

    Deterministic on purpose: ordinals and bare pronouns are matched with rules rather than
    left to the small local model. The model's own "refers to previous" flag is accepted as a
    fallback for phrasings the rules do not cover ("open that file again").
    """
    paths = last_result_paths(session_id)
    if not paths:
        return None

    text = message.lower()

    ordinal = _ORDINAL_PATTERN.search(text)
    if ordinal:
        index = _ORDINAL_INDEX[ordinal.group(1)]
        return paths[index] if index < len(paths) else None
    if _LAST_ONE_PATTERN.search(text):
        return paths[-1]

    words = re.findall(r"[a-z0-9']+", text)
    if _PRONOUN_PATTERN.search(text) and all(w in _FOLLOWUP_FILLER for w in words):
        return paths[0]

    return paths[0] if model_says_followup else None


def record_open(path: str) -> None:
    with connection() as conn:
        ids = _ids_for_paths(conn, [path])
        if ids:
            conn.execute(
                "INSERT INTO usage_events (file_id, kind, created_at) VALUES (?, 'open', ?)",
                (ids[0], _now()),
            )


def open_counts() -> dict[str, int]:
    """How many times each file has been opened, keyed by current path."""
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT f.path, COUNT(*) AS n
            FROM usage_events u JOIN files f ON f.id = u.file_id
            WHERE u.kind = 'open'
            GROUP BY f.id
            """
        ).fetchall()
    return {r["path"]: r["n"] for r in rows}


def prefer_most_used(tied_hits: list[SearchHit]) -> SearchHit | None:
    """Breaks a near-tie between candidate files using how often the user opened each.

    Returns a hit only when exactly one candidate has been opened more than the rest - two
    files opened equally often is still ambiguous, and never guessing is the safer default.
    """
    counts = open_counts()
    ranked = sorted(tied_hits, key=lambda h: counts.get(h.path, 0), reverse=True)
    top = counts.get(ranked[0].path, 0)
    runner_up = counts.get(ranked[1].path, 0) if len(ranked) > 1 else 0
    return ranked[0] if top > 0 and top > runner_up else None
