import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import vectorstore
from app.config import settings
from app.db import init_db


@pytest.fixture
def isolated_env(tmp_path, monkeypatch):
    """Points every stateful path (vault, sqlite, chroma) at a throwaway tmp_path tree
    and guarantees the ChromaDB client is closed before tmp_path's own teardown -
    otherwise Windows raises WinError 32 (file still in use) when the fixture cleans up.
    """
    vault_dir = tmp_path / "vault"
    vault_dir.mkdir()
    monkeypatch.setattr(settings, "vault_dir", vault_dir)
    monkeypatch.setattr(settings, "data_dir", tmp_path / "data")
    monkeypatch.setattr(settings, "chroma_dir", tmp_path / "data" / "chroma")
    monkeypatch.setattr(settings, "sqlite_path", tmp_path / "data" / "dreamos.db")
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    # Production centers vectors and uses centered-scale thresholds. Tests use small hand-built
    # vectors whose raw cosines are easy to reason about, so they run on the raw scale; the
    # centering step itself has dedicated tests that turn it back on.
    monkeypatch.setattr(settings, "graph_center_vectors", False)
    monkeypatch.setattr(settings, "graph_similarity_threshold", 0.75)
    monkeypatch.setattr(settings, "graph_duplicate_threshold", 0.95)

    init_db()
    yield vault_dir
    vectorstore.close_client()


@pytest.fixture
def fake_embed(monkeypatch):
    """Lets a test define exact embedding vectors for specific text, with a stable
    hash-based fallback for anything not explicitly registered - keeps similarity
    scoring fully deterministic without needing a real Ollama model running.
    """
    overrides: dict[str, list[float]] = {}

    def _embed(text: str) -> list[float]:
        if text in overrides:
            return overrides[text]
        # deterministic fallback: a low-magnitude vector derived from text length/hash,
        # far from any explicitly-registered vector so it won't accidentally match.
        h = sum(text.encode("utf-8")) % 97
        return [0.001 * h, 0.001 * (h + 1), 0.001 * (h + 2), 0.001 * (h + 3)]

    # Every module imports `embed` by name (`from app.ollama_client import embed`), so
    # patching app.ollama_client.embed alone would miss those already-bound references -
    # patch each importer's local binding too.
    monkeypatch.setattr("app.ollama_client.embed", _embed)
    monkeypatch.setattr("app.indexer.embed", _embed)
    monkeypatch.setattr("app.search.embed", _embed)
    return overrides


@pytest.fixture
def fake_generate_json(monkeypatch):
    """Lets a test queue canned JSON responses for app.ollama_client.generate_json,
    in call order, so organizer/nl_interface logic can be tested without Ollama running.
    """
    responses: list[dict] = []

    def _generate_json(prompt: str, system: str | None = None) -> dict:
        if not responses:
            raise AssertionError("fake_generate_json called with no queued response left")
        return responses.pop(0)

    monkeypatch.setattr("app.ollama_client.generate_json", _generate_json)
    monkeypatch.setattr("app.organizer.generate_json", _generate_json)
    monkeypatch.setattr("app.nl_interface.generate_json", _generate_json)
    return responses
