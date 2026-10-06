"""Large-scale benchmark: indexing, search latency, graph build and retrieval quality.

Generates a synthetic vault of N files across 12 topics, then measures the real pipeline on it
(real Ollama embeddings, real ChromaDB, real SQLite). The bench vault lives under
backend/data/bench/ and never touches demo-vault/ or the real app data.

Retrieval quality is measured against the topic each generated file was written about. That is
a synthetic label, so precision here is a sanity check on separation between topics, not a claim
about real personal files.

Usage (from backend/):
    ./.venv/Scripts/python.exe scripts/bench_scale.py 500 2000

Writes data/bench/results.json (one entry per size, appended/replaced by size).
"""

import json
import os
import random
import statistics
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
BENCH = BACKEND / "data" / "bench"

TOPICS = {
    "invoices": (
        ["Invoice for {vendor} covering {service}.", "Amount due INR {amt} payable within 15 days.",
         "Payment received from client for {service}.", "Billing summary and tax line items attached.",
         "Receipt number {num}, paid in full."],
        ["cloud hosting", "logo design", "data entry", "domain renewal", "software license"],
    ),
    "resumes": (
        ["Curriculum vitae with work experience in {skill}.", "Skills include {skill} and teamwork.",
         "Education: B.Tech, projects built with {skill}.", "Applying for a software internship role.",
         "Certifications and references available on request."],
        ["Python", "machine learning", "React", "databases", "cloud deployment"],
    ),
    "meeting_notes": (
        ["Team sync: discussed progress on {topic}.", "Action item: finish {topic} by Friday.",
         "Attendees agreed on the scope of {topic}.", "Next meeting to review {topic} results.",
         "Decided to postpone {topic} until feedback arrives."],
        ["the module plan", "the test plan", "the demo script", "the budget", "the deployment"],
    ),
    "recipes": (
        ["Ingredients: {food}, salt, oil and spices.", "Heat the pan, add {food}, and cook for ten minutes.",
         "Serve hot with rice or bread.", "Preparation time about thirty minutes for two people.",
         "Tip: adjust the spice level to taste."],
        ["paneer curry", "masala chai", "vegetable pulao", "lentil soup", "fried rice"],
    ),
    "travel": (
        ["Trip plan: visit {place} over the weekend.", "Book train tickets and a hotel near {place}.",
         "Pack camera, water bottles and a jacket for {place}.", "Itinerary: sightseeing, food and rest.",
         "Budget estimate for the trip to {place}."],
        ["Ajanta caves", "Goa beaches", "Shimla hills", "Mumbai city", "Hampi ruins"],
    ),
    "fitness": (
        ["Workout log: {ex} for thirty minutes.", "Ran {km} km this morning at an easy pace.",
         "Gym session focused on {ex} and stretching.", "Recovery day: walk and sleep well.",
         "Weekly goal: train four times and track progress."],
        ["squats and lunges", "bench press", "yoga flow", "intervals", "rowing"],
    ),
    "code": (
        ["def {fn}(items):\n    return [x for x in items if x]", "# {fn} helper for the data pipeline",
         "class {fn}Service:\n    def run(self):\n        pass", "import json\n# {fn} parses the config file",
         "TODO: refactor {fn} and add unit tests"],
        ["parse_records", "load_config", "build_index", "clean_text", "score_items"],
    ),
    "research": (
        ["Abstract: we study {thing} with a controlled experiment.", "Method: baseline versus proposed {thing}.",
         "Results show improved accuracy on {thing} benchmarks.", "Related work includes prior studies of {thing}.",
         "Limitations and future work for {thing} are discussed."],
        ["retrieval models", "graph embeddings", "speech recognition", "topic modelling", "image captioning"],
    ),
    "tax_finance": (
        ["Income tax return filing with deductions under {sec}.", "Bank statement summary for the quarter.",
         "Investment in {sec} mutual fund recorded.", "Advance tax payment due this quarter.",
         "Form {num} submitted for the financial year."],
        ["80C", "80D", "savings", "fixed deposits", "equity"],
    ),
    "medical": (
        ["Prescription: take {drug} twice daily after food.", "Doctor visit notes about {drug}.",
         "Lab report: blood test results within normal range.", "Vaccination record and appointment reminder.",
         "Follow up with the clinic in two weeks."],
        ["paracetamol", "vitamin D", "antibiotics", "iron tablets", "cough syrup"],
    ),
    "school": (
        ["Assignment: solve the problems on {subj}.", "Lab report for the {subj} practical.",
         "Exam syllabus covers units on {subj}.", "Viva questions prepared for {subj}.",
         "Submit the project report on {subj} by the deadline."],
        ["databases", "operating systems", "linear algebra", "networks", "compilers"],
    ),
    "shopping": (
        ["Shopping list: {item}, milk and bread.", "Order placed for {item} with free delivery.",
         "Return request for {item} filed online.", "Coupon code valid on {item} this week.",
         "Compare prices of {item} across stores."],
        ["headphones", "running shoes", "groceries", "a backpack", "a desk lamp"],
    ),
}

