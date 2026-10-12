"""Offline: hand-computed chunk-level metrics, no retriever/embeddings
involved -- these test the scoring math in eval/run_ablation.py directly
against fake Candidate objects."""

from langchain_core.documents import Document

from eval.run_ablation import _chunk_level_metrics, _expected_sources, _expected_substrings, _reciprocal_rank
from rag.retrieval import Candidate


def _candidate(text, source):
    return Candidate(document=Document(page_content=text, metadata={"source": source}))


def test_expected_sources_normalizes_string_and_list():
    assert _expected_sources({"expected_source": "a.txt"}) == ["a.txt"]
    assert _expected_sources({"expected_source": ["a.txt", "b.txt"]}) == ["a.txt", "b.txt"]


def test_expected_substrings_normalizes_none_string_and_list():
    assert _expected_substrings({}) == []
    assert _expected_substrings({"expected_chunk_substring": None}) == []
    assert _expected_substrings({"expected_chunk_substring": "20 days"}) == ["20 days"]
    assert _expected_substrings({"expected_chunk_substring": ["a", "b"]}) == ["a", "b"]


def test_reciprocal_rank_hand_computed():
    candidates = [_candidate("x", "wrong.txt"), _candidate("y", "right.txt"), _candidate("z", "other.txt")]

    rr = _reciprocal_rank(candidates, ["right.txt"])

    assert abs(rr - 1 / 2) < 1e-9  # right.txt is rank 2 (1-indexed)


def test_reciprocal_rank_zero_when_never_found():
    candidates = [_candidate("x", "a.txt")]

    assert _reciprocal_rank(candidates, ["z.txt"]) == 0.0


def test_single_substring_hit_at_k():
    candidates = [
        _candidate("Employees receive 20 days of annual leave.", "employee_policy.txt"),
        _candidate("unrelated text", "other.txt"),
    ]

    hit, recall, precision = _chunk_level_metrics(
        candidates, k=1, expected_sources=["employee_policy.txt"], expected_substrings=["20 days"]
    )

    assert hit is True
    assert recall == 1.0
    assert precision == 1.0  # the only chunk in top-1 is from the expected source


def test_single_substring_miss_when_outside_k():
    candidates = [
        _candidate("unrelated text", "other.txt"),
        _candidate("Employees receive 20 days of annual leave.", "employee_policy.txt"),
    ]

    hit, recall, precision = _chunk_level_metrics(
        candidates, k=1, expected_sources=["employee_policy.txt"], expected_substrings=["20 days"]
    )

    assert hit is False
    assert recall == 0.0
    assert precision == 0.0


def test_multi_hop_requires_all_substrings_for_hit_but_gives_partial_recall():
    candidates = [
        _candidate("A badge replacement is issued within 1 business day.", "security.md"),
        _candidate("unrelated filler", "other.txt"),
    ]

    hit, recall, precision = _chunk_level_metrics(
        candidates,
        k=2,
        expected_sources=["security.md", "it_security_policy.txt"],
        expected_substrings=["replacement is issued within", "lost device must be reported"],
    )

    assert hit is False  # only one of the two required substrings is present
    assert recall == 0.5  # but half credit for partial recall
    assert precision == 0.5  # 1 of 2 top-k chunks is from an expected source


def test_no_substring_falls_back_to_document_level_hit():
    candidates = [_candidate("some text", "employee_policy.txt")]

    hit, recall, precision = _chunk_level_metrics(
        candidates, k=1, expected_sources=["employee_policy.txt"], expected_substrings=[]
    )

    assert hit is True
    assert recall == 1.0
