"""Offline: pure string matching, no pipeline/LLM involved."""

from eval.run_eval import _abstained, _contains_all, _is_rate_limit_error, _dataset_hash


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


def test_abstention_detected_from_no_answer_phrase():
    assert _abstained("I don't have enough information to answer that.")
    assert not _abstained("Employees receive 20 days of annual leave.")


def test_abstention_detection_is_case_insensitive():
    assert _abstained("I Don't Have Enough Information to answer that.")


def test_rate_limit_error_detected_from_status_code():
    class FakeError(Exception):
        status_code = 429

    assert _is_rate_limit_error(FakeError("boom"))


def test_rate_limit_error_detected_from_message_text():
    assert _is_rate_limit_error(Exception("HTTP 429: Too Many Requests"))


def test_non_rate_limit_error_not_flagged():
    assert not _is_rate_limit_error(Exception("connection timed out"))


def test_dataset_hash_changes_when_dataset_changes():
    dataset_a = [{"id": "x", "question": "q1"}]
    dataset_b = [{"id": "x", "question": "q2"}]

    assert _dataset_hash(dataset_a) != _dataset_hash(dataset_b)


def test_dataset_hash_stable_for_same_content():
    dataset = [{"id": "x", "question": "q1"}]

    assert _dataset_hash(dataset) == _dataset_hash(dataset)
