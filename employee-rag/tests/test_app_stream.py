"""Offline: app.py's respond() generator -- no real agent/LLM calls.
get_pipeline() is never exercised here either, since that's only called
from __main__ (see app.py's own comment on why it's guarded that way)."""

from langchain_core.messages import AIMessage

import app


class _FakeAgent:
    def __init__(self, content):
        self._content = content
        self.invoke_calls = 0

    def invoke(self, state, config=None):
        self.invoke_calls += 1
        return {"messages": [AIMessage(content=self._content)], "steps": 1}


def test_cached_example_streams_and_concatenates_to_the_full_cached_answer():
    cached_question = next(iter(app._EXAMPLES_CACHE))
    expected = app._EXAMPLES_CACHE[cached_question]

    chunks = list(app.respond(cached_question, []))

    assert chunks[-1] == expected  # last yielded value is the complete text
    assert len(chunks) > 1  # and it got there progressively, not in one jump


def test_cached_example_never_calls_the_agent(monkeypatch):
    fake_agent = _FakeAgent("should never be used")
    monkeypatch.setattr(app, "get_agent", lambda: fake_agent)

    cached_question = next(iter(app._EXAMPLES_CACHE))
    list(app.respond(cached_question, []))

    assert fake_agent.invoke_calls == 0


def test_live_question_streams_and_final_chunk_equals_agent_answer(monkeypatch):
    fake_agent = _FakeAgent("Employees receive 20 days of annual leave.")
    monkeypatch.setattr(app, "get_agent", lambda: fake_agent)
    monkeypatch.setattr(app._langfuse, "flush", lambda: None)

    chunks = list(app.respond("How many days of leave?", []))

    assert chunks[-1] == "Employees receive 20 days of annual leave."
    assert fake_agent.invoke_calls == 1  # exactly once -- never double-spends quota


def test_agent_exception_yields_friendly_message_instead_of_raising(monkeypatch):
    class _ExplodingAgent:
        def invoke(self, state, config=None):
            raise RuntimeError("boom")

    monkeypatch.setattr(app, "get_agent", lambda: _ExplodingAgent())
    monkeypatch.setattr(app._langfuse, "flush", lambda: None)

    chunks = list(app.respond("any question", []))

    assert chunks[-1] == "The assistant is temporarily unavailable. Please try again."


def test_reveal_in_chunks_is_monotonically_increasing_prefixes():
    text = "Employees receive 20 days of annual leave."

    chunks = list(app._reveal_in_chunks(text))

    assert chunks[-1] == text
    for earlier, later in zip(chunks, chunks[1:]):
        assert later.startswith(earlier)


def test_reveal_in_chunks_handles_empty_string():
    assert list(app._reveal_in_chunks("")) == [""]
