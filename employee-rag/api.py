"""FastAPI service for the employee policy RAG pipeline.

Run locally:      uvicorn api:app --reload
Run in Docker:     see Dockerfile
Interactive docs:  /docs
"""

import hashlib
import json
import logging
import subprocess
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from rag import config
from rag.guardrails import MAX_INPUT_LENGTH
from rag.ingest import config_fingerprint
from rag.pipeline import get_pipeline
from rag.schema import AnswerPayload

logger = logging.getLogger("employee_rag.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the index, embedder, reranker and LLM client once, at startup
    # rather than on the first request, so first-request latency stays low.
    get_pipeline()
    yield


app = FastAPI(
    title="Employee Policy RAG",
    description="Hybrid search (vector + BM25) with cross-encoder reranking over employee policy documents.",
    version="1.0.0",
    lifespan=lifespan,
)


# --- request-id middleware ---------------------------------------------


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assigns (or propagates) a request id, exposes it on the response as
    X-Request-ID, and stashes it on request.state so route handlers can
    forward it to Langfuse as trace metadata -- lets a specific HTTP
    request be found in the Langfuse UI from its response header alone."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app.add_middleware(RequestIDMiddleware)


# --- consistent error JSON ----------------------------------------------


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "status_code": exc.status_code}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "message": "Validation error",
                "status_code": 422,
                "details": exc.errors(),
            }
        },
    )


# --- API-key auth (optional -- only enforced when API_KEY is set) -------

_api_key_warned = False


def require_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> None:
    global _api_key_warned

    if not config.API_KEY:
        if not _api_key_warned:
            logger.warning(
                "API_KEY is not set -- /ask endpoints are running without authentication."
            )
            _api_key_warned = True
        return

    if x_api_key != config.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# --- per-IP token-bucket rate limit --------------------------------------


class _TokenBucket:
    def __init__(self, capacity: float, refill_per_second: float):
        self.capacity = capacity
        self.refill_per_second = refill_per_second
        self.tokens = capacity
        self.last_refill = time.monotonic()

    def consume(self, amount: float = 1.0) -> bool:
        now = time.monotonic()
        self.tokens = min(
            self.capacity, self.tokens + (now - self.last_refill) * self.refill_per_second
        )
        self.last_refill = now
        if self.tokens >= amount:
            self.tokens -= amount
            return True
        return False


RATE_LIMIT_CAPACITY = 20.0
RATE_LIMIT_REFILL_PER_SECOND = 20.0 / 60.0  # ~20 req/min per IP

_buckets: Dict[str, _TokenBucket] = {}


def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    bucket = _buckets.setdefault(
        client_ip, _TokenBucket(RATE_LIMIT_CAPACITY, RATE_LIMIT_REFILL_PER_SECOND)
    )
    if not bucket.consume():
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")


_ask_dependencies = [Depends(require_api_key), Depends(enforce_rate_limit)]


# --- schemas --------------------------------------------------------------


class AskRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=MAX_INPUT_LENGTH,
        examples=["How many days of annual leave do I get?"],
    )


class Source(BaseModel):
    source: str
    text: str
    rerank_score: float
    vector_rank: Optional[int]
    bm25_rank: Optional[int]


class AskResponse(BaseModel):
    answer: str
    sources: List[Source]
    timings_ms: Dict[str, float]


# --- monitoring endpoints (unauthenticated, unthrottled) -------------------


@app.get("/health")
def health() -> Dict[str, str]:
    """Liveness: is the process up at all. See /ready for "has the heavy
    startup work (index/embedder/reranker/LLM client) finished"."""

    return {"status": "ok"}


@app.get("/ready")
def ready() -> Dict[str, str]:
    try:
        get_pipeline()
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the caller
        raise HTTPException(status_code=503, detail=f"Not ready: {exc}") from exc
    return {"status": "ready"}


def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=Path(__file__).resolve().parent, text=True
        ).strip()
    except Exception:  # pragma: no cover - not in a git repo, or git unavailable
        return "unknown"


def _config_hash() -> str:
    return hashlib.sha256(config_fingerprint().encode("utf-8")).hexdigest()[:12]


@app.get("/version")
def version() -> Dict[str, str]:
    return {"git_sha": _git_sha(), "model": config.LLM_MODEL, "config_hash": _config_hash()}


# --- /ask* endpoints (API-key auth + rate limit when configured) ----------


@app.post("/ask", response_model=AskResponse, dependencies=_ask_dependencies)
def ask(request: AskRequest, http_request: Request) -> Dict[str, Any]:
    try:
        return get_pipeline().answer(request.question, request_id=http_request.state.request_id)
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the caller
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}") from exc


def _sse_event(data: Dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _stream_events(question: str, request_id: str) -> Iterator[str]:
    try:
        for chunk in get_pipeline().answer_stream(question, request_id=request_id):
            yield _sse_event({"chunk": chunk})
    except Exception as exc:  # pragma: no cover - defensive, surfaced in-stream
        yield _sse_event({"error": str(exc)})
    yield _sse_event({"done": True})


@app.post("/ask/stream", dependencies=_ask_dependencies)
def ask_stream(request: AskRequest, http_request: Request) -> StreamingResponse:
    """Server-Sent Events: one `data: {"chunk": "..."}` event per token,
    then a final `data: {"done": true}` event. Doesn't return sources
    (see RAGPipeline.answer_stream()'s docstring) -- use /ask for that."""

    return StreamingResponse(
        _stream_events(request.question, http_request.state.request_id),
        media_type="text/event-stream",
    )


@app.post("/ask/structured", response_model=AnswerPayload, dependencies=_ask_dependencies)
def ask_structured(request: AskRequest, http_request: Request) -> AnswerPayload:
    """Same question, validated structured output (answer + citations +
    confidence + abstained) instead of a plain string -- see
    RAGPipeline.answer_structured()'s docstring for the fallback behavior
    when the model doesn't support structured output reliably."""

    try:
        return get_pipeline().answer_structured(
            request.question, request_id=http_request.state.request_id
        )
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the caller
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}") from exc
