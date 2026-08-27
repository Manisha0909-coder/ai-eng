# employee-rag

A retrieval-augmented Q&A service over employee policy documents (leave,
IT/security, expenses, code of conduct), with hybrid search, cross-encoder
reranking, a FastAPI endpoint, an eval suite with a golden dataset, and a
Docker image ready to deploy.

## Architecture

```
Question
   │
   ├─► Vector search (Chroma + all-MiniLM-L6-v2)   ─┐
   │                                                 ├─► Reciprocal Rank Fusion
   └─► BM25 lexical search (rank_bm25)              ─┘         │
                                                                 ▼
                                          Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
                                                                 │
                                                score > threshold? ──► drop irrelevant chunks
                                                                 │
                                                                 ▼
                                    LLM generation (OpenRouter, context-grounded, must abstain
                                                    if the answer isn't in the retrieved context)
```

Why hybrid + reranking instead of plain vector search: dense embeddings
catch semantic paraphrases ("time off for a new baby" → *Maternity Leave*)
that BM25 misses, while BM25 catches exact terms/numbers that embeddings
can blur ("12 weeks" vs "10 days"). Fusing both rankings with RRF is more
robust than either alone — see `rag/retrieval.py`. RRF's fused score is
only a rank-agreement heuristic, though, so a cross-encoder reranks the
shortlist against true (query, passage) relevance before anything reaches
the LLM — see `rag/reranker.py`.

## Structure

```
rag/
  config.py       - all tunable parameters in one place
  ingest.py       - loads documents/, chunks, embeds, persists to Chroma (idempotent)
  retrieval.py    - HybridRetriever: vector + BM25 fused with RRF
  reranker.py     - cross-encoder reranking
  pipeline.py     - retrieve -> rerank -> generate, with retry on flaky LLM responses
api.py            - FastAPI service (/health, /ask)
eval/
  golden_dataset.json  - 19 hand-written Q&A pairs across 8 categories, incl. 5
                          deliberately out-of-scope questions to test abstention
  run_eval.py          - scores retrieval hit rate, answer accuracy, abstention
                          accuracy, latency; --fail-under for CI gating
documents/        - source policy .txt files (edit/add freely, ingest picks up any *.txt)
Dockerfile, docker-compose.yml, .dockerignore
app.py, app2.py, app3.py - original exploratory scripts, kept as-is
```

## Setup

```bash
cd employee-rag
source .venv/bin/activate      # or: python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Add your OpenRouter key to `.env`:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

## Running the API

```bash
uvicorn api:app --reload
# -> http://127.0.0.1:8000/docs for interactive Swagger UI
```

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How many days of annual leave do I get?"}'
```

## Running the eval suite

```bash
python -m eval.run_eval                    # prints a report, writes eval/report.json
python -m eval.run_eval --fail-under 0.9   # exit 1 if overall accuracy drops below 90% (CI gate)
```

Metrics: retrieval hit rate (did the right source document make the
final context?), answer accuracy (does the answer contain the expected
fact), abstention accuracy (does the system correctly say "I don't have
enough information" on the 5 out-of-scope questions instead of
hallucinating), plus per-category breakdown and p95 latency.

Current baseline: **100% overall accuracy** across all 19 examples (see
`eval/report.json` for the full per-question breakdown).

Note: `openrouter/free` is OpenRouter's auto-router across whichever free
models are currently available, and it occasionally returns a moderation
stub instead of a real completion. `rag/pipeline.py` detects and retries
that case (`GENERATION_MAX_RETRIES` in `rag/config.py`) — the eval suite
is what caught this in the first place.

## Running with Docker

```bash
docker build -t employee-rag-api .
docker run -p 8000:8000 --env-file .env employee-rag-api
```

or

```bash
docker compose up --build
```

The embedding and reranker models are downloaded at **build time** so
container startup doesn't depend on the network; the vector index is
(re)built from `documents/` on container **startup**, keyed off a content
hash so it only re-embeds when the documents actually change.

## Deployment

See the deployment notes in the repo (or ask for a specific target —
Render, Fly.io, Railway, Hugging Face Spaces, Cloud Run all work with
this Dockerfile as-is; they differ in how secrets and free-tier limits
are configured).
