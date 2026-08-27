"""Central configuration for the RAG pipeline. Everything else imports from here."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DOCUMENTS_DIR = BASE_DIR / "documents"
CHROMA_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "employee_policy"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "openrouter/free")
LLM_BASE_URL = "https://openrouter.ai/api/v1"

CHUNK_SIZE = 200
CHUNK_OVERLAP = 50

# Hybrid retrieval: how many candidates each retriever contributes before fusion.
VECTOR_TOP_K = 10
BM25_TOP_K = 10

# Reranking: how many fused candidates get scored by the cross-encoder,
# and how many of those survive into the final context.
RERANK_CANDIDATES = 8
FINAL_TOP_K = 3

# openrouter/free is OpenRouter's auto-router across whichever free-tier models are
# currently available. It occasionally returns a moderation stub (e.g. "User Safety:
# safe") instead of an actual completion. GENERATION_MAX_RETRIES governs how many
# times pipeline.py will retry a generation call that looks like one of these stubs.
GENERATION_MAX_RETRIES = 3
GENERATION_RETRY_BACKOFF_SECONDS = 1.0

# Cross-encoder relevance scores below this are treated as irrelevant and dropped.
# cross-encoder/ms-marco-MiniLM-L-6-v2 emits raw (unbounded, uncalibrated) logits,
# not probabilities in [0, 1] -- 0.0 is not a meaningful cutoff for it. Spot-checking
# this corpus: genuinely relevant chunks scored as low as -8 on indirect phrasing
# ("time off for a new baby" -> Maternity Leave), while true negatives clustered
# around -11 to -11.4. -10.0 separates those two clusters; the LLM's own
# "answer only from context" instruction is the second line of defense for
# anything that slips through, since no fixed threshold generalizes perfectly.
RERANK_SCORE_THRESHOLD = -10.0
