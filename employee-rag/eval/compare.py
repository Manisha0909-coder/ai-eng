"""Diffs two eval reports (from eval/reports/*.json or eval/report.json)
per example id -- which ids flipped from correct to incorrect (or vice
versa), and which only exist in one report.

Usage:
    python -m eval.compare eval/reports/20260101T000000Z_dev.json eval/reports/20260102T000000Z_dev.json
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict


def _results_by_id(report: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {r["id"]: r for r in report["results"]}


def compare(report_a: Dict[str, Any], report_b: Dict[str, Any]) -> Dict[str, Any]:
    a = _results_by_id(report_a)
    b = _results_by_id(report_b)

    only_in_a = sorted(set(a) - set(b))
    only_in_b = sorted(set(b) - set(a))
    shared = sorted(set(a) & set(b))

    newly_correct = [i for i in shared if not a[i]["correct"] and b[i]["correct"]]
    newly_incorrect = [i for i in shared if a[i]["correct"] and not b[i]["correct"]]
    unchanged_correct = [i for i in shared if a[i]["correct"] and b[i]["correct"]]
    unchanged_incorrect = [
        i for i in shared if not a[i]["correct"] and not b[i]["correct"]
    ]

    return {
        "only_in_a": only_in_a,
        "only_in_b": only_in_b,
        "newly_correct": newly_correct,
        "newly_incorrect": newly_incorrect,
        "unchanged_correct_count": len(unchanged_correct),
        "unchanged_incorrect_count": len(unchanged_incorrect),
    }


def print_comparison(diff: Dict[str, Any]) -> None:
    print(f"\n{'=' * 60}\nREPORT COMPARISON\n{'=' * 60}")
    print(
        f"Newly correct ({len(diff['newly_correct'])}): {', '.join(diff['newly_correct']) or '(none)'}"
    )
    print(
        f"Newly incorrect ({len(diff['newly_incorrect'])}): {', '.join(diff['newly_incorrect']) or '(none)'}"
    )
    print(f"Unchanged correct: {diff['unchanged_correct_count']}")
    print(f"Unchanged incorrect: {diff['unchanged_incorrect_count']}")
    if diff["only_in_a"]:
        print(f"Only in report A: {', '.join(diff['only_in_a'])}")
    if diff["only_in_b"]:
        print(f"Only in report B: {', '.join(diff['only_in_b'])}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report_a", type=Path)
    parser.add_argument("report_b", type=Path)
    args = parser.parse_args()

    report_a = json.loads(args.report_a.read_text())
    report_b = json.loads(args.report_b.read_text())

    print_comparison(compare(report_a, report_b))


if __name__ == "__main__":
    main()
