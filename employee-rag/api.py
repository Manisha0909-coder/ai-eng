"""FastAPI service for the employee policy RAG pipeline.

Run locally:      uvicorn api:app --reload
Run in Docker:     see Dockerfile
Interactive docs:  /docs
"""

import json
from typing import Any, Dict, Iterator, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rag.pipeline import get_pipeline
from rag.schema import AnswerPayload

app = FastAPI(
    title="Employee Policy RAG",
    description="Hybrid search (vector + BM25) with cross-encoder reranking over employee policy documents.",
    version="1.0.0",
)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, examples=["How many days of annual leave do I get?"])


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


@app.on_event("startup")
def _warm_up() -> None:
    """Load the index, embedder, reranker and LLM client once, at startup
    rather than on the first request, so first-request latency stays low."""

    get_pipeline()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> Dict[str, Any]:
    try:
        return get_pipeline().answer(request.question)
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the caller
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}") from exc


def _sse_event(data: Dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _stream_events(question: str) -> Iterator[str]:
    try:
        for chunk in get_pipeline().answer_stream(question):
            yield _sse_event({"chunk": chunk})
    except Exception as exc:  # pragma: no cover - defensive, surfaced in-stream
        yield _sse_event({"error": str(exc)})
    yield _sse_event({"done": True})


@app.post("/ask/stream")
def ask_stream(request: AskRequest) -> StreamingResponse:
    """Server-Sent Events: one `data: {"chunk": "..."}` event per token,
    then a final `data: {"done": true}` event. Doesn't return sources
    (see RAGPipeline.answer_stream()'s docstring) -- use /ask for that."""

    return StreamingResponse(_stream_events(request.question), media_type="text/event-stream")


@app.post("/ask/structured", response_model=AnswerPayload)
def ask_structured(request: AskRequest) -> AnswerPayload:
    """Same question, validated structured output (answer + citations +
    confidence + abstained) instead of a plain string -- see
    RAGPipeline.answer_structured()'s docstring for the fallback behavior
    when the model doesn't support structured output reliably."""

    try:
        return get_pipeline().answer_structured(request.question)
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the caller
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}") from exc
