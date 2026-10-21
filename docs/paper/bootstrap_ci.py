"""Uncertainty on the retrieval comparison in docs/benchmarks/retrieval_comparison.json.

Reads the per-query ranks written by backend/scripts/eval_retrieval.py and reports, for each
system, the exact 95% Wilson interval on Hit@1, a seeded percentile bootstrap (10,000 resamples
of the 36 queries) on Hit@1 and MRR, paired bootstrap intervals on the Hit@1 difference between
DreamOS and each other system, and an exact McNemar (sign) test on the paired Hit@1 outcomes.
Pure Python, no third-party packages. Run from anywhere:

    python docs/paper/bootstrap_ci.py
"""
import json
import math
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
RETR = json.loads((HERE.parent / "benchmarks" / "retrieval_comparison.json").read_text(encoding="utf-8"))
SYSTEMS = ["filename", "keyword", "embedding", "dreamos"]
SEED = 0
B = 10_000


def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, c - h), min(1.0, c + h)


def pct(values, lo=2.5, hi=97.5):
    s = sorted(values)
    def at(q):
        i = (len(s) - 1) * q / 100
        f, c = math.floor(i), math.ceil(i)
        return s[f] + (s[c] - s[f]) * (i - f)
    return at(lo), at(hi)


def main() -> None:
    rows = RETR["per_query"]
    n = len(rows)
    hit1 = {s: [1.0 if r["ranks"][s] == 1 else 0.0 for r in rows] for s in SYSTEMS}
    rr = {s: [1.0 / r["ranks"][s] if r["ranks"][s] else 0.0 for r in rows] for s in SYSTEMS}
    rng = random.Random(SEED)
    idx = [[rng.randrange(n) for _ in range(n)] for _ in range(B)]

    out = {"queries": n, "resamples": B, "seed": SEED, "systems": {}, "paired": {}}
    print(f"n = {n} queries, {B} bootstrap resamples, seed {SEED}")
    for s in SYSTEMS:
        k = int(sum(hit1[s]))
        w = wilson(k, n)
        bh = pct([sum(hit1[s][i] for i in sample) / n for sample in idx])
        bm = pct([sum(rr[s][i] for i in sample) / n for sample in idx])
        out["systems"][s] = {"hit_at_1": k / n, "hits": k, "wilson95": w, "bootstrap95_hit_at_1": bh,
                             "mrr": sum(rr[s]) / n, "bootstrap95_mrr": bm}
        print(f"{s:10s} Hit@1 {k}/{n} = {k / n:.3f}  Wilson [{w[0]:.3f}, {w[1]:.3f}]  "
              f"bootstrap [{bh[0]:.3f}, {bh[1]:.3f}]  MRR {sum(rr[s]) / n:.3f} bootstrap [{bm[0]:.3f}, {bm[1]:.3f}]")
    for s in SYSTEMS[:-1]:
        diff = [hit1["dreamos"][i] - hit1[s][i] for i in range(n)]
        bd = pct([sum(diff[i] for i in sample) / n for sample in idx])
        win = sum(1 for d in diff if d > 0)
        lose = sum(1 for d in diff if d < 0)
        m = win + lose
        # exact two-sided McNemar on the discordant pairs
        p = min(1.0, 2 * sum(math.comb(m, j) for j in range(0, min(win, lose) + 1)) / 2 ** m) if m else 1.0
        out["paired"][f"dreamos_vs_{s}"] = {"mean_diff_hit_at_1": sum(diff) / n, "bootstrap95": bd,
                                           "dreamos_only_hits": win, f"{s}_only_hits": lose, "mcnemar_exact_p": p}
        print(f"dreamos - {s:9s} Hit@1 diff {sum(diff) / n:+.3f}  bootstrap [{bd[0]:+.3f}, {bd[1]:+.3f}]  "
              f"discordant {win} vs {lose}  exact McNemar p = {p:.2e}")
    (HERE.parent / "benchmarks" / "retrieval_uncertainty.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", HERE.parent / "benchmarks" / "retrieval_uncertainty.json")


if __name__ == "__main__":
    main()
