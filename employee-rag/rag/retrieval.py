"""Hybrid retrieval: dense vector search (Chroma) + sparse lexical search (BM25),
combined with Reciprocal Rank Fusion (RRF).

Vector search catches semantic paraphrases ("time off for a new baby" ->
"Maternity Leave"). BM25 catches exact terms and numbers that embeddings can
blur together (e.g. "12 weeks" vs "10 days"). Fusing both ranks is more
robust than either alone, especially on a small, jargon-heavy corpus like
this one.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple

from langchain_core.documents import Document
from rank_bm25 import BM25Okapi

from rag import config


@dataclass
class Candidate:
    document: Document
    vector_rank: Optional[int] = None
    bm25_rank: Optional[int] = None
    fused_score: float = 0.0

    @property
    def source(self) -> str:
        return self.document.metadata.get("source", "unknown")

    @property
    def text(self) -> str:
        return self.document.page_content


def _tokenize(text: str) -> List[str]:
    return text.lower().split()


class HybridRetriever:
    """Fuses a Chroma vectorstore with an in-memory BM25 index over the same chunks."""

    def __init__(self, vectorstore):
        self.vectorstore = vectorstore

        raw = vectorstore.get(include=["documents", "metadatas"])
        self._documents = [
            Document(page_content=doc, metadata=meta)
            for doc, meta in zip(raw["documents"], raw["metadatas"])
        ]

        corpus = [_tokenize(doc.page_content) for doc in self._documents]
        self._bm25 = BM25Okapi(corpus) if corpus else None

    def _bm25_search(self, query: str, top_k: int) -> List[Tuple[Document, int]]:
        if not self._bm25:
            return []

        scores = self._bm25.get_scores(_tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return [(self._documents[i], rank) for rank, i in enumerate(ranked[:top_k])]

    def _vector_search(self, query: str, top_k: int) -> List[Tuple[Document, int]]:
        results = self.vectorstore.similarity_search(query, k=top_k)
        return [(doc, rank) for rank, doc in enumerate(results)]

    def retrieve(
        self,
        query: str,
        vector_top_k: int = config.VECTOR_TOP_K,
        bm25_top_k: int = config.BM25_TOP_K,
        rrf_k: int = 60,
    ) -> List[Candidate]:
        """Run both retrievers and fuse their rankings with RRF.

        RRF score for a document = sum over retrievers of 1 / (rrf_k + rank).
        Documents found by both retrievers naturally rise to the top.
        """

        candidates: dict[str, Candidate] = {}

        for doc, rank in self._vector_search(query, vector_top_k):
            key = doc.page_content
            candidates.setdefault(key, Candidate(document=doc)).vector_rank = rank

        for doc, rank in self._bm25_search(query, bm25_top_k):
            key = doc.page_content
            candidates.setdefault(key, Candidate(document=doc)).bm25_rank = rank

        for candidate in candidates.values():
            score = 0.0
            if candidate.vector_rank is not None:
                score += 1.0 / (rrf_k + candidate.vector_rank)
            if candidate.bm25_rank is not None:
                score += 1.0 / (rrf_k + candidate.bm25_rank)
            candidate.fused_score = score

        return sorted(candidates.values(), key=lambda c: c.fused_score, reverse=True)
