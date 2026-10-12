"""Offline: api.py's hardening -- /ready, /version, API-key auth, rate
limiting, consistent error JSON, request-id propagation. Against a fake
pipeline, no real embeddings or LLM calls."""

import pytest
from fastapi.testclient import TestClient

import api
from api import _TokenBucket


class _FakePipeline:
    def __init__(self, answer_result=None, raise_on_init=False):
        self._answer_result = answer_result or {
            "answer": "Employees receive 20 days of annual leave.",
            "sources": [],
            "timings_ms": {"retrieval": 1.0, "rerank": 1.0, "generation": 1.0, "total": 3.0},
        }
        self._raise_on_init = raise_on_init

    def answer(self, question, request_id=None):
        if self._raise_on_init:
            raise RuntimeError("pipeline not ready")
        return self._answer_result


@pytest.fixture(autouse=True)
def reset_rate_limit_buckets():
    api._buckets.clear()
    yield
    api._buckets.clear()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "get_pipeline", lambda: _FakePipeline())
    return TestClient(api.app)


# --- /health, /ready, /version ---


def test_health_always_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_ok_when_pipeline_loads(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_ready_503_when_pipeline_fails(monkeypatch):
    monkeypatch.setattr(api, "get_pipeline", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    client = TestClient(api.app)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["error"]["status_code"] == 503


def test_version_has_expected_fields(client):
    response = client.get("/version")
    body = response.json()

    assert response.status_code == 200
    assert set(body.keys()) == {"git_sha", "model", "config_hash"}


# --- API-key auth ---


def test_ask_works_without_api_key_when_unset(client, monkeypatch):
    monkeypatch.setattr(api.config, "API_KEY", None)

    response = client.post("/ask", json={"question": "How many days of leave?"})

    assert response.status_code == 200


def test_ask_requires_api_key_when_configured(client, monkeypatch):
    monkeypatch.setattr(api.config, "API_KEY", "secret123")

    response = client.post("/ask", json={"question": "How many days of leave?"})

    assert response.status_code == 401
    assert response.json()["error"]["status_code"] == 401


def test_ask_accepts_correct_api_key(client, monkeypatch):
    monkeypatch.setattr(api.config, "API_KEY", "secret123")

    response = client.post(
        "/ask", json={"question": "How many days of leave?"}, headers={"X-API-Key": "secret123"}
    )

    assert response.status_code == 200


# --- rate limiting ---


def test_token_bucket_allows_up_to_capacity_then_blocks():
    bucket = _TokenBucket(capacity=2, refill_per_second=0.0)

    assert bucket.consume() is True
    assert bucket.consume() is True
    assert bucket.consume() is False  # exhausted, no refill


def test_ask_rate_limited_after_capacity_exhausted(client, monkeypatch):
    monkeypatch.setattr(api, "RATE_LIMIT_CAPACITY", 2.0)

    for _ in range(2):
        response = client.post("/ask", json={"question": "How many days of leave?"})
        assert response.status_code == 200

    response = client.post("/ask", json={"question": "How many days of leave?"})

    assert response.status_code == 429
    assert response.json()["error"]["status_code"] == 429


# --- consistent error JSON ---


def test_404_has_consistent_error_shape(client):
    response = client.get("/no-such-route")

    assert response.status_code == 404
    assert "error" in response.json()
    assert response.json()["error"]["status_code"] == 404


def test_validation_error_has_consistent_error_shape(client):
    response = client.post("/ask", json={"question": ""})  # violates min_length=1

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["status_code"] == 422
    assert "details" in body["error"]


# --- request-id propagation ---


def test_request_id_generated_when_absent(client):
    response = client.get("/health")

    assert "x-request-id" in response.headers
    assert len(response.headers["x-request-id"]) > 0


def test_request_id_echoed_when_provided(client):
    response = client.get("/health", headers={"X-Request-ID": "my-custom-id"})

    assert response.headers["x-request-id"] == "my-custom-id"
