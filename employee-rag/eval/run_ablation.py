"""Retrieval ablation: how much do hybrid search and reranking actually buy us?

Compares four retrieval configurations against the golden dataset's answerable
questions -- vector-only, BM25-only, hybrid (RRF), and hybrid + cross-encoder
reranking -- using retrieval-stage metrics only (hit rate, MRR). No LLM calls
are made, so this runs offline, deterministically, and fast: it isolates the
retrieval design choice the README argues for, rather than re-measuring
end-to-end generation accuracy (already covered by eval/run_eval.py).

Usage:
    python -m eval.run_ablation
"""

import json
from pathlib import Path
from typing import List, Tuple

from rag import config
from rag.ingest import build_vectorstore
from rag.reranker import rerank
from rag.retrieval import Candidate, HybridRetriever

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
REPORT_PATH = EVAL_DIR / "ablation_report.json"

CONFIGS = ["vector_only", "bm25_only", "hybrid_rrf", "hybrid_rerank"]


def _top_sources(candidates: List[Candidate], top_k: int) -> List[str]:
    return [c.source for c in candidates[:top_k]]


def _rerank_config(question: str, rrf_candidates: List[Candidate]) -> List[Candidate]:
    """Mirrors rag/pipeline.py's answer(): rerank the RRF shortlist, drop
    anything below the relevance threshold, keep the final top-K."""

    shortlist = rrf_candidates[: config.RERANK_CANDIDATES]
    reranked = rerank(question, shortlist)
    relevant = [c for c, score in reranked if score > config.RERANK_SCORE_THRESHOLD]
    return relevant


def _retrieve_all_configs(retriever: HybridRetriever, question: str) -> dict:
    """One retrieve() call already carries vector_rank/bm25_rank/fused_score
    for every candidate -- derive all four configs from it."""

    fused = retriever.retrieve(question)  # already sorted by fused_score, desc

    vector_only = sorted(
        (c for c in fused if c.vector_rank is not None), key=lambda c: c.vector_rank
    )
    bm25_only = sorted(
        (c for c in fused if c.bm25_rank is not None), key=lambda c: c.bm25_rank
    )

    return {
        "vector_only": vector_only,
        "bm25_only": bm25_only,
        "hybrid_rrf": fused,
        "hybrid_rerank": _rerank_config(question, fused),
    }


def _reciprocal_rank(sources: List[str], expected_source: str) -> float:
    for rank, source in enumerate(sources, start=1):
        if source == expected_source:
            return 1.0 / rank
    return 0.0


def run(dataset) -> dict:
    retriever = HybridRetriever(build_vectorstore())
    answerable = [item for item in dataset if item["answerable"]]

    per_config = {name: {"hits": 0, "rr_sum": 0.0} for name in CONFIGS}

    for item in answerable:
        configs = _retrieve_all_configs(retriever, item["question"])

        for name in CONFIGS:
            sources = _top_sources(configs[name], config.FINAL_TOP_K)
            hit = item["expected_source"] in sources
            per_config[name]["hits"] += int(hit)
            per_config[name]["rr_sum"] += _reciprocal_rank(sources, item["expected_source"])

    n = len(answerable)
    return {
        "n_answerable": n,
        "results": {
            name: {
                "hit_rate": round(stats["hits"] / n, 3),
                "mrr": round(stats["rr_sum"] / n, 3),
            }
            for name, stats in per_config.items()
        },
    }


def print_report(summary: dict) -> None:
    print(f"\n{'='*60}\nRETRIEVAL ABLATION ({summary['n_answerable']} answerable questions)\n{'='*60}")
    print(f"{'Config':<18}{'Hit rate':>12}{'MRR':>12}")
    for name, metrics in summary["results"].items():
        print(f"{name:<18}{metrics['hit_rate']*100:>11.1f}%{metrics['mrr']:>12.3f}")
    print(f"{'='*60}\n")


def main() -> None:
    dataset = json.loads(DATASET_PATH.read_text())
    summary = run(dataset)

    print_report(summary)
    REPORT_PATH.write_text(json.dumps(summary, indent=2))
    print(f"Full report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
