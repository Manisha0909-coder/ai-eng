"""FastAPI service for the employee policy RAG pipeline.

Run locally:      uvicorn api:app --reload
Run in Docker:     see Dockerfile
Interactive docs:  /docs
"""

from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from rag.pipeline import get_pipeline

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
