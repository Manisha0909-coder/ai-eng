"""
Aggregates Bruno CLI --reporter-json output files (one per folder) into a
single execution summary plus a list of failed test cases.

Usage:
    python bruno/summarize_reports.py <report_dir>
"""

import json
import sys
from pathlib import Path

CHECK_KEYS = (
    "preRequestTestResults",
    "postResponseTestResults",
    "testResults",
    "assertionResults",
)


def collect_checks(result):
    checks = []
    for key in CHECK_KEYS:
        checks.extend(result.get(key) or [])
    return checks


def main():
    report_dir = Path(sys.argv[1])
    files = sorted(report_dir.glob("*.json"))

    total_requests = 0
    passed_requests = 0
    failed_requests = 0
    total_tests = 0
    passed_tests = 0
    total_duration_ms = 0
    failures = []

    for f in files:
        data = json.loads(f.read_text())
        for iteration in data:
            for r in iteration.get("results", []):
                total_requests += 1
                total_duration_ms += (r.get("response") or {}).get("duration", 0) or 0

                checks = collect_checks(r)
                request_failed = r.get("error") is not None

                for c in checks:
                    total_tests += 1
                    if c.get("status") == "pass":
                        passed_tests += 1
                    else:
                        request_failed = True
                        failures.append(
                            {
                                "path": r.get("path"),
                                "description": c.get("description"),
                                "error": c.get("error"),
                            }
                        )

                if r.get("error") is not None:
                    failures.append(
                        {
                            "path": r.get("path"),
                            "description": "Request error",
                            "error": r.get("error"),
                        }
                    )

                if request_failed:
                    failed_requests += 1
                else:
                    passed_requests += 1

    status = "✓ PASS" if failed_requests == 0 else "✗ FAIL"

    print()
    print("=" * 60)
    print("📊 OVERALL EXECUTION SUMMARY (all folders)")
    print("=" * 60)
    print(f"Status:      {status}")
    print(f"Requests:    {total_requests} ({passed_requests} Passed, {failed_requests} Failed)")
    print(f"Tests:       {passed_tests}/{total_tests}")
    print(f"Duration:    {total_duration_ms} ms")
    print("=" * 60)

    if failures:
        print()
        print(f"❌ FAILED TEST CASES ({len(failures)})")
        print("-" * 60)
        for fl in failures:
            print(f"- {fl['path']}: {fl['description']}")
            if fl.get("error"):
                print(f"    {fl['error']}")
        print("-" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
