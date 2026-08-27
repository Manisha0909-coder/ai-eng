"""End-to-end RAG pipeline: hybrid retrieve -> rerank -> generate.

Single source of truth used by both api.py and eval/run_eval.py, so what
gets evaluated is exactly what gets served.
"""

import re
import time
from typing import Any, Dict, List

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from rag import config
from rag.ingest import build_vectorstore
from rag.reranker import rerank
from rag.retrieval import HybridRetriever

NO_ANSWER = "I don't have enough information to answer that."
GENERATION_ERROR = "The answer service is temporarily unavailable. Please try again."

# openrouter/free occasionally routes to a backend that returns a moderation
# stub instead of a real completion (seen in practice: "User Safety: safe").
# Anything this short, or matching that pattern, is treated as an invalid
# response worth retrying rather than shown to the user as-is.
_INVALID_RESPONSE_PATTERN = re.compile(r"^\s*user\s*safety\s*:", re.IGNORECASE)
_MIN_VALID_RESPONSE_LENGTH = 5

_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an employee policy assistant.

Answer the user's question using ONLY the provided context.

If the answer is not present in the context,
say: "I don't have enough information to answer that."

Do not make up information."""
    ),
    (
        "human",
        """Context:
{context}

Question:
{question}"""
    )
])


class RAGPipeline:
    """Loads the index and model once, then answers many questions cheaply."""

    def __init__(self):
        vectorstore = build_vectorstore()
        self.retriever = HybridRetriever(vectorstore)

        self.llm = ChatOpenAI(
            model=config.LLM_MODEL,
            base_url=config.LLM_BASE_URL,
            api_key=config.OPENROUTER_API_KEY,
        )
        self.chain = _PROMPT | self.llm | StrOutputParser()

    @staticmethod
    def _is_valid_response(text: str) -> bool:
        if not text or len(text.strip()) < _MIN_VALID_RESPONSE_LENGTH:
            return False
        if _INVALID_RESPONSE_PATTERN.match(text):
            return False
        return True

    def _generate(self, context: str, question: str) -> str:
        """Invoke the LLM, retrying if the free-tier router returns a
        moderation stub instead of an actual answer."""

        last_response = ""

        for attempt in range(config.GENERATION_MAX_RETRIES):
            last_response = self.chain.invoke({"context": context, "question": question})

            if self._is_valid_response(last_response):
                return last_response

            if attempt < config.GENERATION_MAX_RETRIES - 1:
                time.sleep(config.GENERATION_RETRY_BACKOFF_SECONDS)

        print(f"WARNING: generation kept returning invalid responses; last one: {last_response!r}")
        return GENERATION_ERROR

    def answer(self, question: str) -> Dict[str, Any]:
        t0 = time.perf_counter()

        candidates = self.retriever.retrieve(question)
        retrieval_ms = (time.perf_counter() - t0) * 1000

        t1 = time.perf_counter()
        shortlist = candidates[: config.RERANK_CANDIDATES]
        reranked = rerank(question, shortlist)
        rerank_ms = (time.perf_counter() - t1) * 1000

        relevant = [
            (candidate, score)
            for candidate, score in reranked
            if score > config.RERANK_SCORE_THRESHOLD
        ][: config.FINAL_TOP_K]

        sources = [
            {
                "source": candidate.source,
                "text": candidate.text,
                "rerank_score": round(score, 4),
                "vector_rank": candidate.vector_rank,
                "bm25_rank": candidate.bm25_rank,
            }
            for candidate, score in relevant
        ]

        if not relevant:
            return {
                "answer": NO_ANSWER,
                "sources": [],
                "timings_ms": {
                    "retrieval": round(retrieval_ms, 1),
                    "rerank": round(rerank_ms, 1),
                    "generation": 0.0,
                    "total": round(retrieval_ms + rerank_ms, 1),
                },
            }

        context = "\n\n".join(c.text for c, _ in relevant)

        t2 = time.perf_counter()
        generated = self._generate(context, question)
        generation_ms = (time.perf_counter() - t2) * 1000

        return {
            "answer": generated,
            "sources": sources,
            "timings_ms": {
                "retrieval": round(retrieval_ms, 1),
                "rerank": round(rerank_ms, 1),
                "generation": round(generation_ms, 1),
                "total": round(retrieval_ms + rerank_ms + generation_ms, 1),
            },
        }


_pipeline = None


def get_pipeline() -> RAGPipeline:
    """Process-wide singleton so the embedding/reranker/LLM clients load once."""

    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline
