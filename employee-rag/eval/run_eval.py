"""Eval harness: runs the RAG pipeline over eval/golden_dataset.json and
scores retrieval and generation quality.

Usage:
    python -m eval.run_eval                  # run + print + write report.json
    python -m eval.run_eval --fail-under 0.9  # exit 1 if accuracy drops below 0.9 (for CI)

Metrics (all computed with cheap, deterministic string checks -- no paid
LLM-judge call required, so this runs the same way in CI as on a laptop):

  retrieval_hit_rate   - for answerable questions, did the expected source
                          document make it into the final reranked context?
  answer_accuracy      - for answerable questions, does the generated answer
                          contain every required substring (e.g. the actual
                          number from the policy)?
  abstention_accuracy  - for unanswerable (out-of-scope) questions, did the
                          system correctly refuse instead of hallucinating?
  overall_accuracy     - answer_accuracy and abstention_accuracy combined
                          over the whole set.
"""

import argparse
import json
import statistics
import sys
from pathlib import Path

from rag.pipeline import NO_ANSWER, get_pipeline

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
REPORT_PATH = EVAL_DIR / "report.json"


def _abstained(answer: str) -> bool:
    return "don't have enough information" in answer.lower()


def _contains_all(answer: str, must_contain) -> bool:
    lower = answer.lower()
    return all(term.lower() in lower for term in must_contain)


def run(dataset) -> dict:
    pipeline = get_pipeline()
    results = []

    for item in dataset:
        result = pipeline.answer(item["question"])
        sources_hit = [s["source"] for s in result["sources"]]

        if item["answerable"]:
            retrieval_hit = item["expected_source"] in sources_hit
            correct = _contains_all(result["answer"], item["answer_must_contain"])
        else:
            retrieval_hit = None
            correct = _abstained(result["answer"])

        results.append({
            "id": item["id"],
            "question": item["question"],
            "category": item["category"],
            "answerable": item["answerable"],
            "expected_source": item["expected_source"],
            "retrieved_sources": sources_hit,
            "retrieval_hit": retrieval_hit,
            "answer": result["answer"],
            "correct": correct,
            "timings_ms": result["timings_ms"],
        })

    return summarize(results)


def summarize(results) -> dict:
    answerable = [r for r in results if r["answerable"]]
    unanswerable = [r for r in results if not r["answerable"]]

    retrieval_hit_rate = (
        sum(1 for r in answerable if r["retrieval_hit"]) / len(answerable)
        if answerable else None
    )
    answer_accuracy = (
        sum(1 for r in answerable if r["correct"]) / len(answerable)
        if answerable else None
    )
    abstention_accuracy = (
        sum(1 for r in unanswerable if r["correct"]) / len(unanswerable)
        if unanswerable else None
    )
    overall_accuracy = sum(1 for r in results if r["correct"]) / len(results)

    total_latencies = [r["timings_ms"]["total"] for r in results]

    by_category = {}
    for r in results:
        by_category.setdefault(r["category"], []).append(r["correct"])

    category_accuracy = {
        cat: sum(1 for c in flags if c) / len(flags)
        for cat, flags in by_category.items()
    }

    return {
        "n_examples": len(results),
        "retrieval_hit_rate": retrieval_hit_rate,
        "answer_accuracy": answer_accuracy,
        "abstention_accuracy": abstention_accuracy,
        "overall_accuracy": overall_accuracy,
        "avg_latency_ms": round(statistics.mean(total_latencies), 1),
        "p95_latency_ms": round(
            statistics.quantiles(total_latencies, n=20)[18]
            if len(total_latencies) >= 20 else max(total_latencies),
            1,
        ),
        "category_accuracy": category_accuracy,
        "results": results,
    }


def print_report(summary: dict) -> None:
    print(f"\n{'='*70}\nEVAL REPORT ({summary['n_examples']} examples)\n{'='*70}")

    for r in summary["results"]:
        mark = "PASS" if r["correct"] else "FAIL"
        hit = "" if r["retrieval_hit"] is None else (" [retrieval-hit]" if r["retrieval_hit"] else " [retrieval-miss]")
        print(f"[{mark}]{hit} {r['id']:16s} {r['question']}")
        if not r["correct"]:
            print(f"         -> got: {r['answer']!r}")

    print(f"\n{'-'*70}")
    print(f"Retrieval hit rate   : {_fmt_pct(summary['retrieval_hit_rate'])}")
    print(f"Answer accuracy      : {_fmt_pct(summary['answer_accuracy'])}")
    print(f"Abstention accuracy  : {_fmt_pct(summary['abstention_accuracy'])}")
    print(f"Overall accuracy     : {_fmt_pct(summary['overall_accuracy'])}")
    print(f"Avg / p95 latency    : {summary['avg_latency_ms']} ms / {summary['p95_latency_ms']} ms")
    print("\nBy category:")
    for cat, acc in sorted(summary["category_accuracy"].items()):
        print(f"  {cat:20s} {_fmt_pct(acc)}")
    print(f"{'='*70}\n")


def _fmt_pct(value) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fail-under",
        type=float,
        default=None,
        help="Exit with status 1 if overall_accuracy is below this threshold (e.g. 0.9). "
             "Useful as a CI quality gate.",
    )
    args = parser.parse_args()

    dataset = json.loads(DATASET_PATH.read_text())
    summary = run(dataset)

    print_report(summary)
    REPORT_PATH.write_text(json.dumps(summary, indent=2))
    print(f"Full report written to {REPORT_PATH}")

    if args.fail_under is not None and summary["overall_accuracy"] < args.fail_under:
        print(f"FAIL: overall_accuracy {summary['overall_accuracy']:.3f} < --fail-under {args.fail_under}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
