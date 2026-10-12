"""Benchmarks the Chroma and pgvector backends against each other:
ingest/query latency, and the Stage 2 retrieval metrics (hit@3, MRR) from
eval/run_ablation.py's hybrid_rerank config, dev split. No LLM calls.

Requires docker-compose.pgvector.yml running for the pgvector half:
    docker compose -f docker-compose.pgvector.yml up -d
    python -m eval.benchmark_backends
"""

import json
import time
from pathlib import Path

from eval.run_ablation import (
    _answerable_items,
    _chunk_level_metrics,
    _expected_sources,
    _expected_substrings,
    _reciprocal_rank,
    _retrieve_all_configs,
)
from rag import config
from rag.ingest import build_vectorstore
from rag.retrieval import HybridRetriever

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
REPORT_PATH = EVAL_DIR / "backend_benchmark.json"


def _benchmark_backend(backend_name, items):
    config.VECTOR_BACKEND = backend_name

    t0 = time.perf_counter()
    store = build_vectorstore(force=True)
    ingest_ms = (time.perf_counter() - t0) * 1000

    retriever = HybridRetriever(store)

    query_latencies_ms = []
    hits = 0
    rr_sum = 0.0

    for item in items:
        t1 = time.perf_counter()
        per_config = _retrieve_all_configs(retriever, item["question"])
        query_latencies_ms.append((time.perf_counter() - t1) * 1000)

        candidates = per_config["hybrid_rerank"]
        expected_sources = _expected_sources(item)
        expected_substrings = _expected_substrings(item)
        hit, _, _ = _chunk_level_metrics(
            candidates, config.FINAL_TOP_K, expected_sources, expected_substrings
        )
        hits += int(hit)
        rr_sum += _reciprocal_rank(candidates, expected_sources)

    if hasattr(store, "count"):
        n_chunks = store.count()  # PgVectorStore
    else:
        n_chunks = store._collection.count()  # Chroma

    n = len(items)
    query_latencies_ms.sort()
    return {
        "n_chunks": n_chunks,
        "ingest_ms": round(ingest_ms, 1),
        "avg_query_ms": round(sum(query_latencies_ms) / n, 1) if n else None,
        "p95_query_ms": round(query_latencies_ms[int(n * 0.95)], 1) if n else None,
        "hit_at_3": round(hits / n, 3) if n else None,
        "mrr": round(rr_sum / n, 3) if n else None,
    }


def main() -> None:
    dataset = json.loads(DATASET_PATH.read_text())
    items = _answerable_items(dataset, split="dev")

    results = {}
    for backend in ["chroma", "pgvector"]:
        print(f"\nBenchmarking {backend} ({len(items)} dev-split answerable questions)...")
        try:
            results[backend] = _benchmark_backend(backend, items)
        except Exception as exc:
            results[backend] = {"error": str(exc)}
        print(json.dumps(results[backend], indent=2))

    REPORT_PATH.write_text(json.dumps(results, indent=2))
    print(f"\nFull report written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