QUERY_PHRASES = {
    "invoices": ["invoice and payment from a client", "billing amount due", "receipt for services paid"],
    "resumes": ["my CV and work experience", "skills and education for a job application", "resume for internship"],
    "meeting_notes": ["team meeting action items", "notes from the sync call", "decisions made in the standup"],
    "recipes": ["how to cook a curry", "ingredients for a dish", "recipe for tea or soup"],
    "travel": ["trip plan and tickets", "weekend itinerary for sightseeing", "hotel and travel budget"],
    "fitness": ["workout and exercise log", "running and gym training", "fitness goals this week"],
    "code": ["python function that parses data", "helper code for the pipeline", "refactor the service class"],
    "research": ["abstract and experiment results", "related work on models", "limitations of the study"],
    "tax_finance": ["income tax deductions filing", "bank statement and investments", "advance tax payment"],
    "medical": ["doctor prescription and medicine", "blood test lab report", "clinic appointment follow up"],
    "school": ["assignment problems for a subject", "lab report and viva", "exam syllabus units"],
    "shopping": ["shopping list for groceries", "order delivery and returns", "compare prices online"],
}


def make_document(rng: random.Random, topic: str) -> str:
    sentences, fillers = TOPICS[topic]
    slots = {
        "vendor": rng.choice(["BlueRidge Cloud", "Sunrise Studio", "Nimbus Labs", "Orbit Data"]),
        "service": rng.choice(fillers),
        "amt": f"{rng.randint(500, 9000):,}",
        "num": str(rng.randint(1000, 9999)),
        "skill": rng.choice(fillers),
        "topic": rng.choice(fillers),
        "food": rng.choice(fillers),
        "place": rng.choice(fillers),
        "ex": rng.choice(fillers),
        "km": str(rng.randint(3, 15)),
        "fn": rng.choice(fillers),
        "thing": rng.choice(fillers),
        "sec": rng.choice(fillers),
        "drug": rng.choice(fillers),
        "subj": rng.choice(fillers),
        "item": rng.choice(fillers),
    }
    body = rng.sample(sentences, k=min(len(sentences), rng.randint(3, 5)))
    lines = [s.format(**slots) for s in body]
    if rng.random() < 0.5:  # distractor: one sentence from an unrelated topic
        other = rng.choice([t for t in TOPICS if t != topic])
        other_sentences, other_fillers = TOPICS[other]
        other_slots = {k: rng.choice(other_fillers) for k in slots}
        lines.append(rng.choice(other_sentences).format(**other_slots))
    return "\n".join(lines)


def generate_vault(vault: Path, n: int, seed: int = 7) -> list[tuple[str, str]]:
    """Writes n files (topic-labelled names). Returns [(relative_name, topic)]."""
    import shutil

    if vault.exists():
        shutil.rmtree(vault)
    vault.mkdir(parents=True)
    rng = random.Random(seed)
    topics = list(TOPICS)
    labels = []
    for i in range(n):
        topic = topics[i % len(topics)]
        name = f"{topic}_{i:05d}.txt"
        (vault / name).write_text(make_document(rng, topic), encoding="utf-8")
        labels.append((name, topic))
    return labels


def main() -> None:
    sizes = [int(a) for a in sys.argv[1:]] or [500]
    if len(sizes) > 1:
        # Settings are read once per process, so each size needs a fresh interpreter.
        import subprocess
        for n in sizes:
            subprocess.run([sys.executable, __file__, str(n)], check=True)
        return

    n = sizes[0]
    results_file = BENCH / "results.json"
    BENCH.mkdir(parents=True, exist_ok=True)
    results = json.loads(results_file.read_text()) if results_file.exists() else {}

    if True:
        root = BENCH / f"n{n}"
        if root.exists():
            import shutil
            shutil.rmtree(root)
        root.mkdir(parents=True)
        # Settings must point at the bench tree BEFORE app modules are imported.
        os.environ["DREAMOS_VAULT_DIR"] = str(root / "vault")
        os.environ["DREAMOS_DATA_DIR"] = str(root / "data")
        os.environ["DREAMOS_CHROMA_DIR"] = str(root / "data" / "chroma")
        os.environ["DREAMOS_SQLITE_PATH"] = str(root / "data" / "dreamos.db")
        sys.path.insert(0, str(BACKEND))

        from app import knowledge_graph, search, vectorstore
        from app.config import settings
        from app.db import init_db
        from app.indexer import index_vault

        assert str(settings.vault_dir).startswith(str(root)), "bench must not touch the real vault"
        labels = generate_vault(settings.vault_dir, n)
        topic_of = dict(labels)
        init_db()

        t0 = time.perf_counter()
        index_result = index_vault()
        index_seconds = time.perf_counter() - t0

        t0 = time.perf_counter()
        graph = knowledge_graph.rebuild()
        graph_seconds = time.perf_counter() - t0

        latencies, precisions = [], []
        for topic, phrases in QUERY_PHRASES.items():
            for phrase in phrases:
                t0 = time.perf_counter()
                hits = search.semantic_search(phrase, top_k=5)
                latencies.append((time.perf_counter() - t0) * 1000)
                if hits:
                    correct = sum(topic_of.get(h.name) == topic for h in hits[:5])
                    precisions.append(correct / min(5, len(hits)))
                else:
                    precisions.append(0.0)

        latencies.sort()
        p95 = latencies[int(0.95 * (len(latencies) - 1))]
        entry = {
            "files": n,
            "indexed": len(index_result.indexed),
            "index_seconds": round(index_seconds, 1),
            "index_files_per_second": round(n / index_seconds, 2),
            "graph_rebuild_seconds": round(graph_seconds, 2),
            "graph_edges": graph["edges"],
            "search_queries": len(latencies),
            "search_p50_ms": round(statistics.median(latencies), 1),
            "search_p95_ms": round(p95, 1),
            "precision_at_5": round(statistics.mean(precisions), 3),
            "precision_queries_with_no_result": sum(p == 0.0 for p in precisions),
        }
        results[str(n)] = entry
        print(json.dumps(entry, indent=2), flush=True)
        vectorstore.close_client()
        results_file.write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
