"""Offline: pure string matching, no pipeline/LLM involved."""

from eval.run_eval import _contains_all


def test_plain_string_terms_all_required():
    assert _contains_all("Employees receive 20 days of leave.", ["20", "days"])
    assert not _contains_all("Employees receive 20 days of leave.", ["20", "weeks"])


def test_variant_group_matches_any_phrasing():
    must_contain = [["twice", "two days", "2 days"], "week"]

    assert _contains_all("You can work from home twice a week.", must_contain)
    assert _contains_all("You can work remotely two days per week.", must_contain)
    assert not _contains_all("You can work remotely three days per week.", must_contain)


def test_variant_group_still_requires_every_group():
    must_contain = [["twice", "two days"], "week"]

    assert not _contains_all("You can work from home twice a year.", must_contain)
