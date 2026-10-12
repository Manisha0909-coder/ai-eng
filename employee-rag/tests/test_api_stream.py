"""Offline: /ask/stream's SSE format, against a fake pipeline -- no real
embeddings or LLM calls."""

import json

import pytest
from fastapi.testclient import TestClient

import api


class _FakeStreamingPipeline:
    def __init__(self, chunks):
        self._chunks = chunks

    def answer_stream(self, question, request_id=None):
        yield from self._chunks


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        api, "get_pipeline", lambda: _FakeStreamingPipeline(["Employees ", "receive ", "20 days."])
    )
    return TestClient(api.app)


def _parse_sse_events(raw_text: str):
    events = []
    for block in raw_text.strip().split("\n\n"):
        if not block.strip():
            continue
        assert block.startswith("data: "), f"not a valid SSE data line: {block!r}"
        events.append(json.loads(block[len("data: ") :]))
    return events


def test_stream_endpoint_emits_one_event_per_chunk_then_done(client):
    response = client.post("/ask/stream", json={"question": "How many days of leave?"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = _parse_sse_events(response.text)

    assert events[:-1] == [
        {"chunk": "Employees "},
        {"chunk": "receive "},
        {"chunk": "20 days."},
    ]
    assert events[-1] == {"done": True}


def test_stream_endpoint_reports_error_mid_stream(monkeypatch):
    class _ExplodingPipeline:
        def answer_stream(self, question, request_id=None):
            yield "partial answer "
            raise RuntimeError("boom")

    monkeypatch.setattr(api, "get_pipeline", lambda: _ExplodingPipeline())
    client = TestClient(api.app)

    response = client.post("/ask/stream", json={"question": "anything"})
    events = _parse_sse_events(response.text)

    assert events[0] == {"chunk": "partial answer "}
    assert "error" in events[1]
    assert events[-1] == {"done": True}
