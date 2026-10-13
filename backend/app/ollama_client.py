import json

import requests

from app.config import settings


class OllamaError(RuntimeError):
    pass


def model_status() -> dict:
    """Which of the configured models Ollama actually has, without running any inference.

    A demo-day failure that is cheap to prevent: the Ollama service is up but the model store is
    empty (it was once), so every request fails with a vague error. This asks `/api/tags` (what
    `ollama list` prints) and reports what is missing so the UI can say so before the first query.
    """
    wanted = [settings.embed_model, settings.llm_model]
    try:
        resp = requests.get(f"{settings.ollama_base_url}/api/tags", timeout=3)
        resp.raise_for_status()
        installed = [m.get("name", "") for m in resp.json().get("models", [])]
    except (requests.RequestException, ValueError):
        return {"reachable": False, "installed": [], "required": wanted, "missing": wanted}

    def has(model: str) -> bool:
        return any(name == model or name.startswith(f"{model}:") for name in installed)

    return {"reachable": True, "installed": installed, "required": wanted,
            "missing": [m for m in wanted if not has(m)]}


def embed(text: str) -> list[float]:
    try:
        resp = requests.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json={"model": settings.embed_model, "prompt": text},
            timeout=60,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise OllamaError(
            f"Could not reach Ollama at {settings.ollama_base_url} for embeddings. "
            "Is `ollama serve` / the Ollama app running?"
        ) from exc
    return resp.json()["embedding"]


def generate_json(prompt: str, system: str | None = None) -> dict:
    """Ask the local LLM for a response and parse it as JSON.

    Raises OllamaError if Ollama is unreachable or the model's output is not valid JSON -
    callers must handle this rather than silently falling back, since a silent fallback
    would hide real model/prompt regressions during the demo.
    """
    payload = {
        "model": settings.llm_model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "format": "json",
        # temperature 0: classification/tagging needs reproducible answers, not creative
        # variation - sampling randomness was previously flipping the same file between
        # categories across identical calls.
        "options": {"temperature": 0},
    }
    try:
        resp = requests.post(
            f"{settings.ollama_base_url}/api/generate",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise OllamaError(
            f"Could not reach Ollama at {settings.ollama_base_url} for generation. "
            "Is `ollama serve` / the Ollama app running?"
        ) from exc

    raw = resp.json()["response"]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise OllamaError(f"Model returned non-JSON output: {raw!r}") from exc
