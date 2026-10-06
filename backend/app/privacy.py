"""Privacy audit: a plain-language answer to "where could my files or questions go?".

The audit reads the live configuration, not a hard-coded claim, so it changes if someone points
DreamOS at a remote model. It cannot see traffic at the operating-system level - for that, check
with `netstat -ano` (the backend should listen only on 127.0.0.1) - and the report says so.
"""

from urllib.parse import urlparse

from app.config import settings

LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def audit() -> dict:
    endpoints = []
    for name, url, purpose in [
        ("Local AI runtime (Ollama)", settings.ollama_base_url,
         "creates embeddings for files and queries, and classifies intent, summaries and tags"),
    ]:
        host = urlparse(url).hostname or ""
        endpoints.append({
            "name": name,
            "url": url,
            "host": host,
            "is_loopback": host in LOOPBACK_HOSTS,
            "used_for": purpose,
        })

    local_only = all(e["is_loopback"] for e in endpoints)
    return {
        "local_only": local_only,
        "data_can_leave_machine": not local_only,
        "endpoints": endpoints,
        "vault_folder": str(settings.vault_dir),
        "app_data_folder": str(settings.data_dir),
        "stored_locally": [
            "file names, sizes and content hashes (SQLite)",
            "text chunks and their embeddings (ChromaDB)",
            "conversation turns and usage history (SQLite)",
            "workspaces you create (SQLite)",
        ],
        "not_verified_by_this_report": (
            "This report checks the configuration DreamOS uses. To confirm at the network level, "
            "run `netstat -ano` and check that the DreamOS backend listens on 127.0.0.1:8420 only."
        ),
    }
