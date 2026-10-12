"""Offline: rag/rewrite.py against a fake LLM -- no real network calls."""

from rag.rewrite import rewrite_query


class _FakeLLM:
    def __init__(self, content=None, raise_exc=None):
        self._content = content
        self._raise_exc = raise_exc

    def invoke(self, prompt_value):
        if self._raise_exc is not None:
            raise self._raise_exc

        class _Response:
            content = self._content

        return _Response()


def test_no_history_returns_question_unchanged_without_calling_llm():
    llm = _FakeLLM(content="should never be used")

    result = rewrite_query(llm, "How many days of leave?", history=[])

    assert result == "How many days of leave?"


def test_rewrites_using_history_when_llm_succeeds():
    history = [
        {"role": "user", "content": "How long is maternity leave?"},
        {"role": "assistant", "content": "12 weeks."},
    ]
    llm = _FakeLLM(content="How many sick days does an employee get per year?")

    result = rewrite_query(llm, "And how many sick days do I get on top of that?", history)

    assert result == "How many sick days does an employee get per year?"


def test_falls_back_to_raw_question_on_llm_exception():
    history = [{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}]
    llm = _FakeLLM(raise_exc=RuntimeError("boom"))

    result = rewrite_query(llm, "the original follow-up", history)

    assert result == "the original follow-up"


def test_falls_back_to_raw_question_on_empty_response():
    history = [{"role": "user", "content": "x"}, {"role": "assistant", "content": "y"}]
    llm = _FakeLLM(content="   ")

    result = rewrite_query(llm, "the original follow-up", history)

    assert result == "the original follow-up"
