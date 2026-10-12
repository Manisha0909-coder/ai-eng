"""Hybrid retrieval: dense vector search (Chroma) + sparse lexical search (BM25),
combined with Reciprocal Rank Fusion (RRF).

Vector search catches semantic paraphrases ("time off for a new baby" ->
"Maternity Leave"). BM25 catches exact terms and numbers that embeddings
can blur together (e.g. "12 weeks" vs "10 days"). Fusing both ranks is more
robust than either alone, especially on a small, jargon-heavy corpus like
this one.
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

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


# A word token, or a hyphenated compound of them (so "12-weeks" and
# "well-being" survive as single tokens rather than being split apart).
_TOKEN_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

# Suffixes stripped longest-first so "companies" doesn't match "s" before
# "ies" gets a chance. Deliberately crude (no NLTK/spaCy download) -- the
# goal is folding simple plural/verb-form variants together for BM25
# token overlap, not producing real dictionary stems.
_STEM_SUFFIXES = ("ies", "es", "ing", "ed", "s")
_MIN_STEM_LENGTH = 3


def _light_stem(token: str) -> str:
    if token.isdigit() or "-" in token:
        return token
    for suffix in _STEM_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= _MIN_STEM_LENGTH:
            return token[: -len(suffix)]
    return token


def _tokenize(text: str) -> List[str]:
    return [_light_stem(t) for t in _TOKEN_RE.findall(text.lower())]


def _matches_filter(doc: Document, metadata_filter: Dict[str, str]) -> bool:
    return all(doc.metadata.get(key) == value for key, value in metadata_filter.items())


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

    def _bm25_search(
        self, query: str, top_k: int, metadata_filter: Optional[Dict[str, str]] = None
    ) -> List[Tuple[Document, int]]:
        if not self._bm25:
            return []

        scores = self._bm25.get_scores(_tokenize(query))
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        ranked_docs = [self._documents[i] for i in ranked_indices]

        if metadata_filter:
            ranked_docs = [d for d in ranked_docs if _matches_filter(d, metadata_filter)]

        return [(doc, rank) for rank, doc in enumerate(ranked_docs[:top_k])]

    def _vector_search(
        self, query: str, top_k: int, metadata_filter: Optional[Dict[str, str]] = None
    ) -> List[Tuple[Document, int]]:
        # Chroma's own metadata filter (`filter=`) would be more efficient, but
        # going through the same post-hoc filtering path as BM25 keeps rank
        # semantics identical between the two retrievers -- rank 0 is always
        # "best match that also passed the filter," not "best match overall,
        # minus however many got dropped."
        results = self.vectorstore.similarity_search(query, k=top_k)

        if metadata_filter:
            results = [d for d in results if _matches_filter(d, metadata_filter)]

        return [(doc, rank) for rank, doc in enumerate(results)]

    def retrieve(
        self,
        query: str,
        vector_top_k: int = config.VECTOR_TOP_K,
        bm25_top_k: int = config.BM25_TOP_K,
        rrf_k: int = 60,
        metadata_filter: Optional[Dict[str, str]] = None,
    ) -> List[Candidate]:
        """Run both retrievers and fuse their rankings with RRF.

        RRF score for a document = sum over retrievers of 1 / (rrf_k + rank).
        Documents found by both retrievers naturally rise to the top.

        metadata_filter: optional exact-match constraints (e.g.
        {"category": "hr"}). When given, each retriever searches a wider
        internal candidate set (4x top_k) before filtering and re-ranking --
        filtering a narrow top_k first would silently drop matches that
        rank just outside it but would otherwise pass the filter.
        """

        search_vector_k = vector_top_k * 4 if metadata_filter else vector_top_k
        search_bm25_k = bm25_top_k * 4 if metadata_filter else bm25_top_k

        candidates: Dict[str, Candidate] = {}

        for doc, rank in self._vector_search(query, search_vector_k, metadata_filter):
            if rank >= vector_top_k:
                continue
            key = doc.page_content
            candidates.setdefault(key, Candidate(document=doc)).vector_rank = rank

        for doc, rank in self._bm25_search(query, search_bm25_k, metadata_filter):
            if rank >= bm25_top_k:
                continue
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
