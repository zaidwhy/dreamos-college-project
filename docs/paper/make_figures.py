"""Draws the paper's figures (architecture, pipelines, follow-up flowchart, charts, UI composite)
into docs/paper/figs/. Numbers come from docs/benchmarks/*.json so figures cannot drift from the
tables. Run:  py -3.14 docs/paper/make_figures.py
"""
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = HERE / "figs"
OUT.mkdir(exist_ok=True)
BENCH = json.loads((REPO / "docs" / "benchmarks" / "scale_results.json").read_text())
BEFORE = json.loads((REPO / "docs" / "benchmarks" / "scale_results_before.json").read_text())
RETR = json.loads((REPO / "docs" / "benchmarks" / "retrieval_comparison.json").read_text())

plt.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 8,
    "axes.linewidth": 0.6,
    "figure.dpi": 100,
})

INK = "#1b1b1b"
BLUE, LBLUE = "#2b4c7e", "#dce6f4"
GREEN, LGREEN = "#2f6b3a", "#e0efe2"
AMBER, LAMBER = "#8a5a00", "#f7ecd2"
GREY, LGREY = "#555555", "#eeeeee"
RED = "#9c2b2b"


def box(ax, x, y, w, h, text, fc=LBLUE, ec=BLUE, fs=7.5, bold=False, lw=0.8, style="round,pad=0.02,rounding_size=0.06"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=style, fc=fc, ec=ec, lw=lw))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", color=INK, linespacing=1.15)


def arrow(ax, p0, p1, text=None, color=INK, rad=0.0, fs=6.5, dy=0.07, dx=0.0, ls="-"):
    ax.add_patch(FancyArrowPatch(p0, p1, arrowstyle="-|>", mutation_scale=7, lw=0.8, color=color,
                                 connectionstyle=f"arc3,rad={rad}", linestyle=ls, shrinkA=0, shrinkB=0))
    if text:
        ax.text((p0[0] + p1[0]) / 2 + dx, (p0[1] + p1[1]) / 2 + dy, text, ha="center", va="bottom", fontsize=fs, color=color)


def canvas(w, h):
    fig = plt.figure(figsize=(w, h))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.axis("off")
    return fig, ax


# ------------------------------------------------------------------ Fig 1: architecture
def fig_architecture():
    W, H = 7.0, 3.05
    fig, ax = canvas(W, H)
    # client
    ax.add_patch(FancyBboxPatch((0.1, 2.15), 6.8, 0.8, boxstyle="round,pad=0.02,rounding_size=0.06", fc="white", ec=GREY, lw=0.8, ls="--"))
    ax.text(0.2, 2.82, "Desktop client (Tauri 2 shell, React 19 + TypeScript)", fontsize=7, color=GREY, va="center")
    for i, t in enumerate(["Chat view", "Knowledge-graph view", "Workspaces view", "Privacy view"]):
        box(ax, 0.3 + i * 1.65, 2.25, 1.5, 0.38, t, fc=LGREY, ec=GREY, fs=7)
    # service
    ax.add_patch(FancyBboxPatch((0.1, 0.78), 4.55, 1.12, boxstyle="round,pad=0.02,rounding_size=0.06", fc="white", ec=BLUE, lw=1.0))
    ax.text(0.2, 1.78, "Local service (FastAPI, 127.0.0.1:8420)", fontsize=7, color=BLUE, va="center")
    mods = [("NL interface\n(intent routing)", 0), ("Semantic\nsearch", 1), ("AI file\norganizer", 2), ("Knowledge\ngraph", 3)]
    for t, i in mods:
        box(ax, 0.2 + i * 1.1, 1.2, 1.0, 0.44, t, fs=6.8)
    mods2 = [("Context\nmemory", 0), ("Workspace\nmanager", 1), ("Indexer", 2), ("Privacy\naudit", 3)]
    for t, i in mods2:
        box(ax, 0.2 + i * 1.1, 0.82, 1.0, 0.3, t, fs=6.2, fc=LGREEN, ec=GREEN)
    # runtime
    box(ax, 5.1, 0.78, 1.8, 1.12, "Local model runtime\n(Ollama)\nnomic-embed-text:\nembeddings\nllama3.2 3B:\nintent, summary, tags", fc=LAMBER, ec=AMBER, fs=6.8)
    # storage
    ax.add_patch(FancyBboxPatch((0.1, 0.05), 6.8, 0.5, boxstyle="round,pad=0.02,rounding_size=0.06", fc="white", ec=GREY, lw=0.8, ls="--"))
    box(ax, 0.3, 0.12, 2.0, 0.36, "SQLite: files, edges, turns,\nusage, workspaces", fc=LGREY, ec=GREY, fs=6.6)
    box(ax, 2.5, 0.12, 2.0, 0.36, "ChromaDB: chunk vectors", fc=LGREY, ec=GREY, fs=6.6)
    box(ax, 4.7, 0.12, 2.0, 0.36, "Sandboxed vault (files)", fc=LGREY, ec=GREY, fs=6.6)
    arrow(ax, (2.4, 2.15), (2.4, 1.9), "HTTP / JSON, loopback only", dx=1.05, dy=-0.03)
    arrow(ax, (4.65, 1.34), (5.1, 1.34), "")
    arrow(ax, (5.1, 1.18), (4.65, 1.18), "")
    arrow(ax, (2.4, 0.78), (2.4, 0.55))
    ax.text(5.8, 2.0, "every arrow stays on this machine", fontsize=6.3, color=GREY, ha="center")
    fig.savefig(OUT / "fig_architecture.png", dpi=300)
    plt.close(fig)


