import re
from dataclasses import asdict, dataclass, field, replace

from app import context_memory, knowledge_graph, organizer, search, workspace
from app.config import settings
from app.ollama_client import generate_json

INTENTS = ["search", "open", "related", "workspace", "organize", "other"]

SYSTEM_PROMPT = (
    "You route requests for a local file-management assistant. Reply with JSON only, exactly: "
    '{"intent": "search" | "open" | "related" | "workspace" | "organize" | "other", '
    '"query": "the file topic or workspace name from the message, empty string if none", '
    '"refers_to_previous": true | false}\n'
    "Intents:\n"
    "- search: the user wants to find, list, show or ask about files on a topic. "
    'Examples: "find my tax documents", "show me anything about the trip", "do I have notes on the budget".\n'
    "- open: the user wants ONE specific file launched right now. "
    'Examples: "open my passport scan", "pull up the lease".\n'
    "- related: the user wants files connected to, or similar to, one specific file. "
    'Examples: "what goes with the budget sheet", "files like my thesis draft".\n'
    "- workspace: the user asks for advice or suggestions about how to group, tidy or manage their files, "
    "asks about workspaces, or wants to open a named workspace. "
    'Examples: "what do you recommend for my files", "how should I group these", "show my workspaces", '
    '"open the thesis workspace".\n'
    "- organize: the user ORDERS the assistant to categorize, sort or tag their files. "
    'Examples: "organize everything", "sort these into folders". '
    "A question asking what to do or what is recommended is workspace, not organize.\n"
    '- other: greetings, thanks, or anything not about files. Examples: "hi", "what time is it".\n'
    "If earlier conversation is shown, set refers_to_previous to true only when the new message points back "
    'at files already shown ("open it", "the second one", "what\'s related to that"); otherwise false.'
)

_OPEN_VERB = re.compile(r"^\s*(please\s+)?(open|launch|start|view)\b", re.IGNORECASE)


@dataclass
class NLResponse:
    intent: str
    message: str
    search_results: list[search.SearchHit] = field(default_factory=list)
    organize_suggestions: list[dict] = field(default_factory=list)
    open_path: str | None = None
    related: list[dict] = field(default_factory=list)
    recommendations: list[dict] = field(default_factory=list)
    workspaces: list[dict] = field(default_factory=list)
    open_paths: list[str] = field(default_factory=list)


def handle_message(user_message: str, session_id: str | None = None) -> NLResponse:
    """Classifies one message and routes it. With a session_id the conversation is remembered,
    so follow-ups ("open it", "the second one") resolve against what was last shown.
    """
    prompt = user_message
    if session_id:
        context = context_memory.format_for_prompt(session_id)
        if context:
            prompt = f"{context}\n\nNew user message: {user_message}"

    classification = generate_json(prompt, system=SYSTEM_PROMPT)
    intent = classification.get("intent", "other")
    if intent not in INTENTS:
        intent = "other"
    query = classification.get("query") or user_message

    referenced = None
    weak_referenced = None
    if session_id:
        # A bare "open it" is unambiguous even if the model filed it under another intent.
        if _OPEN_VERB.match(user_message) and intent in ("search", "other"):
            if context_memory.resolve_reference(session_id, user_message):
                intent = "open"
        if intent in ("open", "related"):
            # `referenced` is rule-based only (ordinals, bare "it"/"that") - deterministic and
            # always trusted first. `weak_referenced` additionally accepts the model's own
            # refers_to_previous flag, which is unreliable for a message with real content of its
            # own: "what's related to my resume" got refers_to_previous=True (confirmed live,
            # 2026-09-23) purely because it echoes the "what's related to X" example in the
            # prompt, even though "resume" is a perfectly good search topic on its own. So the
            # weak signal is only consulted as a last resort, after a confident direct search on
            # `query` has already failed - see _open/_related.
            referenced = context_memory.resolve_reference(session_id, user_message)
            weak_referenced = context_memory.resolve_reference(
                session_id, user_message, bool(classification.get("refers_to_previous"))
            )

    response = _route(intent, query, referenced, weak_referenced)

    if session_id:
        context_memory.add_turn(session_id, "user", user_message, intent)
        context_memory.add_turn(
            session_id,
            "assistant",
            response.message,
            intent,
            [hit.path for hit in response.search_results],
        )
    return response


