"""Offline: RAGPipeline.answer_stream() against a fake streaming chain and
a fake retriever -- no real embeddings, reranker model, or LLM calls.

Constructs a bare RAGPipeline via __new__ (skipping __init__, which would
otherwise load the real embedding model and hit the network) and injects
fakes for exactly the three collaborators answer_stream() touches:
self.retriever, self.chain, self._langfuse_handler.
"""

import pytest
from langchain_core.documents import Document

from rag import quota
from rag.pipeline import GENERATION_ERROR, NO_ANSWER, RAGPipeline
from rag.retrieval import Candidate


class _FakeChain:
    def __init__(self, chunks=None, raise_after=None):
        self._chunks = chunks or ["Employees ", "receive ", "20 days."]
        self._raise_after = raise_after

    def stream(self, inputs, config=None):
        for i, chunk in enumerate(self._chunks):
            if self._raise_after is not None and i >= self._raise_after:
                raise RuntimeError("simulated mid-stream failure")
            yield chunk


class _FakeRetriever:
    def __init__(self, candidates):
        self._candidates = candidates

    def retrieve(self, question):
        return self._candidates


def _make_pipeline(chain, candidates):
    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = _FakeRetriever(candidates)
    pipeline.chain = chain
    pipeline._langfuse_handler = None
    return pipeline


def _relevant_candidate(text="Employees receive 20 days of annual leave."):
    return Candidate(
        document=Document(page_content=text, metadata={"source": "employee_policy.txt"})
    )


@pytest.fixture(autouse=True)
def reset_quota(monkeypatch):
    monkeypatch.setattr(quota, "_count", 0)
    monkeypatch.setattr(quota, "_day", quota._today())


def test_tokens_arrive_in_order_and_concatenate_to_full_answer(monkeypatch):
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, 10.0) for c in shortlist]
    )

    chain = _FakeChain(chunks=["Employees ", "receive ", "20 days."])
    pipeline = _make_pipeline(chain, [_relevant_candidate()])

    chunks = list(pipeline.answer_stream("How many days of leave?", source="eval"))

    assert chunks == ["Employees ", "receive ", "20 days."]
    assert "".join(chunks) == "Employees receive 20 days."


def test_mid_stream_error_yields_partial_plus_friendly_message(monkeypatch):
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, 10.0) for c in shortlist]
    )

    chain = _FakeChain(chunks=["Employees ", "receive ", "this should never arrive"], raise_after=2)
    pipeline = _make_pipeline(chain, [_relevant_candidate()])

    chunks = list(pipeline.answer_stream("How many days of leave?", source="eval"))
    full_text = "".join(chunks)

    assert full_text.startswith("Employees receive ")
    assert GENERATION_ERROR in full_text


def test_no_relevant_context_yields_no_answer_without_calling_chain(monkeypatch):
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, -20.0) for c in shortlist]
    )

    chain = _FakeChain()
    pipeline = _make_pipeline(chain, [_relevant_candidate()])

    chunks = list(pipeline.answer_stream("unrelated question", source="eval"))

    assert chunks == [NO_ANSWER]


def test_quota_exceeded_yields_quota_message_without_retrieving(monkeypatch):
    class _ExplodingRetriever:
        def retrieve(self, question):
            raise AssertionError("retrieve() should never be called once quota is exceeded")

    pipeline = RAGPipeline.__new__(RAGPipeline)
    pipeline.retriever = _ExplodingRetriever()
    pipeline.chain = _FakeChain()
    pipeline._langfuse_handler = None

    monkeypatch.setattr(quota, "_count", quota.DAILY_LIMIT)
    monkeypatch.setattr(quota, "_day", quota._today())

    chunks = list(pipeline.answer_stream("any question", source="agent"))

    assert chunks == [quota.QUOTA_MESSAGE]


def test_eval_source_bypasses_quota(monkeypatch):
    import rag.pipeline as pipeline_module

    monkeypatch.setattr(
        pipeline_module, "rerank", lambda q, shortlist: [(c, 10.0) for c in shortlist]
    )
    monkeypatch.setattr(quota, "_count", quota.DAILY_LIMIT)
    monkeypatch.setattr(quota, "_day", quota._today())

    chain = _FakeChain(chunks=["20 days."])
    pipeline = _make_pipeline(chain, [_relevant_candidate()])

    chunks = list(pipeline.answer_stream("How many days?", source="eval"))

    assert chunks == ["20 days."]
