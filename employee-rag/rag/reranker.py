"""Cross-encoder reranking.

The hybrid retriever's fused ranking is a decent shortlist but RRF scores
aren't true relevance scores — they just reflect rank agreement. A
cross-encoder reads the (query, chunk) pair jointly and scores actual
relevance, which is far more precise than bi-encoder cosine similarity or
BM25 alone. We use it to re-order the shortlist and to decide what's
irrelevant enough to drop before it ever reaches the LLM.
"""

from typing import List, Tuple

from sentence_transformers import CrossEncoder

from rag import config
from rag.retrieval import Candidate

_model = None


def get_reranker() -> CrossEncoder:
    global _model
    if _model is None:
        _model = CrossEncoder(config.RERANKER_MODEL)
    return _model


def rerank(query: str, candidates: List[Candidate]) -> List[Tuple[Candidate, float]]:
    """Score each candidate against the query and return them sorted, highest first."""

    if not candidates:
        return []

    model = get_reranker()
    pairs = [(query, c.text) for c in candidates]
    scores = model.predict(pairs)

    scored = list(zip(candidates, (float(s) for s in scores)))
    scored.sort(key=lambda pair: pair[1], reverse=True)

    return scored