# ------------------------------------------------------------------ Fig 2: pipelines
def fig_pipelines():
    W, H = 7.0, 1.95
    fig, ax = canvas(W, H)
    ax.text(0.05, 1.82, "(a) Indexing pipeline (runs when files change)", fontsize=7.5, fontweight="bold", va="center")
    steps = ["Vault\nfiles", "Extract\ntext", "Chunk", "Embed\n(nomic-embed-text)", "Store vectors\n(ChromaDB)", "Summarise, tag\n(llama3.2)", "Rebuild\ngraph"]
    xs = [0.05 + i * 0.99 for i in range(7)]
    for i, (t, x) in enumerate(zip(steps, xs)):
        box(ax, x, 1.12, 0.82, 0.52, t, fs=6.3, fc=LBLUE if i < 5 else LGREEN, ec=BLUE if i < 5 else GREEN)
        if i < 6:
            arrow(ax, (x + 0.82, 1.38), (x + 0.99, 1.38))
    ax.text(0.05, 0.85, "(b) Query pipeline (every chat message)", fontsize=7.5, fontweight="bold", va="center")
    q = ["Message +\nsession id", "Intent\nclassifier", "Reference\nresolution", "Route"]
    qx = [0.05, 1.05, 2.05, 3.05]
    for i, (t, x) in enumerate(zip(q, qx)):
        box(ax, x, 0.08, 0.82, 0.5, t, fs=6.3, fc=LBLUE if i != 2 else LAMBER, ec=BLUE if i != 2 else AMBER)
        if i < 3:
            arrow(ax, (x + 0.82, 0.33), (x + 1.0, 0.33))
    arrow(ax, (3.87, 0.33), (4.12, 0.33))
    acts = ["search", "open", "related", "workspace", "organize"]
    for i, a in enumerate(acts):
        box(ax, 4.12 + i * 0.58, 0.08, 0.5, 0.5, a, fs=5.8, fc=LGREEN, ec=GREEN)
    ax.text(5.5, 0.7, "action cards in the client; moves are reversible", fontsize=6.2, color=GREY, ha="center")
    fig.savefig(OUT / "fig_pipelines.png", dpi=300)
    plt.close(fig)


# ------------------------------------------------------------------ Fig 3: follow-up flowchart
def fig_followup():
    W, H = 3.4, 2.95
    fig, ax = canvas(W, H)
    cx, rx = 1.1, 2.8
    bw, bh = 1.56, 0.36
    ys = [2.62, 2.1, 1.58, 1.06, 0.54, 0.02]  # top-down box bottoms
    box(ax, cx - 0.62, ys[0], 1.24, 0.28, "User message", fs=7, fc=LGREY, ec=GREY)
    box(ax, cx - bw / 2, ys[1], bw, bh, "Classifier extracts intent,\ntopic, model flag", fs=6.4)
    box(ax, cx - bw / 2, ys[2], bw, bh, "Rule: ordinal (\"second one\")\nor bare \"it\" / \"that\"?", fs=6.4, fc=LAMBER, ec=AMBER)
    box(ax, cx - bw / 2, ys[3], bw, bh, "Direct search on topic:\nbest score >= 0.55?", fs=6.4, fc=LAMBER, ec=AMBER)
    box(ax, cx - bw / 2, ys[4], bw, bh, "Model flag says\n\"refers to previous\"?", fs=6.4, fc=LAMBER, ec=AMBER)
    box(ax, cx - bw / 2, ys[5], bw, bh, "Show candidates, labelled\nlow confidence", fs=6.2, fc=LGREY, ec=GREY)
    arrow(ax, (cx, ys[0]), (cx, ys[1] + bh))
    arrow(ax, (cx, ys[1]), (cx, ys[2] + bh))
    for i in (2, 3, 4):
        arrow(ax, (cx, ys[i]), (cx, ys[i + 1] + bh), "no", dx=0.14, dy=-0.02)
    outs = {2: "Resolve to\nprevious result\n(rule)", 3: "Answer from\nsearch", 4: "Resolve to\nprevious result\n(last resort)"}
    for i, t in outs.items():
        box(ax, rx - 0.45, ys[i], 0.9, bh, t, fs=5.8, fc=LGREEN, ec=GREEN)
        arrow(ax, (cx + bw / 2, ys[i] + bh / 2), (rx - 0.45, ys[i] + bh / 2), "yes", dy=0.01, fs=6)
    fig.savefig(OUT / "fig_followup.png", dpi=300)
    plt.close(fig)


