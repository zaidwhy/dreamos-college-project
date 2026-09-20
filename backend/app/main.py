from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import context_memory, knowledge_graph, nl_interface, organizer, search, workspace
from app.db import init_db
from app.indexer import index_vault
from app.ollama_client import OllamaError

app = FastAPI(title="DreamOS Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local desktop app only, no browser deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.exception_handler(OllamaError)
def ollama_error_handler(_request, exc: OllamaError):
    raise HTTPException(status_code=503, detail=str(exc))


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/index")
def run_index() -> dict:
    try:
        result = index_vault()
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "indexed": result.indexed,
        "skipped_unchanged": result.skipped_unchanged,
        "errors": result.errors,
        "graph_edges": result.graph_edges,
    }


class SearchRequest(BaseModel):
    query: str
    top_k: int | None = None


@app.post("/search")
def run_search(req: SearchRequest) -> dict:
    try:
        hits = search.semantic_search(req.query, top_k=req.top_k)
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"hits": [asdict(h) for h in hits]}


@app.get("/organize/preview")
def organize_preview() -> dict:
    return {"unorganized": organizer.preview_unorganized()}


class OrganizeSuggestRequest(BaseModel):
    path: str


@app.post("/organize/suggest")
def organize_suggest(req: OrganizeSuggestRequest) -> dict:
    try:
        suggestion = organizer.suggest_for_file(req.path)
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return asdict(suggestion)


class OrganizePathRequest(BaseModel):
    path: str


@app.post("/organize/apply")
def organize_apply(req: OrganizePathRequest) -> dict:
    try:
        new_path = organizer.apply_organization(req.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"new_path": new_path}


@app.post("/organize/revert")
def organize_revert(req: OrganizePathRequest) -> dict:
    try:
        original_path = organizer.revert_organization(req.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"original_path": original_path}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


def _check_session_id(session_id: str | None) -> None:
    if session_id is not None and not context_memory.valid_session_id(session_id):
        raise HTTPException(
            status_code=400,
            detail=f"session_id must be 1-{context_memory.MAX_SESSION_ID_LENGTH} characters",
        )


@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    _check_session_id(req.session_id)
    try:
        response = nl_interface.handle_message(req.message, session_id=req.session_id)
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return asdict(response)


@app.get("/sessions/{session_id}/history")
def session_history(session_id: str) -> dict:
    _check_session_id(session_id)
    return {"turns": [asdict(t) for t in context_memory.recent_turns(session_id)]}


@app.delete("/sessions/{session_id}")
def forget_session(session_id: str) -> dict:
    _check_session_id(session_id)
    return {"forgotten_turns": context_memory.clear_session(session_id)}


class OpenedRequest(BaseModel):
    path: str


@app.post("/usage/open")
def usage_open(req: OpenedRequest) -> dict:
    """The UI reports a file the user opened by clicking it (chat opens are recorded by /chat)."""
    context_memory.record_open(req.path)
    return {"recorded": req.path}


@app.get("/graph")
def graph() -> dict:
    return knowledge_graph.get_graph()


@app.post("/graph/rebuild")
def graph_rebuild() -> dict:
    return knowledge_graph.rebuild()


@app.get("/graph/related")
def graph_related(path: str, limit: int = 5) -> dict:
    return {"related": [asdict(r) for r in knowledge_graph.related_files(path, limit)]}


@app.get("/workspace")
def workspace_list() -> dict:
    return {"workspaces": workspace.list_workspaces()}


@app.get("/workspace/recommendations")
def workspace_recommendations() -> dict:
    return {"recommendations": [asdict(r) for r in workspace.recommend()]}


class WorkspaceCreateRequest(BaseModel):
    name: str
    paths: list[str]
    description: str | None = None


@app.post("/workspace")
def workspace_create(req: WorkspaceCreateRequest) -> dict:
    try:
        return workspace.create_workspace(req.name, req.paths, req.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/workspace/{workspace_id}")
def workspace_delete(workspace_id: int) -> dict:
    if not workspace.delete_workspace(workspace_id):
        raise HTTPException(status_code=404, detail=f"No workspace with id {workspace_id}")
    return {"deleted": workspace_id}


@app.post("/workspace/{workspace_id}/open")
def workspace_open(workspace_id: int) -> dict:
    paths = workspace.open_workspace(workspace_id)
    if paths is None:
        raise HTTPException(status_code=404, detail=f"No workspace with id {workspace_id}")
    return {"open_paths": paths}
