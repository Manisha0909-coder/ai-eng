"""Offline: eval/compare.py's report-diffing logic, no files/LLM involved."""

from eval.compare import compare


def _report(results):
    return {"results": results}


def test_detects_newly_correct_and_newly_incorrect():
    report_a = _report([
        {"id": "x", "correct": False},
        {"id": "y", "correct": True},
    ])
    report_b = _report([
        {"id": "x", "correct": True},
        {"id": "y", "correct": False},
    ])

    diff = compare(report_a, report_b)

    assert diff["newly_correct"] == ["x"]
    assert diff["newly_incorrect"] == ["y"]


def test_unchanged_counts():
    report_a = _report([{"id": "x", "correct": True}, {"id": "y", "correct": False}])
    report_b = _report([{"id": "x", "correct": True}, {"id": "y", "correct": False}])

    diff = compare(report_a, report_b)

    assert diff["unchanged_correct_count"] == 1
    assert diff["unchanged_incorrect_count"] == 1
    assert diff["newly_correct"] == []
    assert diff["newly_incorrect"] == []


def test_ids_only_in_one_report():
    report_a = _report([{"id": "x", "correct": True}])
    report_b = _report([{"id": "x", "correct": True}, {"id": "z", "correct": True}])

    diff = compare(report_a, report_b)

    assert diff["only_in_b"] == ["z"]
    assert diff["only_in_a"] == []
