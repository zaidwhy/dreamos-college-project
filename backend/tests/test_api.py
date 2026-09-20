import pytest
from fastapi.testclient import TestClient

from app import context_memory
from app.indexer import index_vault
from app.main import app


@pytest.fixture
def client(isolated_env, fake_embed):
    vault = isolated_env
    vectors = {
        "a.txt": [1.0, 0.0, 0.0, 0.0],
        "b.txt": [0.98, 0.2, 0.0, 0.0],
        "c.txt": [0.0, 0.0, 1.0, 0.0],
    }
    for name, vector in vectors.items():
        (vault / name).write_text(f"body of {name}", encoding="utf-8")
        fake_embed[f"body of {name}"] = vector
    fake_embed["invoices"] = [1.0, 0.0, 0.0, 0.0]
    index_vault(vault)
    with TestClient(app) as test_client:
        yield test_client


def test_chat_response_carries_every_module_field(client, fake_generate_json):
    fake_generate_json.append({"intent": "search", "query": "invoices"})

    body = client.post("/chat", json={"message": "find invoices", "session_id": "s1"}).json()

    assert body["intent"] == "search"
    assert [h["path"] for h in body["search_results"]][:2] == ["a.txt", "b.txt"]
    for key in ("related", "recommendations", "workspaces", "open_paths", "open_path", "organize_suggestions"):
        assert key in body


@pytest.mark.parametrize("bad_id", ["", "x" * 101])
def test_chat_rejects_a_malformed_session_id(client, bad_id):
    response = client.post("/chat", json={"message": "hi", "session_id": bad_id})

    assert response.status_code == 400
    assert "session_id" in response.json()["detail"]


def test_session_history_round_trip_and_forget(client, fake_generate_json):
    fake_generate_json.append({"intent": "search", "query": "invoices"})
    client.post("/chat", json={"message": "find invoices", "session_id": "s1"})

    turns = client.get("/sessions/s1/history").json()["turns"]
    assert [t["role"] for t in turns] == ["user", "assistant"]
    assert turns[1]["paths"][:2] == ["a.txt", "b.txt"]

    assert client.delete("/sessions/s1").json() == {"forgotten_turns": 2}
    assert client.get("/sessions/s1/history").json() == {"turns": []}


def test_graph_endpoints(client):
    rebuilt = client.post("/graph/rebuild").json()
    graph = client.get("/graph").json()
    related = client.get("/graph/related", params={"path": "a.txt"}).json()["related"]

    assert rebuilt == {"nodes": 3, "edges": 1}
    assert {n["name"] for n in graph["nodes"]} == {"a.txt", "b.txt", "c.txt"}
    assert len(graph["edges"]) == 1
    assert [r["path"] for r in related] == ["b.txt"]
    assert client.get("/graph/related", params={"path": "nope.txt"}).json() == {"related": []}


def test_workspace_lifecycle(client):
    created = client.post("/workspace", json={"name": "Tax prep", "paths": ["a.txt", "b.txt"]})
    assert created.status_code == 200
    workspace_id = created.json()["id"]

    listed = client.get("/workspace").json()["workspaces"]
    assert [w["name"] for w in listed] == ["Tax prep"]

    opened = client.post(f"/workspace/{workspace_id}/open").json()
    assert len(opened["open_paths"]) == 2

    assert client.delete(f"/workspace/{workspace_id}").json() == {"deleted": workspace_id}
    assert client.get("/workspace").json() == {"workspaces": []}


def test_workspace_errors_are_reported_not_swallowed(client):
    client.post("/workspace", json={"name": "Tax prep", "paths": ["a.txt"]})

    duplicate = client.post("/workspace", json={"name": "Tax prep", "paths": ["b.txt"]})
    nothing = client.post("/workspace", json={"name": "Ghosts", "paths": ["nope.txt"]})

    assert duplicate.status_code == 400 and "already exists" in duplicate.json()["detail"]
    assert nothing.status_code == 400
    assert client.delete("/workspace/999").status_code == 404
    assert client.post("/workspace/999/open").status_code == 404


def test_recommendations_endpoint_returns_typed_suggestions(client):
    body = client.get("/workspace/recommendations").json()

    kinds = {r["kind"] for r in body["recommendations"]}
    assert "unorganized" in kinds  # nothing has been categorized yet
    unorganized = next(r for r in body["recommendations"] if r["kind"] == "unorganized")
    assert unorganized["action"] == "organize"


def test_a_click_open_reported_by_the_ui_counts_as_usage(client):
    client.post("/usage/open", json={"path": "a.txt"})
    client.post("/usage/open", json={"path": "a.txt"})
    client.post("/usage/open", json={"path": "not-a-file.txt"})  # unknown paths are ignored

    assert context_memory.open_counts() == {"a.txt": 2}
