"""Eval harness: runs the RAG pipeline over eval/golden_dataset.json and
scores retrieval and generation quality.

Usage:
    python -m eval.run_eval                          # full run, both splits
    python -m eval.run_eval --split dev               # dev split only
    python -m eval.run_eval --max-calls 40             # cap live LLM calls (default 40)
    python -m eval.run_eval --resume                   # pick up where a prior run left off
    python -m eval.run_eval --repeats 3                # 3 independent samples per item (variance)
    python -m eval.run_eval --judge                    # also run the (extra-cost) LLM-judge pass
    python -m eval.run_eval --fail-under 0.9            # exit 1 if overall accuracy drops below 90%

Metrics (deterministic string checks -- no paid LLM-judge call required
unless --judge is passed):

  retrieval_hit_rate   - for answerable questions, did the expected source
                          document make it into the final reranked context?
  answer_accuracy      - for answerable questions, does the generated answer
                          contain every required substring (e.g. the actual
                          number from the policy)? A required term can be a
                          plain string or a list of accepted phrasings.
  abstention_accuracy  - for unanswerable (out-of-scope) questions, did the
                          system correctly refuse instead of hallucinating?
  overall_accuracy     - answer_accuracy and abstention_accuracy combined
                          over the whole set.
  grounded_rate        - fraction of answers with no number/date that isn't
                          present in the retrieved context (eval/groundedness.py).

Run mechanics: every result is cached on disk (eval/cache.py), keyed by
(resolved model, question, repeat index) -- so re-running (after a
--max-calls stop, or while iterating on scoring logic) never re-spends
live LLM budget on an item it already has a real answer for. This is what
makes --resume work: there's no separate "resume state," resuming is just
"run again" -- cached items come back instantly, new items respect
--max-calls and the per-request pacing below.

A response that errors out (network/rate-limit) is recorded as "not
evaluated," not "wrong" -- accuracy metrics are computed over evaluated
results only, with excluded ids reported separately so a partial run
stays honest instead of understating real accuracy. A 429 (daily cap)
stops the run immediately rather than burning through remaining items
retrying into more 429s.
"""

import argparse
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from langfuse import get_client

from eval import cache
from rag import config
from rag.groundedness import is_grounded
from rag.pipeline import get_pipeline

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
REPORT_PATH = EVAL_DIR / "report.json"
REPORTS_DIR = EVAL_DIR / "reports"

# openrouter/free enforces a 20-requests-per-minute cap. A dataset of this size
# exceeds that run back-to-back, so pace requests to stay comfortably under it.
REQUEST_PACING_SECONDS = 3.5


def _abstained(answer: str) -> bool:
    return "don't have enough information" in answer.lower()


def _contains_all(answer: str, must_contain) -> bool:
    """Every entry in must_contain has to match. An entry can be a plain string
    (must appear verbatim) or a list of acceptable phrasings (any one matching
    is enough) -- e.g. ["twice", "two days", "2 days"] for a fact the model
    may phrase several equivalent ways. Still pure string matching, so the
    check stays deterministic."""

    lower = answer.lower()
    for term in must_contain:
        variants = term if isinstance(term, list) else [term]
        if not any(variant.lower() in lower for variant in variants):
            return False
    return True


def _is_rate_limit_error(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    return status == 429 or "429" in str(exc)


def _git_sha() -> str:
    import subprocess

    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=EVAL_DIR, text=True
        ).strip()
    except Exception:  # pragma: no cover - not in a git repo, or git unavailable
        return "unknown"


