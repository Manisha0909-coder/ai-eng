"""Retrieval ablation: chunk-level hit@k / recall@k / context-precision@k
and MRR across four retrieval configs (vector-only, BM25-only, hybrid RRF,
hybrid+rerank), run per dev/test split, plus a chunk-size sensitivity
sweep. No LLM calls -- runs offline, deterministically, and fast.

Chunk-level, not just document-level: expected_chunk_substring lets this
check whether the *specific* chunk containing the answer was retrieved,
not just whether some chunk from the right document showed up. For
multi-hop questions (expected_chunk_substring is a list), hit@k requires
every required substring to appear among the top-k chunks; recall@k
reports the fraction found, for partial credit.

Usage:
    python -m eval.run_ablation
    python -m eval.run_ablation --split dev
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from rag import config
from rag.ingest import build_vectorstore
from rag.reranker import rerank
from rag.retrieval import Candidate, HybridRetriever

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
REPORT_PATH = EVAL_DIR / "ablation_report.json"

CONFIGS = ["vector_only", "bm25_only", "hybrid_rrf", "hybrid_rerank"]
K_SWEEP = [1, 3, 5]

# Chunk-size sensitivity check is scoped to hybrid_rerank only, at the
# production FINAL_TOP_K -- a full 4-config x k-sweep x chunk-size sweep
# would mean rebuilding (re-embedding) the whole index once per chunk
# size, times every other axis, which isn't worth the runtime for a demo
# this size. The real index is always restored afterward, even on error.
CHUNK_SIZE_SWEEP = [200, 400]


def _expected_sources(item: Dict[str, Any]) -> List[str]:
    es = item["expected_source"]
    return es if isinstance(es, list) else [es]


def _expected_substrings(item: Dict[str, Any]) -> List[str]:
    sub = item.get("expected_chunk_substring")
    if sub is None:
        return []
    return sub if isinstance(sub, list) else [sub]


def _rerank_config(question: str, rrf_candidates: List[Candidate]) -> List[Candidate]:
    shortlist = rrf_candidates[: config.RERANK_CANDIDATES]
    reranked = rerank(question, shortlist)
    return [c for c, score in reranked if score > config.RERANK_SCORE_THRESHOLD]


def _retrieve_all_configs(retriever: HybridRetriever, question: str) -> Dict[str, List[Candidate]]:
    fused = retriever.retrieve(question)  # already sorted by fused_score, desc

    vector_only = sorted(
        (c for c in fused if c.vector_rank is not None), key=lambda c: c.vector_rank
    )
    bm25_only = sorted((c for c in fused if c.bm25_rank is not None), key=lambda c: c.bm25_rank)

    return {
        "vector_only": vector_only,
        "bm25_only": bm25_only,
        "hybrid_rrf": fused,
        "hybrid_rerank": _rerank_config(question, fused),
    }


def _reciprocal_rank(candidates: List[Candidate], expected_sources: List[str]) -> float:
    for rank, c in enumerate(candidates, start=1):
        if c.source in expected_sources:
            return 1.0 / rank
    return 0.0


def _chunk_level_metrics(
    candidates: List[Candidate],
    k: int,
    expected_sources: List[str],
    expected_substrings: List[str],
):
    """Returns (hit, recall, context_precision) for the top-k candidates.

    hit: every expected substring found among the top-k chunks' text (or,
         if no substring is given, any top-k chunk is from an expected
         source document -- a document-level fallback).
    recall: fraction of expected substrings found (1.0/0.0 fallback when
         there's no substring list, matching `hit`).
    context_precision: fraction of the top-k chunks that come from an
         expected source document -- a cheap proxy for "how much of what
         we handed the LLM was actually relevant."
    """

    top_k = candidates[:k]
    texts = [c.text for c in top_k]

    if expected_substrings:
        found = [any(sub in t for t in texts) for sub in expected_substrings]
        hit = all(found)
        recall = sum(found) / len(found)
    else:
        hit = any(c.source in expected_sources for c in top_k)
        recall = 1.0 if hit else 0.0

    relevant_in_top_k = sum(1 for c in top_k if c.source in expected_sources)
    context_precision = relevant_in_top_k / k if k else 0.0

    return hit, recall, context_precision


def _answerable_items(dataset: List[Dict[str, Any]], split: Optional[str]) -> List[Dict[str, Any]]:
    return [
        item
        for item in dataset
        if item["answerable"] and (split is None or item.get("split") == split)
    ]


def run(dataset: List[Dict[str, Any]], split: Optional[str] = None) -> Dict[str, Any]:
    items = _answerable_items(dataset, split)
    retriever = HybridRetriever(build_vectorstore())

    results = {
        name: {
            "mrr_sum": 0.0,
            "by_k": {k: {"hits": 0, "recall_sum": 0.0, "precision_sum": 0.0} for k in K_SWEEP},
        }
        for name in CONFIGS
    }

    for item in items:
        per_config = _retrieve_all_configs(retriever, item["question"])
        expected_sources = _expected_sources(item)
        expected_substrings = _expected_substrings(item)

        for name in CONFIGS:
            candidates = per_config[name]
            results[name]["mrr_sum"] += _reciprocal_rank(candidates, expected_sources)

            for k in K_SWEEP:
                hit, recall, precision = _chunk_level_metrics(
                    candidates, k, expected_sources, expected_substrings
                )
                bucket = results[name]["by_k"][k]
                bucket["hits"] += int(hit)
                bucket["recall_sum"] += recall
                bucket["precision_sum"] += precision

    n = len(items)
    summary: Dict[str, Any] = {
        "n_answerable": n,
        "split": split or "all",
        "results": {},
    }

    for name in CONFIGS:
        summary["results"][name] = {
            "mrr": round(results[name]["mrr_sum"] / n, 3) if n else None,
            "by_k": {
                str(k): {
                    "hit_rate": round(bucket["hits"] / n, 3) if n else None,
                    "recall": round(bucket["recall_sum"] / n, 3) if n else None,
                    "context_precision": round(bucket["precision_sum"] / n, 3) if n else None,
                }
                for k, bucket in results[name]["by_k"].items()
            },
        }

    return summary


def run_chunk_size_sweep(
    dataset: List[Dict[str, Any]], split: Optional[str] = None
) -> Dict[int, Dict[str, Any]]:
    """hybrid_rerank only, at FINAL_TOP_K, across CHUNK_SIZE_SWEEP. Always
    restores the real CHUNK_SIZE and rebuilds the production index before
    returning, even if something raises partway through."""

    items = _answerable_items(dataset, split)
    original_chunk_size = config.CHUNK_SIZE
    sweep_results: Dict[int, Dict[str, Any]] = {}

    try:
        for chunk_size in CHUNK_SIZE_SWEEP:
            config.CHUNK_SIZE = chunk_size
            retriever = HybridRetriever(build_vectorstore(force=True))

            hits = 0
            rr_sum = 0.0
            for item in items:
                per_config = _retrieve_all_configs(retriever, item["question"])
                candidates = per_config["hybrid_rerank"]
                expected_sources = _expected_sources(item)
                expected_substrings = _expected_substrings(item)

                hit, _, _ = _chunk_level_metrics(
                    candidates,
                    config.FINAL_TOP_K,
                    expected_sources,
                    expected_substrings,
                )
                hits += int(hit)
                rr_sum += _reciprocal_rank(candidates, expected_sources)

            n = len(items)
            sweep_results[chunk_size] = {
                "hit_rate": round(hits / n, 3) if n else None,
                "mrr": round(rr_sum / n, 3) if n else None,
            }
    finally:
        config.CHUNK_SIZE = original_chunk_size
        build_vectorstore(force=True)

    return sweep_results


def print_report(title: str, summary: Dict[str, Any]) -> None:
    print(
        f"\n{'=' * 70}\n{title} ({summary['n_answerable']} answerable, split={summary['split']})\n{'=' * 70}"
    )
    for name, metrics in summary["results"].items():
        print(f"{name} -- MRR: {metrics['mrr']}")
        for k, by_k in metrics["by_k"].items():
            print(
                f"  k={k:<2} hit_rate={by_k['hit_rate']:>6}  recall={by_k['recall']:>6}  "
                f"context_precision={by_k['context_precision']:>6}"
            )
    print("=" * 70)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["dev", "test", "all"], default="all")
    args = parser.parse_args()

    dataset = json.loads(DATASET_PATH.read_text())

    report: Dict[str, Any] = {"by_split": {}, "chunk_size_sweep": {}}

    splits = ["dev", "test"] if args.split == "all" else [args.split]
    for split in splits:
        summary = run(dataset, split=split)
        print_report(f"RETRIEVAL ABLATION -- {split}", summary)
        report["by_split"][split] = summary

    sweep = run_chunk_size_sweep(dataset, split=None)
    print("\nChunk-size sensitivity (hybrid_rerank, all answerable examples):")
    for chunk_size, metrics in sweep.items():
        print(f"  CHUNK_SIZE={chunk_size}: hit_rate={metrics['hit_rate']} mrr={metrics['mrr']}")
    report["chunk_size_sweep"] = {str(k): v for k, v in sweep.items()}

    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(f"\nFull report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
