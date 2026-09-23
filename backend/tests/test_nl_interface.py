import pytest

from app import context_memory, knowledge_graph, workspace
from app.indexer import index_vault
from app.nl_interface import handle_message


def test_handle_message_routes_search_intent(isolated_env, fake_embed, fake_generate_json):
    vault = isolated_env
    content = "my resume with all my work experience"
    (vault / "resume.txt").write_text(content, encoding="utf-8")
    fake_embed[content] = [1.0, 0.0, 0.0, 0.0]
    fake_embed["find my resume"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    fake_generate_json.append({"intent": "search", "query": "find my resume"})

    response = handle_message("find my resume")

    assert response.intent == "search"
    assert len(response.search_results) == 1
    assert response.search_results[0].path == "resume.txt"


def test_handle_message_routes_open_intent(isolated_env, fake_embed, fake_generate_json):
    vault = isolated_env
    content = "my resume with all my work experience"
    (vault / "resume.txt").write_text(content, encoding="utf-8")
    fake_embed[content] = [1.0, 0.0, 0.0, 0.0]
    fake_embed["open resume"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    fake_generate_json.append({"intent": "open", "query": "open resume"})

    response = handle_message("open resume")

    assert response.intent == "open"
    assert response.open_path is not None
    assert response.open_path.endswith("resume.txt")
    assert len(response.search_results) == 1


def test_handle_message_open_intent_with_no_match(isolated_env, fake_embed, fake_generate_json):
    fake_generate_json.append({"intent": "open", "query": "nonexistent file"})

    response = handle_message("open nonexistent file")

    assert response.intent == "open"
    assert response.open_path is None


def test_handle_message_routes_organize_intent(isolated_env, fake_embed, fake_generate_json):
    vault = isolated_env
    content = "meeting notes from today's sync"
    (vault / "notes.txt").write_text(content, encoding="utf-8")
    fake_embed[content] = [0.2, 0.2, 0.2, 0.2]
    index_vault(vault)

    fake_generate_json.append({"intent": "organize", "query": ""})
    fake_generate_json.append(
        {
            "summary": "meeting notes",
            "tags": ["meeting"],
            "category": "meeting_notes",
            "reasoning": "discusses a sync",
        }
    )

    response = handle_message("please sort my files")

    assert response.intent == "organize"
    assert len(response.organize_suggestions) == 1
    assert response.organize_suggestions[0]["category"] == "meeting_notes"


def test_handle_message_falls_back_to_other_on_unknown_intent(isolated_env, fake_embed, fake_generate_json):
    fake_generate_json.append({"intent": "does_not_exist", "query": ""})

    response = handle_message("hello there")

    assert response.intent == "other"
    assert response.search_results == []
    assert response.organize_suggestions == []


# ---------------------------------------------------------------- session memory
# a.txt / b.txt / c.txt match the query "invoices" in that order (1.0, 0.97, 0.95): all within the
# search margin of the best hit, so all three are returned.


@pytest.fixture
def invoice_vault(isolated_env, fake_embed):
    vault = isolated_env
    vectors = {
        "a.txt": [1.0, 0.0, 0.0, 0.0],
        "b.txt": [0.97, 0.243, 0.0, 0.0],
        "c.txt": [0.95, 0.312, 0.0, 0.0],
    }
    for name, vector in vectors.items():
        (vault / name).write_text(f"body of {name}", encoding="utf-8")
        fake_embed[f"body of {name}"] = vector
    fake_embed["invoices"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)
    return vault


def _search_first(fake_generate_json, session="s"):
    fake_generate_json.append({"intent": "search", "query": "invoices"})
    return handle_message("find my invoices", session_id=session)


def test_open_the_second_one_resolves_against_the_previous_results(invoice_vault, fake_generate_json):
    shown = _search_first(fake_generate_json)
    assert [h.path for h in shown.search_results] == ["a.txt", "b.txt", "c.txt"]

    fake_generate_json.append({"intent": "open", "query": "the second one", "refers_to_previous": True})
    response = handle_message("open the second one", session_id="s")

    assert response.intent == "open"
    assert response.open_path.endswith("b.txt")


def test_open_it_is_forced_to_open_even_if_the_model_calls_it_a_search(invoice_vault, fake_generate_json):
    _search_first(fake_generate_json)

    fake_generate_json.append({"intent": "search", "query": "it"})  # the small model got it wrong
    response = handle_message("open it", session_id="s")

    assert response.intent == "open"
    assert response.open_path.endswith("a.txt")


def test_followup_is_not_resolved_without_a_session(invoice_vault, fake_generate_json):
    _search_first(fake_generate_json, session=None)

    fake_generate_json.append({"intent": "open", "query": "it", "refers_to_previous": True})
    response = handle_message("open it")

    assert response.open_path is None  # no memory: "it" is just a query nothing matches


def test_conversation_context_reaches_the_models_prompt(invoice_vault, monkeypatch):
    prompts = []
    replies = [
        {"intent": "search", "query": "invoices"},
        {"intent": "open", "query": "it", "refers_to_previous": True},
    ]

    def capture(prompt, system=None):
        prompts.append(prompt)
        return replies.pop(0)

    monkeypatch.setattr("app.nl_interface.generate_json", capture)

    handle_message("find my invoices", session_id="s")
    handle_message("open it", session_id="s")

    assert prompts[0] == "find my invoices"  # first message: no history to add
    assert "User: find my invoices" in prompts[1]
    assert "[files shown, in order: a.txt, b.txt, c.txt]" in prompts[1]
    assert prompts[1].endswith("New user message: open it")


def test_turns_are_saved_for_the_session(invoice_vault, fake_generate_json):
    _search_first(fake_generate_json)

    turns = context_memory.recent_turns("s")

    assert [t.role for t in turns] == ["user", "assistant"]
    assert turns[1].paths == ["a.txt", "b.txt", "c.txt"]


# ------------------------------------------------------ open ambiguity and usage memory


def test_close_call_between_files_prefers_the_one_the_user_opens(isolated_env, fake_embed, fake_generate_json):
    vault = isolated_env
    for name, vector in {"cv_a.txt": [1.0, 0.0, 0.0, 0.0], "cv_b.txt": [0.99, 0.14, 0.0, 0.0]}.items():
        (vault / name).write_text(f"body of {name}", encoding="utf-8")
        fake_embed[f"body of {name}"] = vector
    fake_embed["my cv"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)

    fake_generate_json.append({"intent": "open", "query": "my cv"})
    first = handle_message("open my cv")
    assert first.open_path is None  # too close to call, nothing opened
    assert len(first.search_results) == 2

    context_memory.record_open("cv_b.txt")
    fake_generate_json.append({"intent": "open", "query": "my cv"})
    second = handle_message("open my cv")

    assert second.open_path.endswith("cv_b.txt")
    assert "you open most" in second.message


def test_a_successful_open_is_recorded_as_usage(invoice_vault, fake_embed, fake_generate_json):
    fake_embed["invoices"] = [1.0, -0.3, 0.0, 0.0]  # a.txt clearly closest (0.96 vs 0.86 and 0.82)
    fake_generate_json.append({"intent": "open", "query": "invoices"})

    handle_message("open invoices")

    assert context_memory.open_counts() == {"a.txt": 1}


# ------------------------------------------------------- related and workspace intents


def test_related_intent_uses_the_knowledge_graph(invoice_vault, fake_generate_json):
    knowledge_graph.rebuild()
    fake_generate_json.append({"intent": "related", "query": "invoices"})

    response = handle_message("what's related to my invoices")

    assert response.intent == "related"
    names = [h.name for h in response.search_results]
    assert names and "a.txt" not in names  # the file itself is never its own neighbour
    assert {r["path"] for r in response.related} == set(names)


def test_related_followup_resolves_to_the_file_just_shown(invoice_vault, fake_generate_json):
    knowledge_graph.rebuild()
    _search_first(fake_generate_json)

    fake_generate_json.append({"intent": "related", "query": "that", "refers_to_previous": True})
    response = handle_message("what's related to that", session_id="s")

    assert response.intent == "related"
    assert "related to a.txt" in response.message


def test_related_reports_a_file_with_no_links(isolated_env, fake_embed, fake_generate_json):
    (isolated_env / "lonely.txt").write_text("all alone", encoding="utf-8")
    fake_embed["all alone"] = [1.0, 0.0, 0.0, 0.0]
    fake_embed["lonely"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(isolated_env)
    fake_generate_json.append({"intent": "related", "query": "lonely"})

    response = handle_message("related to lonely")

    assert response.search_results == []
    assert "isn't linked" in response.message


def test_workspace_intent_lists_suggestions_and_workspaces(invoice_vault, fake_generate_json):
    knowledge_graph.rebuild()
    workspace.create_workspace("Mine", ["a.txt"])
    fake_generate_json.append({"intent": "workspace", "query": ""})

    response = handle_message("what should I clean up")

    assert response.intent == "workspace"
    assert [w["name"] for w in response.workspaces] == ["Mine"]
    assert any(r["kind"] == "unorganized" for r in response.recommendations)
    assert response.open_paths == []


def test_workspace_intent_opens_a_named_workspace(invoice_vault, fake_generate_json):
    workspace.create_workspace("Tax prep", ["a.txt", "b.txt"])
    fake_generate_json.append({"intent": "workspace", "query": "tax prep"})

    response = handle_message("open my tax prep workspace")

    assert len(response.open_paths) == 2
    assert response.open_paths[0].endswith("a.txt")
    assert context_memory.open_counts() == {"a.txt": 1, "b.txt": 1}


# ------------------------------------------------- weak matches: shown as guesses, never opened


def _weak_vault(isolated_env, fake_embed):
    # cosine similarity to the query [1,0,0,0] is 0.50: above the search floor, below "confident"
    (isolated_env / "maybe.txt").write_text("a vague document", encoding="utf-8")
    fake_embed["a vague document"] = [0.5, 0.866, 0.0, 0.0]
    fake_embed["vague query"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(isolated_env)


def test_a_weak_search_hit_is_labelled_as_a_low_confidence_guess(isolated_env, fake_embed, fake_generate_json):
    _weak_vault(isolated_env, fake_embed)
    fake_generate_json.append({"intent": "search", "query": "vague query"})

    response = handle_message("vague query")

    assert [h.path for h in response.search_results] == ["maybe.txt"]
    assert "No strong match" in response.message and "low confidence" in response.message


def test_open_never_launches_a_low_confidence_match(isolated_env, fake_embed, fake_generate_json):
    _weak_vault(isolated_env, fake_embed)
    fake_generate_json.append({"intent": "open", "query": "vague query"})

    response = handle_message("open the vague thing")

    assert response.open_path is None
    assert [h.path for h in response.search_results] == ["maybe.txt"]  # offered, not opened
    assert "nothing opened" in response.message
    assert context_memory.open_counts() == {}


# --------------------------------------------------- stale context vs. a real new topic
# Reproduced live 2026-09-23: "find my invoices" then "what's related to my resume" answered
# about an invoice file, because the model set refers_to_previous=True for the second message
# even though "resume" is a real, independent, confidently-matched topic. A confident direct
# match on the extracted query must always win over that flag; the flag is a last resort only.


@pytest.fixture
def invoice_and_resume_vault(invoice_vault, fake_embed):
    vault = invoice_vault
    content = "resume with work experience"
    (vault / "resume.txt").write_text(content, encoding="utf-8")
    fake_embed[content] = [0.0, 0.0, 1.0, 0.0]  # orthogonal to the invoice cluster
    fake_embed["resume"] = [0.0, 0.0, 1.0, 0.0]
    index_vault(vault)
    return vault


def test_related_prefers_a_confident_match_over_a_stale_context_reference(
    invoice_and_resume_vault, fake_generate_json
):
    knowledge_graph.rebuild()
    _search_first(fake_generate_json)  # shows a.txt, b.txt, c.txt (invoices)

    # The model wrongly flags this as a follow-up, exactly as observed live.
    fake_generate_json.append({"intent": "related", "query": "resume", "refers_to_previous": True})
    response = handle_message("what's related to my resume", session_id="s")

    assert response.intent == "related"
    assert "resume.txt" in response.message  # correctly targeted, whether or not it has links
    assert "invoice" not in response.message.lower()


def test_open_prefers_a_confident_match_over_a_stale_context_reference(
    invoice_and_resume_vault, fake_generate_json
):
    _search_first(fake_generate_json)  # shows a.txt, b.txt, c.txt (invoices)

    fake_generate_json.append({"intent": "open", "query": "resume", "refers_to_previous": True})
    response = handle_message("open my resume", session_id="s")

    assert response.open_path is not None
    assert response.open_path.endswith("resume.txt")


def test_related_falls_back_to_context_when_the_query_alone_is_not_confident(
    invoice_and_resume_vault, fake_embed, fake_generate_json
):
    knowledge_graph.rebuild()
    _search_first(fake_generate_json)  # shows a.txt, b.txt, c.txt; a.txt becomes "the topic"

    # A phrasing the deterministic rules do not cover, and one that on its own matches nothing -
    # only here should the model's refers_to_previous flag be allowed to decide.
    fake_embed["the earlier thing"] = [0.001, 0.002, 0.003, 0.004]
    fake_generate_json.append(
        {"intent": "related", "query": "the earlier thing", "refers_to_previous": True}
    )
    response = handle_message("what about the earlier thing", session_id="s")

    assert response.intent == "related"
    assert "related to a.txt" in response.message
