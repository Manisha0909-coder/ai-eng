"""Offline: run_eval.run()'s cache/resume/max-calls/rate-limit/repeats
logic, against a fake pipeline and an isolated cache file -- no real
embeddings or LLM calls."""

import pytest

from eval import run_eval


class _FakePipeline:
    def __init__(self, raise_on_call=None):
        self.raise_on_call = raise_on_call or {}
        self.calls = []

    def answer(self, question, source="eval"):
        self.calls.append(question)
        call_index = len(self.calls)
        if call_index in self.raise_on_call:
            raise self.raise_on_call[call_index]
        return {
            "answer": "Employees receive 20 days of annual leave.",
            "sources": [
                {"source": "employee_policy.txt", "text": "20 days of annual leave"}
            ],
            "timings_ms": {
                "retrieval": 1.0,
                "rerank": 1.0,
                "generation": 1.0,
                "total": 3.0,
            },
        }


@pytest.fixture
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(run_eval.cache, "CACHE_PATH", tmp_path / "responses.json")


@pytest.fixture
def fake_sleep(monkeypatch):
    monkeypatch.setattr(run_eval.time, "sleep", lambda seconds: None)


DATASET = [
    {
        "id": "q1",
        "question": "Q1?",
        "category": "cat",
        "answerable": True,
        "expected_source": "employee_policy.txt",
        "answer_must_contain": ["20"],
        "expected_chunk_substring": "20 days",
        "forbidden_substrings": [],
    },
    {
        "id": "q2",
        "question": "Q2?",
        "category": "cat",
        "answerable": True,
        "expected_source": "employee_policy.txt",
        "answer_must_contain": ["20"],
        "expected_chunk_substring": "20 days",
        "forbidden_substrings": [],
    },
]


def test_summarize_excludes_errored_from_accuracy():
    results = [
        {
            "id": "a",
            "answerable": True,
            "retrieval_hit": True,
            "correct": True,
            "grounded": True,
            "errored": False,
            "category": "x",
            "timings_ms": {"total": 1.0},
        },
        {
            "id": "b",
            "answerable": True,
            "retrieval_hit": False,
            "correct": False,
            "grounded": True,
            "errored": True,
            "category": "x",
            "timings_ms": {"total": 0.0},
        },
    ]

    summary = run_eval.summarize(
        results, skipped_ids=[], calls_made=2, stopped_on_rate_limit=False
    )

    assert summary["n_errors"] == 1
    assert summary["errored_ids"] == ["b"]
    assert summary["answer_accuracy"] == 1.0  # only "a" counted
    assert summary["n_examples"] == 2


def test_resume_skips_cached_items_without_calling_pipeline(
    isolated_cache, fake_sleep, monkeypatch
):
    pipeline = _FakePipeline()
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-1")

    run_eval.cache.put(
        "fake-model-1",
        "Q1?",
        {
            "id": "q1",
            "question": "Q1?",
            "category": "cat",
            "answerable": True,
            "expected_source": "employee_policy.txt",
            "retrieved_sources": ["employee_policy.txt"],
            "retrieved_context": "20 days",
            "retrieval_hit": True,
            "answer": "cached answer",
            "correct": True,
            "grounded": True,
            "errored": False,
            "timings_ms": {"retrieval": 0, "rerank": 0, "generation": 0, "total": 0},
            "repeat_index": 0,
        },
        repeat_index=0,
    )

    summary = run_eval.run(DATASET, max_calls=40)

    assert pipeline.calls == ["Q2?"]  # Q1 served from cache, never called
    assert summary["calls_made"] == 1


def test_max_calls_zero_skips_all_new_items(isolated_cache, fake_sleep, monkeypatch):
    pipeline = _FakePipeline()
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-2")

    summary = run_eval.run(DATASET, max_calls=0)

    assert pipeline.calls == []
    assert summary["skipped_due_to_max_calls"] == ["q1", "q2"]
    assert summary["calls_made"] == 0


def test_rate_limit_stops_remaining_items(isolated_cache, fake_sleep, monkeypatch):
    class _RateLimitError(Exception):
        status_code = 429

    pipeline = _FakePipeline(raise_on_call={1: _RateLimitError("429")})
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-3")

    summary = run_eval.run(DATASET, max_calls=40)

    assert summary["stopped_on_rate_limit"] is True
    assert "q1" in summary["errored_ids"]
    assert "q2" in summary["skipped_due_to_max_calls"]


def test_repeats_makes_independent_calls_per_item(
    isolated_cache, fake_sleep, monkeypatch
):
    pipeline = _FakePipeline()
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-4")

    summary = run_eval.run([DATASET[0]], max_calls=40, repeats=3)

    assert pipeline.calls == ["Q1?", "Q1?", "Q1?"]
    assert summary["calls_made"] == 3


def test_rewrite_flag_rewrites_multi_turn_items_and_counts_two_calls(
    isolated_cache, fake_sleep, monkeypatch
):
    import rag.rewrite as rewrite_module

    pipeline = _FakePipeline()
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-5")
    monkeypatch.setattr(
        rewrite_module, "rewrite_query", lambda llm, q, h: "standalone question"
    )

    multi_turn_item = {
        "id": "mt1",
        "question": "And how many sick days?",
        "category": "multi_turn",
        "answerable": True,
        "expected_source": "employee_policy.txt",
        "answer_must_contain": ["20"],
        "expected_chunk_substring": "20 days",
        "forbidden_substrings": [],
        "history": [{"role": "user", "content": "How long is maternity leave?"}],
    }

    summary = run_eval.run([multi_turn_item], max_calls=40, rewrite=True)

    assert pipeline.calls == ["standalone question"]  # answered the rewritten question
    assert summary["calls_made"] == 2  # the rewrite call + the generation call
    assert summary["results"][0]["question"] == "standalone question"


def test_rewrite_flag_is_noop_for_items_without_history(
    isolated_cache, fake_sleep, monkeypatch
):
    pipeline = _FakePipeline()
    monkeypatch.setattr(run_eval, "get_pipeline", lambda: pipeline)
    monkeypatch.setattr(run_eval.config, "LLM_MODEL", "fake-model-6")

    summary = run_eval.run([DATASET[0]], max_calls=40, rewrite=True)

    assert pipeline.calls == ["Q1?"]  # no history -- unchanged, no rewrite call
    assert summary["calls_made"] == 1
