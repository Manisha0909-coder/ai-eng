"""Offline: RAGPipeline.answer_structured() against fake structured and
plain-text chains -- no real embeddings, reranker model, or LLM calls."""

import pytest
from langchain_core.documents import Document

from rag import quota
from rag.pipeline import RAGPipeline
from rag.retrieval import Candidate
from rag.schema import AnswerPayload


class _FakeStructuredChain:
    def __init__(self, payload=None, raise_exc=None):
        self._payload = payload
        self._raise_exc = raise_exc

    def invoke(self, inputs, config=None):
        if self._raise_exc is not None:
            raise self._raise_exc
        return self._payload


class _FakePlainChain:
    def __init__(self, text):
        self._text = text

    def invoke(self, inputs, config=None):
        return self._text


class _FakeRetriever:
    def __init__(self, candidates):
        self._candidates = candidates

    def retrieve(self, question):
        return self._candidates


def _relevant_candidate():
    return Candidate(
        document=Document(
            page_content="Employees receive 20 days of annual leave.",
            metadata={
                "source": "employee_policy.txt",
                "section_heading": "Annual Leave",
                "chunk_id": "employee_policy.txt::1",
            },
        )
    )


def _make_pipeline(structured_chain, plain_chain, candidates):
    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = _FakeRetriever(candidates)
    pipeline._structured_chain = structured_chain
    pipeline.chain = plain_chain
    pipeline._langfuse_handler = None
    return pipeline


@pytest.fixture(autouse=True)
def reset_quota(monkeypatch):
    monkeypatch.setattr(quota, "_count", 0)
    monkeypatch.setattr(quota, "_day", quota._today())


@pytest.fixture(autouse=True)
def patch_rerank_and_backoff(monkeypatch):
    import rag.config as config_module
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, 10.0) for c in shortlist]
    )
    monkeypatch.setattr(config_module, "GENERATION_RETRY_BACKOFF_SECONDS", 0)


def test_returns_structured_payload_on_success():
    payload = AnswerPayload(
        answer="You get 20 days.", citations=[], confidence="high", abstained=False
    )
    pipeline = _make_pipeline(
        _FakeStructuredChain(payload=payload),
        _FakePlainChain("unused"),
        [_relevant_candidate()],
    )

    result = pipeline.answer_structured("How many days?", source="eval")

    assert result is payload


def test_falls_back_to_plain_text_with_deterministic_citations_on_repeated_failure():
    pipeline = _make_pipeline(
        _FakeStructuredChain(raise_exc=RuntimeError("structured output not supported")),
        _FakePlainChain("Employees receive 20 days of annual leave."),
        [_relevant_candidate()],
    )

    result = pipeline.answer_structured("How many days?", source="eval")

    assert isinstance(result, AnswerPayload)
    assert result.answer == "Employees receive 20 days of annual leave."
    assert result.citations[0].source == "employee_policy.txt"
    assert result.citations[0].chunk_id == "employee_policy.txt::1"
    assert result.abstained is False


def test_falls_back_with_abstained_true_when_plain_text_abstains():
    pipeline = _make_pipeline(
        _FakeStructuredChain(raise_exc=RuntimeError("boom")),
        _FakePlainChain("I don't have enough information to answer that."),
        [_relevant_candidate()],
    )

    result = pipeline.answer_structured("unrelated question", source="eval")

    assert result.abstained is True


def test_no_relevant_context_abstains_without_calling_any_chain(monkeypatch):
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, -20.0) for c in shortlist]
    )

    pipeline = _make_pipeline(
        _FakeStructuredChain(), _FakePlainChain("unused"), [_relevant_candidate()]
    )

    result = pipeline.answer_structured("unrelated question", source="eval")

    assert result.abstained is True
    assert result.answer == "I don't have enough information to answer that."


def test_quota_exceeded_returns_quota_payload(monkeypatch):
    class _ExplodingRetriever:
        def retrieve(self, question):
            raise AssertionError("should not be called once quota is exceeded")

    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = _ExplodingRetriever()
    pipeline._structured_chain = _FakeStructuredChain()
    pipeline.chain = _FakePlainChain("unused")
    pipeline._langfuse_handler = None

    monkeypatch.setattr(quota, "_count", quota.DAILY_LIMIT)
    monkeypatch.setattr(quota, "_day", quota._today())

    result = pipeline.answer_structured("any question", source="agent")

    assert result.abstained is True
    assert result.answer == quota.QUOTA_MESSAGE