# ------------------------------------------------------------------ Fig 4: UI composite
def fig_ui():
    shots = [("ui-chat.png", "(a) Chat: related files with reasons"),
             ("ui-knowledge-graph.png", "(b) Knowledge graph"),
             ("ui-workspaces.png", "(c) Workspaces and suggestions")]
    imgs = [Image.open(REPO / "docs" / "screenshots" / f).convert("RGB") for f, _ in shots]
    W = 7.0
    fig, axes = plt.subplots(1, 3, figsize=(W, 1.95), gridspec_kw={"wspace": 0.04, "left": 0.005, "right": 0.995, "top": 0.88, "bottom": 0.005})
    for ax, im, (_, t) in zip(axes, imgs, shots):
        ax.imshow(im)
        ax.set_xticks([]); ax.set_yticks([])
        for s in ax.spines.values():
            s.set_linewidth(0.5); s.set_color(GREY)
        ax.set_title(t, fontsize=7, pad=2)
    fig.savefig(OUT / "fig_ui.png", dpi=300)
    plt.close(fig)


# ------------------------------------------------------------------ Fig 5: retrieval chart
def wilson(k, n, z=1.96):
    if n == 0:
        return 0.0, 0.0
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def fig_retrieval():
    names = [("filename", "Filename\nmatch"), ("keyword", "BM25\ncontent"), ("embedding", "Embedding\nonly"), ("dreamos", "DreamOS")]
    groups = [("sharing_words", f"Query shares words with target (n={RETR['queries_sharing_words']})", "#2b4c7e"),
              ("no_shared_words", f"No shared words (n={RETR['queries_no_shared_words']})", "#c47f17")]
    fig, ax = plt.subplots(figsize=(3.4, 2.05))
    fig.subplots_adjust(left=0.13, right=0.99, top=0.97, bottom=0.23)
    bw = 0.38
    for gi, (key, label, col) in enumerate(groups):
        n = RETR["queries_sharing_words"] if key == "sharing_words" else RETR["queries_no_shared_words"]
        vals, lo, hi = [], [], []
        for sk, _ in names:
            v = RETR[key][sk]["hit_at_1"]
            k = round(v * n)
            l, h = wilson(k, n)
            vals.append(v); lo.append(v - l); hi.append(h - v)
        xs = [i + (gi - 0.5) * bw for i in range(len(names))]
        ax.bar(xs, vals, bw, color=col, label=label, edgecolor="black", linewidth=0.4)
        ax.errorbar(xs, vals, yerr=[lo, hi], fmt="none", ecolor="black", elinewidth=0.6, capsize=1.5)
        for x, v in zip(xs, vals):
            ax.text(x, min(1.0, v + hi[xs.index(x)]) + 0.02, f"{v:.2f}", ha="center", fontsize=6)
    ax.set_xticks(range(len(names)))
    ax.set_xticklabels([n for _, n in names], fontsize=6.8)
    ax.set_ylim(0, 1.3)
    ax.set_ylabel("Hit@1 (with 95% Wilson interval)", fontsize=7)
    ax.tick_params(axis="y", labelsize=7)
    ax.legend(fontsize=6, loc="upper left", frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.savefig(OUT / "fig_retrieval.png", dpi=300)
    plt.close(fig)


# ------------------------------------------------------------------ Fig 6: scale charts
def fig_scale():
    fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.1))
    fig.subplots_adjust(left=0.065, right=0.995, top=0.88, bottom=0.2, wspace=0.34)
    sizes = [500, 2000, 5000]
    # (a) graph rebuild, log scale, three stages
    ax = axes[0]
    mid = json.loads((REPO / "docs" / "benchmarks" / "scale_results_vectorised_only.json").read_text())
    b = [BEFORE.get(str(s), {}).get("graph_rebuild_seconds") for s in sizes]
    m = [mid[str(s)]["graph_rebuild_seconds"] for s in sizes]
    a = [BENCH[str(s)]["graph_rebuild_seconds"] for s in sizes]
    w = 0.27
    xs = range(3)
    ax.bar([x - w for x in xs], [v or 0 for v in b], w, color="#c47f17", edgecolor="black", linewidth=0.4, label="pairwise loop")
    ax.bar([x for x in xs], m, w, color="#8fa9cf", edgecolor="black", linewidth=0.4, label="vectorised similarity")
    ax.bar([x + w for x in xs], a, w, color="#2b4c7e", edgecolor="black", linewidth=0.4, label="final")
    ax.set_yscale("log")
    ax.set_ylim(0.2, 20000)
    for x, v in zip(xs, b):
        if v:
            ax.text(x - w, v * 1.15, f"{v:.0f}", ha="center", fontsize=5.5)
        else:
            ax.text(x - w, 1.0, "n/m", ha="center", fontsize=5.5, color=RED)
    for x, v in zip(xs, m):
        ax.text(x, v * 1.15, f"{v:.1f}" if v < 10 else f"{v:.0f}", ha="center", fontsize=5.5)
    for x, v in zip(xs, a):
        ax.text(x + w, v * 1.15, f"{v:.1f}" if v < 10 else f"{v:.0f}", ha="center", fontsize=5.5)
    ax.set_xticks(list(xs)); ax.set_xticklabels(["500", "2,000", "5,000"], fontsize=7)
    ax.set_xlabel("Files", fontsize=7); ax.set_ylabel("Graph rebuild (s, log scale)", fontsize=7)
    ax.tick_params(axis="y", labelsize=6.5)
    ax.legend(fontsize=5.5, frameon=False, loc="upper left")
    ax.set_title("(a) Knowledge-graph rebuild", fontsize=7.5)
    # (b) indexing throughput
    ax = axes[1]
    bi = [BEFORE.get(str(s), {}).get("index_files_per_second") for s in sizes]
    ai = [BENCH[str(s)]["index_files_per_second"] for s in sizes]
    ax.bar([x - w / 2 for x in xs], [v or 0 for v in bi], w, color="#c47f17", edgecolor="black", linewidth=0.4)
    ax.bar([x + w / 2 for x in xs], ai, w, color="#2b4c7e", edgecolor="black", linewidth=0.4)
    for x, v in zip(xs, bi):
        ax.text(x - w / 2, (v or 0) + 0.4, f"{v:.1f}" if v else "n/m", ha="center", fontsize=6, color="black" if v else RED)
    for x, v in zip(xs, ai):
        ax.text(x + w / 2, v + 0.4, f"{v:.1f}", ha="center", fontsize=6)
    ax.set_xticks(list(xs)); ax.set_xticklabels(["500", "2,000", "5,000"], fontsize=7)
    ax.set_xlabel("Files", fontsize=7); ax.set_ylabel("Indexing throughput (files/s)", fontsize=7)
    ax.set_ylim(0, 24); ax.tick_params(axis="y", labelsize=6.5)
    ax.set_title("(b) Indexing throughput", fontsize=7.5)
    # (c) search latency
    ax = axes[2]
    p50 = [BENCH[str(s)]["search_p50_ms"] for s in sizes]
    p95 = [BENCH[str(s)]["search_p95_ms"] for s in sizes]
    ax.plot(sizes, p50, "o-", color="#2b4c7e", lw=1, ms=3.5, label="p50")
    ax.plot(sizes, p95, "s--", color="#c47f17", lw=1, ms=3.5, label="p95")
    for s, v in zip(sizes, p50):
        ax.text(s, v - 22, f"{v:.0f}", ha="center", fontsize=6)
    for s, v in zip(sizes, p95):
        ax.text(s, v + 9, f"{v:.0f}", ha="center", fontsize=6)
    ax.set_xlabel("Files", fontsize=7); ax.set_ylabel("Search latency (ms)", fontsize=7)
    ax.set_ylim(0, 290); ax.set_xlim(-150, 5650); ax.tick_params(labelsize=6.5)
    ax.legend(fontsize=6, frameon=False, loc="upper left")
    ax.set_title("(c) Search latency", fontsize=7.5)
    for a_ in axes:
        for s in ("top", "right"):
            a_.spines[s].set_visible(False)
    fig.savefig(OUT / "fig_scale.png", dpi=300)
    plt.close(fig)


if __name__ == "__main__":
    fig_architecture()
    fig_pipelines()
    fig_followup()
    fig_ui()
    fig_retrieval()
    fig_scale()
    print("figures written to", OUT)
