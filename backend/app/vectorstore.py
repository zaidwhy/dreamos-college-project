import chromadb
from chromadb.api.models.Collection import Collection

from app.config import settings

_client = None


def get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(settings.chroma_dir))
    return _client


def get_collection() -> Collection:
    return get_client().get_or_create_collection(
        name="dreamos_files",
        metadata={"hnsw:space": "cosine"},
    )


def close_client() -> None:
    """Releases the PersistentClient so its sqlite handle isn't held open.

    Windows raises WinError 32 if a TemporaryDirectory (used in tests) tears down while
    this client still has the file open - always close before the test fixture cleans up.
    """
    global _client
    _client = None


def delete_chunks_for_path(path: str) -> None:
    collection = get_collection()
    collection.delete(where={"path": path})


def upsert_chunks(path: str, chunk_ids: list[str], chunks: list[str], embeddings: list[list[float]]) -> None:
    collection = get_collection()
    collection.upsert(
        ids=chunk_ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"path": path, "chunk_index": i} for i in range(len(chunks))],
    )


def get_file_vectors() -> dict[str, list[float]]:
    """One vector per file: the mean of its chunk embeddings, keyed by vault-relative path."""
    data = get_collection().get(include=["embeddings", "metadatas"])
    sums: dict[str, list[float]] = {}
    counts: dict[str, int] = {}
    for embedding, metadata in zip(data["embeddings"], data["metadatas"]):
        path = metadata["path"]
        values = [float(x) for x in embedding]
        if path not in sums:
            sums[path] = values
            counts[path] = 1
        else:
            sums[path] = [a + b for a, b in zip(sums[path], values)]
            counts[path] += 1
    return {path: [x / counts[path] for x in total] for path, total in sums.items()}


def query(embedding: list[float], top_k: int) -> dict:
    collection = get_collection()
    return collection.query(query_embeddings=[embedding], n_results=top_k)