def _route(intent: str, query: str, referenced: str | None, weak_referenced: str | None = None) -> NLResponse:
    if intent == "search":
        hits = search.semantic_search(query)
        if not hits:
            return NLResponse(intent=intent, message=f"No files matched '{query}'.")
        if hits[0].similarity < settings.search_similarity_threshold:
            return NLResponse(
                intent=intent,
                message=f"No strong match for '{query}'. Closest files, low confidence:",
                search_results=hits,
            )
        return NLResponse(
            intent=intent,
            message=f"Found {len(hits)} file(s) matching '{query}'.",
            search_results=hits,
        )

    if intent == "open":
        return _open(query, referenced, weak_referenced)

    if intent == "related":
        return _related(query, referenced, weak_referenced)

    if intent == "workspace":
        return _workspace(query)

    if intent == "organize":
        unorganized = organizer.preview_unorganized()
        if not unorganized:
            return NLResponse(intent=intent, message="Every indexed file already has an organize suggestion.")

        suggestions = [
            organizer.suggest_for_file(item["path"]) for item in unorganized
        ]
        return NLResponse(
            intent=intent,
            message=(
                f"Generated organize suggestions for {len(suggestions)} file(s). "
                "Review and apply them individually - nothing has been moved yet."
            ),
            organize_suggestions=[s.__dict__ for s in suggestions],
        )

    return NLResponse(
        intent=intent,
        message=(
            "I can find files by meaning, open them, show what's related, suggest workspaces, "
            "or organize unsorted files. Try asking for one of those."
        ),
    )


def _open_response(hit: search.SearchHit, note: str = "") -> NLResponse:
    context_memory.record_open(hit.path)
    return NLResponse(
        intent="open",
        message=f"Opening {hit.name}{note}...",
        search_results=[hit],
        open_path=hit.abs_path,
    )


def _open(query: str, referenced: str | None, weak_referenced: str | None = None) -> NLResponse:
    if referenced:
        hit = search.hit_for_path(referenced)
        if hit:
            return _open_response(hit)

    hits = search.semantic_search(query, top_k=3)
    best = hits[0] if hits else None

    if not best or best.similarity < settings.search_similarity_threshold:
        # The query alone gave no confident answer - only now fall back to the model's guess
        # that this continues the previous topic (see the comment in handle_message).
        if weak_referenced:
            hit = search.hit_for_path(weak_referenced)
            if hit:
                return _open_response(hit)
        if not hits:
            return NLResponse(intent="open", message=f"No file found matching '{query}'.")
        return NLResponse(
            intent="open",
            message=f"Not sure which file you mean by '{query}'. Closest matches, nothing opened:",
            search_results=hits,
        )
    tied = [h for h in hits if best.similarity - h.similarity < settings.open_ambiguity_margin]
    if len(tied) > 1:
        # A close call. Files the user actually opens before are the best tie-breaker.
        preferred = context_memory.prefer_most_used(tied)
        if preferred is None:
            return NLResponse(
                intent="open",
                message=(
                    f"Found {len(hits)} files that could match '{query}' - too close to pick "
                    "automatically. Did you mean one of these?"
                ),
                search_results=hits,
            )
        return _open_response(preferred, " (the one you open most)")
    return _open_response(best)


def _related(query: str, referenced: str | None, weak_referenced: str | None = None) -> NLResponse:
    target = referenced
    if target is None:
        hits = search.semantic_search(query, top_k=1)
        if hits and hits[0].similarity >= settings.search_similarity_threshold:
            target = hits[0].path
        elif weak_referenced:
            # No confident direct answer for `query` itself - only now trust the model's guess
            # that this continues the previous topic (see the comment in handle_message).
            target = weak_referenced
        elif hits:
            target = hits[0].path
    source = search.hit_for_path(target) if target else None
    if source is None:
        return NLResponse(intent="related", message=f"I couldn't find a file matching '{query}' to look up.")

    related = knowledge_graph.related_files(source.path)
    if not related:
        return NLResponse(
            intent="related",
            message=f"{source.name} isn't linked to any other file in the knowledge graph.",
        )

    cards = []
    for r in related:
        hit = search.hit_for_path(r.path)
        if hit:
            cards.append(replace(hit, similarity=r.weight, snippet=hit.summary or ""))
    return NLResponse(
        intent="related",
        message=f"{len(cards)} file(s) related to {source.name}.",
        search_results=cards,
        related=[asdict(r) for r in related],
    )


def _workspace(query: str) -> NLResponse:
    match = workspace.find_workspace(query) if query else None
    if match:
        paths = workspace.open_workspace(match["id"]) or []
        if not paths:
            return NLResponse(intent="workspace", message=f"Workspace '{match['name']}' has no files left.")
        return NLResponse(
            intent="workspace",
            message=f"Opening workspace '{match['name']}' ({len(paths)} file(s))...",
            workspaces=[match],
            open_paths=paths,
        )

    recommendations = workspace.recommend()
    workspaces = workspace.list_workspaces()
    return NLResponse(
        intent="workspace",
        message=(
            f"You have {len(workspaces)} workspace(s) and {len(recommendations)} suggestion(s) "
            "based on how your files relate and how you use them."
        ),
        recommendations=[asdict(r) for r in recommendations],
        workspaces=workspaces,
    )
