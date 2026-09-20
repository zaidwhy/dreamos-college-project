from app.config import settings
from app.indexer import index_vault
from app.search import semantic_search

RELEVANT_TEXT = "apple pie recipe with cinnamon"
IRRELEVANT_TEXT = "quarterly tax invoice line items"
QUERY_TEXT = "how do I bake an apple pie"


def _setup_vault(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "relevant.txt").write_text(RELEVANT_TEXT, encoding="utf-8")
    (vault / "irrelevant.txt").write_text(IRRELEVANT_TEXT, encoding="utf-8")

    fake_embed[RELEVANT_TEXT] = [1.0, 0.0, 0.0, 0.0]
    fake_embed[IRRELEVANT_TEXT] = [0.0, 1.0, 0.0, 0.0]
    fake_embed[QUERY_TEXT] = [1.0, 0.0, 0.0, 0.0]

    index_vault(vault)
    return vault


def test_semantic_search_returns_only_matches_above_threshold(isolated_env, fake_embed, monkeypatch):
    _setup_vault(isolated_env, fake_embed)
    monkeypatch.setattr(settings, "search_similarity_threshold", 0.55)

    hits = semantic_search(QUERY_TEXT)

    paths = [h.path for h in hits]
    assert paths == ["relevant.txt"]
    assert hits[0].similarity > 0.9


def test_semantic_search_returns_nothing_when_everything_is_below_the_floor(isolated_env, fake_embed, monkeypatch):
    _setup_vault(isolated_env, fake_embed)
    # push the floor above even the perfect match's similarity - nothing should qualify
    monkeypatch.setattr(settings, "search_floor", 1.5)

    hits = semantic_search(QUERY_TEXT)

    assert hits == []


def _doc_at_similarity(vault, fake_embed, name: str, similarity: float) -> None:
    """A document whose cosine similarity to the query [1,0,0,0] is exactly `similarity`."""
    text = f"document {name}"
    (vault / name).write_text(text, encoding="utf-8")
    fake_embed[text] = [similarity, (1 - similarity**2) ** 0.5, 0.0, 0.0]


def test_a_weak_best_match_is_still_returned_when_it_clears_the_floor(isolated_env, fake_embed):
    # Short queries score low even when the top hit is right; a fixed cutoff used to drop them.
    _doc_at_similarity(isolated_env, fake_embed, "weak_but_right.txt", 0.52)
    fake_embed["meeting"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(isolated_env)

    hits = semantic_search("meeting")

    assert [h.path for h in hits] == ["weak_but_right.txt"]
    assert hits[0].similarity < settings.search_similarity_threshold


def test_only_files_close_to_the_best_hit_are_returned(isolated_env, fake_embed):
    _doc_at_similarity(isolated_env, fake_embed, "best.txt", 0.80)
    _doc_at_similarity(isolated_env, fake_embed, "close.txt", 0.76)  # within the 0.06 margin
    _doc_at_similarity(isolated_env, fake_embed, "far.txt", 0.60)  # above the floor, far below the best
    fake_embed["query"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(isolated_env)

    hits = semantic_search("query")

    assert [h.path for h in hits] == ["best.txt", "close.txt"]


def test_junk_below_the_floor_is_not_returned_even_as_the_best_hit(isolated_env, fake_embed):
    _doc_at_similarity(isolated_env, fake_embed, "unrelated.txt", 0.30)
    fake_embed["query"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(isolated_env)

    assert semantic_search("query") == []


def test_semantic_search_respects_top_k(isolated_env, fake_embed, monkeypatch):
    vault = isolated_env
    texts = [f"topic about gardening variant {i}" for i in range(5)]
    for i, text in enumerate(texts):
        (vault / f"doc{i}.txt").write_text(text, encoding="utf-8")
        fake_embed[text] = [1.0, 0.0, 0.0, 0.0]

    query = "gardening tips"
    fake_embed[query] = [1.0, 0.0, 0.0, 0.0]
    monkeypatch.setattr(settings, "search_similarity_threshold", 0.5)

    index_vault(vault)
    hits = semantic_search(query, top_k=2)

    assert len(hits) == 2


# ------------------------------------------------------------------ keyword boost


def test_a_literal_keyword_match_outranks_a_slightly_closer_embedding(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "meeting_log.txt").write_text("Meeting - 2026-04-12 decided the scope", encoding="utf-8")
    (vault / "unrelated.txt").write_text("gym leg day and a long run", encoding="utf-8")
    # unrelated.txt is semantically a little closer to the query, but only meeting_log says "meeting"
    fake_embed["Meeting - 2026-04-12 decided the scope"] = [0.50, 0.866, 0.0, 0.0]
    fake_embed["gym leg day and a long run"] = [0.53, 0.848, 0.0, 0.0]
    fake_embed["meeting"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    hits = semantic_search("meeting")

    assert [h.path for h in hits][0] == "meeting_log.txt"


def test_the_keyword_boost_can_be_switched_off(isolated_env, fake_embed, monkeypatch):
    vault = isolated_env
    (vault / "meeting_log.txt").write_text("Meeting - 2026-04-12 decided the scope", encoding="utf-8")
    (vault / "unrelated.txt").write_text("gym leg day and a long run", encoding="utf-8")
    fake_embed["Meeting - 2026-04-12 decided the scope"] = [0.50, 0.866, 0.0, 0.0]
    fake_embed["gym leg day and a long run"] = [0.53, 0.848, 0.0, 0.0]
    fake_embed["meeting"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)
    monkeypatch.setattr(settings, "search_lexical_weight", 0.0)

    assert [h.path for h in semantic_search("meeting")][0] == "unrelated.txt"


def test_a_keyword_in_the_filename_counts(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "meeting_notes.txt").write_text("agenda and attendees", encoding="utf-8")
    (vault / "other.txt").write_text("shopping list for the weekend", encoding="utf-8")
    fake_embed["agenda and attendees"] = [0.50, 0.866, 0.0, 0.0]
    fake_embed["shopping list for the weekend"] = [0.53, 0.848, 0.0, 0.0]
    fake_embed["meeting"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    assert semantic_search("meeting")[0].path == "meeting_notes.txt"


def test_the_boosted_score_never_exceeds_one(isolated_env, fake_embed):
    vault = isolated_env
    (vault / "pie.txt").write_text("apple pie", encoding="utf-8")
    fake_embed["apple pie"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    assert semantic_search("apple pie")[0].similarity == 1.0


def test_a_query_of_only_stopwords_is_searched_without_a_boost(isolated_env, fake_embed):
    _setup_vault(isolated_env, fake_embed)
    fake_embed["find something about"] = [1.0, 0.0, 0.0, 0.0]

    hits = semantic_search("find something about")

    assert [h.path for h in hits] == ["relevant.txt"]