def _dataset_hash(dataset: List[Dict[str, Any]]) -> str:
    import hashlib

    return hashlib.sha256(
        json.dumps(dataset, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]


def _filter_split(dataset: List[Dict[str, Any]], split: str) -> List[Dict[str, Any]]:
    if split == "all":
        return dataset
    return [item for item in dataset if item.get("split") == split]


_rewrite_llm = None


def _get_rewrite_llm():
    """Lazy singleton, same reasoning as agent/graph.py's _get_rewrite_llm():
    no API key needed just to import this module."""

    global _rewrite_llm
    if _rewrite_llm is None:
        from langchain_openai import ChatOpenAI

        _rewrite_llm = ChatOpenAI(
            model=config.LLM_MODEL,
            base_url=config.LLM_BASE_URL,
            api_key=config.OPENROUTER_API_KEY,
            timeout=config.LLM_REQUEST_TIMEOUT_SECONDS,
        )
    return _rewrite_llm


def _run_one(
    pipeline, item: Dict[str, Any], repeat_index: int, rewrite: bool = False
) -> Dict[str, Any]:
    # "multi_turn" items carry a `history` field. rag/pipeline.py's answer()
    # takes a single question with no conversation context, so by default
    # (rewrite=False) these are scored against the bare follow-up question
    # alone -- which legitimately scores poorly (the question is often
    # ambiguous without its history). That's the honest "before" baseline
    # for Stage 4.4's query-rewriting work. With rewrite=True, the same
    # rag/rewrite.rewrite_query() the live agent uses is applied first --
    # one extra live call per multi-turn item, which is why this is a flag,
    # not the default (see run()'s call-accounting for this flag's cost).
    question = item["question"]
    rewrite_call_made = False

    if rewrite and item.get("history"):
        from rag.rewrite import rewrite_query

        question = rewrite_query(_get_rewrite_llm(), question, item["history"])
        rewrite_call_made = True

    result = pipeline.answer(question, source="eval")

    sources_hit = [s["source"] for s in result["sources"]]
    expected = item["expected_source"]
    expected_sources = expected if isinstance(expected, list) else [expected]

    if item["answerable"]:
        retrieval_hit = any(s in sources_hit for s in expected_sources)
        correct = _contains_all(result["answer"], item["answer_must_contain"])
        for forbidden in item.get("forbidden_substrings", []):
            if forbidden.lower() in result["answer"].lower():
                correct = False
    else:
        retrieval_hit = None
        correct = _abstained(result["answer"])

    context = "\n\n".join(s["text"] for s in result["sources"])
    grounded = is_grounded(result["answer"], context)

    return {
        "id": item["id"],
        "question": question,
        "category": item["category"],
        "answerable": item["answerable"],
        "expected_source": expected,
        "retrieved_sources": sources_hit,
        "retrieved_context": context,
        "retrieval_hit": retrieval_hit,
        "answer": result["answer"],
        "correct": correct,
        "grounded": grounded,
        "errored": False,
        "timings_ms": result["timings_ms"],
        "repeat_index": repeat_index,
        "rewrite_call_made": rewrite_call_made,
    }


def _apply_judge(
    results: List[Dict[str, Any]],
    calls_made: int,
    max_calls: int,
    stopped_on_rate_limit: bool,
) -> int:
    """Mutates each result in place with judge_faithful/judge_relevant/
    judge_reason, making one extra live call per result that doesn't
    already have a cached verdict. Shares the same max_calls budget and
    pacing as the main generation loop -- a --judge run can cost up to
    2x the calls of a plain run, which is exactly why it's off by default."""

    if stopped_on_rate_limit:
        return calls_made

    from langchain_openai import ChatOpenAI

    from eval.judge import judge_answer  # local import: only needed with --judge

    judge_llm = ChatOpenAI(
        model=config.LLM_MODEL,
        base_url=config.LLM_BASE_URL,
        api_key=config.OPENROUTER_API_KEY,
        timeout=config.LLM_REQUEST_TIMEOUT_SECONDS,
        temperature=0,
    )

    for result in results:
        if result["errored"] or "judge_faithful" in result:
            continue

        cache_key = f"judge:{result['id']}:{result['repeat_index']}"
        cached = cache.get(config.LLM_MODEL, cache_key)
        if cached is not None:
            result.update(cached)
            continue

        if calls_made >= max_calls:
            continue

        time.sleep(REQUEST_PACING_SECONDS)
        calls_made += 1

        try:
            context = result.get("retrieved_context", "")
            verdict = judge_answer(
                judge_llm, result["question"], context, result["answer"]
            )
        except Exception as exc:  # pragma: no cover - network/rate-limit errors
            print(f"WARNING: judge call for {result['id']} failed: {exc!r}")
            if _is_rate_limit_error(exc):
                print("Rate-limited (429) during judge pass -- stopping.")
                break
            continue

        judge_fields = {
            "judge_faithful": verdict.faithful,
            "judge_relevant": verdict.relevant,
            "judge_reason": verdict.reason,
        }
        result.update(judge_fields)
        cache.put(config.LLM_MODEL, cache_key, judge_fields)

    return calls_made


def run(
    dataset: List[Dict[str, Any]],
    split: str = "all",
    max_calls: int = 40,
    repeats: int = 1,
    judge: bool = False,
    rewrite: bool = False,
) -> Dict[str, Any]:
    pipeline = get_pipeline()
    items = _filter_split(dataset, split)

    results: List[Dict[str, Any]] = []
    calls_made = 0
    stopped_on_rate_limit = False
    skipped_due_to_max_calls: List[str] = []

    for item in items:
        # --rewrite applies only to items with history, and makes an extra
        # live call that --rewrite=False never would -- a separate cache
        # key so a cached "before" (bare question) result is never served
        # back for an "after" (rewrite=True) run of the same item, or vice
        # versa.
        cache_key = item["question"] + (
            "::rewrite" if rewrite and item.get("history") else ""
        )

        for repeat_index in range(repeats):
            cached = cache.get(config.LLM_MODEL, cache_key, repeat_index)

            if cached is not None:
                results.append(cached)
                continue

            if stopped_on_rate_limit:
                skipped_due_to_max_calls.append(item["id"])
                continue

            if calls_made >= max_calls:
                skipped_due_to_max_calls.append(item["id"])
                continue

            if calls_made > 0:
                time.sleep(REQUEST_PACING_SECONDS)
            calls_made += 1

            try:
                result = _run_one(pipeline, item, repeat_index, rewrite=rewrite)
                if result["rewrite_call_made"]:
                    # The rewrite itself was a second live call -- account
                    # for its budget/pacing too.
                    calls_made += 1
                    time.sleep(REQUEST_PACING_SECONDS)
            except Exception as exc:  # pragma: no cover - network/rate-limit errors
                print(f"WARNING: {item['id']} (repeat {repeat_index}) failed: {exc!r}")
                if _is_rate_limit_error(exc):
                    print(
                        "Rate-limited (429) -- stopping further live calls for this run."
                    )
                    stopped_on_rate_limit = True
                result = {
                    "id": item["id"],
                    "question": item["question"],
                    "category": item["category"],
                    "answerable": item["answerable"],
                    "expected_source": item["expected_source"],
                    "retrieved_sources": [],
                    "retrieved_context": "",
                    "retrieval_hit": False if item["answerable"] else None,
                    "answer": f"ERROR: {exc}",
                    "correct": False,
                    "grounded": True,
                    "errored": True,
                    "timings_ms": {
                        "retrieval": 0.0,
                        "rerank": 0.0,
                        "generation": 0.0,
                        "total": 0.0,
                    },
                    "repeat_index": repeat_index,
                    "rewrite_call_made": False,
                }

            if not result["errored"]:
                cache.put(config.LLM_MODEL, cache_key, result, repeat_index)
            results.append(result)

    if judge:
        calls_made = _apply_judge(results, calls_made, max_calls, stopped_on_rate_limit)

    return summarize(
        results, skipped_due_to_max_calls, calls_made, stopped_on_rate_limit
    )


def summarize(
    results: List[Dict[str, Any]],
    skipped_ids: List[str],
    calls_made: int,
    stopped_on_rate_limit: bool,
) -> Dict[str, Any]:
    evaluated = [r for r in results if not r["errored"]]
    errored_ids = [r["id"] for r in results if r["errored"]]

    answerable = [r for r in evaluated if r["answerable"]]
    unanswerable = [r for r in evaluated if not r["answerable"]]

    retrieval_hit_rate = (
        sum(1 for r in answerable if r["retrieval_hit"]) / len(answerable)
        if answerable
        else None
    )
    answer_accuracy = (
        sum(1 for r in answerable if r["correct"]) / len(answerable)
        if answerable
        else None
    )
    abstention_accuracy = (
        sum(1 for r in unanswerable if r["correct"]) / len(unanswerable)
        if unanswerable
        else None
    )
    overall_accuracy = (
        sum(1 for r in evaluated if r["correct"]) / len(evaluated)
        if evaluated
        else None
    )
    grounded_rate = (
        sum(1 for r in evaluated if r["grounded"]) / len(evaluated)
        if evaluated
        else None
    )

    judged = [r for r in evaluated if r.get("judge_faithful") is not None]
    judge_human_agreement = None
    if judged:
        # Agreement between the deterministic `correct` check and the
        # judge's faithfulness call -- not a ground-truth comparison (that
        # needs judge_calibration.json hand-labeled first), just how often
        # the two scoring methods land on the same verdict.
        judge_human_agreement = round(
            sum(1 for r in judged if r["correct"] == r["judge_faithful"]) / len(judged),
            3,
        )

    total_latencies = [r["timings_ms"]["total"] for r in evaluated]

    by_category: Dict[str, List[bool]] = {}
    for r in evaluated:
        by_category.setdefault(r["category"], []).append(r["correct"])
    category_accuracy = {
        cat: sum(flags) / len(flags) for cat, flags in by_category.items()
    }

    return {
        "n_examples": len(results),
        "n_errors": len(errored_ids),
        "errored_ids": errored_ids,
        "skipped_due_to_max_calls": skipped_ids,
        "calls_made": calls_made,
        "stopped_on_rate_limit": stopped_on_rate_limit,
        "retrieval_hit_rate": retrieval_hit_rate,
        "answer_accuracy": answer_accuracy,
        "abstention_accuracy": abstention_accuracy,
        "overall_accuracy": overall_accuracy,
        "grounded_rate": grounded_rate,
        "n_judged": len(judged),
        "judge_human_agreement": judge_human_agreement,
        "avg_latency_ms": round(statistics.mean(total_latencies), 1)
        if total_latencies
        else None,
        "p95_latency_ms": round(
            statistics.quantiles(total_latencies, n=20)[18]
            if len(total_latencies) >= 20
            else max(total_latencies),
            1,
        )
        if total_latencies
        else None,
        "category_accuracy": category_accuracy,
        "results": results,
    }


def _fmt_pct(value: Optional[float]) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def print_report(summary: Dict[str, Any]) -> None:
    print(f"\n{'=' * 70}\nEVAL REPORT ({summary['n_examples']} examples)\n{'=' * 70}")

    for r in summary["results"]:
        mark = "PASS" if r["correct"] else "FAIL"
        hit = (
            ""
            if r["retrieval_hit"] is None
            else (" [retrieval-hit]" if r["retrieval_hit"] else " [retrieval-miss]")
        )
        print(f"[{mark}]{hit} {r['id']:16s} {r['question']}")
        if not r["correct"]:
            print(f"         -> got: {r['answer']!r}")

    print(f"\n{'-' * 70}")
    if summary["n_errors"]:
        print(
            f"WARNING: {summary['n_errors']} question(s) errored out (excluded from metrics): "
            f"{', '.join(summary['errored_ids'])}"
        )
    if summary["skipped_due_to_max_calls"]:
        print(
            f"WARNING: {len(summary['skipped_due_to_max_calls'])} question(s) skipped "
            f"(--max-calls reached or stopped on rate limit): {', '.join(summary['skipped_due_to_max_calls'])}"
        )
    print(f"Retrieval hit rate   : {_fmt_pct(summary['retrieval_hit_rate'])}")
    print(f"Answer accuracy      : {_fmt_pct(summary['answer_accuracy'])}")
    print(f"Abstention accuracy  : {_fmt_pct(summary['abstention_accuracy'])}")
    print(f"Overall accuracy     : {_fmt_pct(summary['overall_accuracy'])}")
    print(f"Grounded rate        : {_fmt_pct(summary['grounded_rate'])}")
    if summary["n_judged"]:
        print(
            f"Judge/deterministic agreement: {_fmt_pct(summary['judge_human_agreement'])} "
            f"({summary['n_judged']} judged)"
        )
    print(
        f"Avg / p95 latency    : {summary['avg_latency_ms']} ms / {summary['p95_latency_ms']} ms"
    )
    print(f"Live LLM calls made  : {summary['calls_made']}")
    print("\nBy category:")
    for cat, acc in sorted(summary["category_accuracy"].items()):
        print(f"  {cat:24s} {_fmt_pct(acc)}")
    print(f"{'=' * 70}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["dev", "test", "all"], default="all")
    parser.add_argument("--max-calls", type=int, default=40)
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument(
        "--resume",
        action="store_true",
        help="No-op beyond documentation -- "
        "resuming is automatic via the on-disk cache; this flag exists so the "
        "intent is explicit in a command line.",
    )
    parser.add_argument(
        "--judge",
        action="store_true",
        help="Also run the LLM-judge pass (extra live calls, off by default).",
    )
    parser.add_argument(
        "--rewrite",
        action="store_true",
        help="Apply query rewriting "
        "(rag/rewrite.py) to multi_turn items before answering -- one extra "
        "live call per such item, off by default. Compare a --rewrite run's "
        "multi_turn category accuracy against a plain run's to measure its effect.",
    )
    parser.add_argument(
        "--fail-under",
        type=float,
        default=None,
        help="Exit with status 1 if overall_accuracy is below this threshold (e.g. 0.9).",
    )
    args = parser.parse_args()

    dataset = json.loads(DATASET_PATH.read_text())
    summary = run(
        dataset,
        split=args.split,
        max_calls=args.max_calls,
        repeats=args.repeats,
        judge=args.judge,
        rewrite=args.rewrite,
    )

    summary["meta"] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "git_sha": _git_sha(),
        "resolved_model": config.LLM_MODEL,
        "dataset_hash": _dataset_hash(dataset),
        "split": args.split,
        "max_calls": args.max_calls,
        "repeats": args.repeats,
        "judge_run": args.judge,
        "rewrite_run": args.rewrite,
    }

    print_report(summary)

    REPORT_PATH.write_text(json.dumps(summary, indent=2))
    REPORTS_DIR.mkdir(exist_ok=True)
    timestamped_path = (
        REPORTS_DIR / f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}_{args.split}.json"
    )
    timestamped_path.write_text(json.dumps(summary, indent=2))
    print(f"Full report written to {REPORT_PATH} and {timestamped_path}")

    get_client().flush()  # short-lived script -- make sure traces are sent before exit

    if (
        args.fail_under is not None
        and summary["overall_accuracy"] is not None
        and summary["overall_accuracy"] < args.fail_under
    ):
        print(
            f"FAIL: overall_accuracy {summary['overall_accuracy']:.3f} < --fail-under {args.fail_under}"
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
