import pytest

from app import context_memory as memory
from app.config import settings
from app.indexer import index_vault
from app.organizer import apply_organization, suggest_for_file
from app.search import hit_for_path


@pytest.fixture
def vault_with_files(isolated_env, fake_embed):
    """Indexes a.txt, b.txt, c.txt so turns have real files to point at."""
    vault = isolated_env
    for i, name in enumerate(["a.txt", "b.txt", "c.txt"]):
        content = f"file number {i}"
        (vault / name).write_text(content, encoding="utf-8")
        fake_embed[content] = [1.0 if j == i else 0.0 for j in range(4)]
    index_vault(vault)
    return vault


def _show(session: str, paths: list[str], message: str = "here you go") -> None:
    memory.add_turn(session, "user", "find stuff", "search")
    memory.add_turn(session, "assistant", message, "search", paths)


def test_turns_round_trip_in_order_and_respect_the_limit(vault_with_files):
    memory.add_turn("s", "user", "find my invoices", "search")
    memory.add_turn("s", "assistant", "found 2", "search", ["a.txt", "b.txt"])
    memory.add_turn("s", "user", "open it", "open")

    everything = memory.recent_turns("s")
    last_two = memory.recent_turns("s", limit=2)

    assert [t.message for t in everything] == ["find my invoices", "found 2", "open it"]
    assert everything[1].paths == ["a.txt", "b.txt"]
    assert [t.message for t in last_two] == ["found 2", "open it"]  # newest two, still oldest first


def test_sessions_are_isolated_and_clearable(vault_with_files):
    memory.add_turn("one", "user", "hello", "other")
    memory.add_turn("two", "user", "bonjour", "other")

    assert [t.message for t in memory.recent_turns("one")] == ["hello"]
    assert memory.clear_session("one") == 1
    assert memory.recent_turns("one") == []
    assert [t.message for t in memory.recent_turns("two")] == ["bonjour"]


def test_remembered_files_follow_an_organizer_move(vault_with_files, fake_generate_json):
    _show("s", ["a.txt"])
    fake_generate_json.append(
        {"summary": "s", "tags": ["x"], "category": "invoices", "reasoning": "r"}
    )
    suggest_for_file("a.txt")
    apply_organization("a.txt")

    assert memory.last_result_paths("s") == ["invoices/a.txt"]


def test_last_result_paths_skips_turns_that_showed_no_files(vault_with_files):
    _show("s", ["a.txt", "b.txt"])
    memory.add_turn("s", "user", "thanks", "other")
    memory.add_turn("s", "assistant", "anytime", "other", [])

    assert memory.last_result_paths("s") == ["a.txt", "b.txt"]


@pytest.mark.parametrize(
    "message, expected",
    [
        ("open it", "a.txt"),
        ("Open that one", "a.txt"),
        ("what's related to that", "a.txt"),
        ("open the second one", "b.txt"),
        ("open the 3rd file", "c.txt"),
        ("show me the last one", "c.txt"),
    ],
)
def test_followups_resolve_against_the_last_results(vault_with_files, message, expected):
    _show("s", ["a.txt", "b.txt", "c.txt"])

    assert memory.resolve_reference("s", message) == expected


@pytest.mark.parametrize(
    "message",
    [
        "find my resume",            # no reference at all
        "open that invoice",         # 'that' but with real content - semantic search's job
        "open the fifth one",        # only three results were shown
        "what did I say about it in march",  # too much content to be a bare follow-up
    ],
)
def test_messages_that_are_not_bare_followups_are_left_alone(vault_with_files, message):
    _show("s", ["a.txt", "b.txt", "c.txt"])

    assert memory.resolve_reference("s", message) is None


def test_nothing_resolves_without_earlier_results(vault_with_files):
    assert memory.resolve_reference("empty-session", "open it") is None


def test_model_followup_flag_covers_phrasings_the_rules_miss(vault_with_files):
    _show("s", ["a.txt", "b.txt"])

    assert memory.resolve_reference("s", "pull the earlier document back up", False) is None
    assert memory.resolve_reference("s", "pull the earlier document back up", True) == "a.txt"


def test_prompt_context_lists_recent_turns_with_file_names(vault_with_files, monkeypatch):
    monkeypatch.setattr(settings, "memory_turns_in_prompt", 2)
    memory.add_turn("s", "user", "old message that should be cut", "other")
    memory.add_turn("s", "user", "find invoices", "search")
    memory.add_turn("s", "assistant", "Found 2", "search", ["a.txt", "b.txt"])

    context = memory.format_for_prompt("s")

    assert "old message" not in context
    assert "User: find invoices" in context
    assert "Assistant: Found 2 [files shown, in order: a.txt, b.txt]" in context
    assert memory.format_for_prompt("nobody") == ""


def test_prefer_most_used_needs_a_single_clear_winner(vault_with_files):
    a, b = hit_for_path("a.txt"), hit_for_path("b.txt")

    assert memory.prefer_most_used([a, b]) is None  # never opened: no basis to choose

    memory.record_open("a.txt")
    assert memory.prefer_most_used([a, b]).path == "a.txt"

    memory.record_open("b.txt")
    assert memory.prefer_most_used([a, b]) is None  # tied again: stays ambiguous

    memory.record_open("b.txt")
    assert memory.prefer_most_used([a, b]).path == "b.txt"
    assert memory.open_counts() == {"a.txt": 1, "b.txt": 2}


def test_record_open_ignores_unknown_paths(vault_with_files):
    memory.record_open("ghost.txt")

    assert memory.open_counts() == {}
