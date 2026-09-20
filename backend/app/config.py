from pathlib import Path

from pydantic import ConfigDict
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    vault_dir: Path = PROJECT_DIR / "demo-vault"
    data_dir: Path = BACKEND_DIR / "data"
    chroma_dir: Path = BACKEND_DIR / "data" / "chroma"
    sqlite_path: Path = BACKEND_DIR / "data" / "dreamos.db"

    ollama_base_url: str = "http://localhost:11434"
    embed_model: str = "nomic-embed-text"
    llm_model: str = "llama3.2"

    # nomic-embed-text puts unrelated text around ~0.5 cosine similarity, not near 0 -
    # a naive high threshold (e.g. 0.8) silently drops every real match. Tuned empirically
    # against the demo vault's known-relevant/known-irrelevant query pairs.
    # A match at or above this is reported as a match ("confident"); "open" only launches at or
    # above it. It is no longer a hard cutoff: short queries ("meeting") score low even when the
    # top hit is right, and on a 27-query labelled set a fixed 0.55 cutoff missed 7 of them.
    search_similarity_threshold: float = 0.55
    search_top_k: int = 8
    # What is returned: nothing below the floor, and otherwise every file within `margin` of the
    # best hit. On the same set this found a correct file for 27 of 27 queries (20 of 27 before).
    search_floor: float = 0.47
    search_relative_margin: float = 0.06
    # Embeddings under-weight literal keywords in short queries ("meeting" vs a file that says
    # "Meeting - 2026-04-12"). Each file gets this much extra score, scaled by the fraction of the
    # query's words that appear in its text or filename. Top-1 accuracy on the labelled set went
    # from 21/27 to 24/27 (13/14 vs 10/14 held-out) and stayed there for weights 0.08 to 0.20.
    search_lexical_weight: float = 0.08

    # "open" auto-launches a file, so a close runner-up (e.g. a teammate's similarly-worded
    # CV) must block auto-open rather than silently launching the wrong person's file.
    open_ambiguity_margin: float = 0.05

    # Knowledge Graph. nomic-embed-text vectors share a large common direction, so raw doc-vs-doc
    # cosine is compressed (demo vault: median 0.52, max 0.83) and unrelated pairs outscore real
    # relatives. Subtracting the corpus mean first spreads scores out (unrelated ~0, related
    # 0.25-0.4), and the thresholds below are on that centered scale. Measured on the demo vault.
    graph_center_vectors: bool = True
    graph_similarity_threshold: float = 0.25
    graph_top_k: int = 3
    graph_min_shared_tags: int = 2
    graph_duplicate_threshold: float = 0.9

    # Context Memory Engine
    memory_turns_in_prompt: int = 6

    # Intelligent Workspace Manager
    workspace_min_cluster_size: int = 3
    # Clusters come from average-linkage merging: two groups join only while the *average* edge
    # weight between all their member pairs (a missing edge counts as 0) stays above this. A single
    # bridge edge between two tight groups averages out to near zero, so they cannot chain together.
    graph_cluster_min_link: float = 0.12
    workspace_max_cluster_size: int = 12  # a bigger "cluster" means the graph chained unrelated files
    workspace_max_recommendations_per_kind: int = 5
    frequent_open_threshold: int = 3
    stale_days: int = 90

    supported_extensions: tuple[str, ...] = (
        ".txt",
        ".md",
        ".py",
        ".js",
        ".pdf",
        ".docx",
    )

    model_config = ConfigDict(env_prefix="DREAMOS_")


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
