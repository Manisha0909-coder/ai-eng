# employee-rag

A retrieval-augmented Q&A service over employee policy documents (leave,
IT/security, expenses, code of conduct), with hybrid search, cross-encoder
reranking, a FastAPI endpoint, a LangGraph agent, an eval suite with a
52-example golden dataset and a retrieval ablation table, and a Docker
image ready to deploy.

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

**Retrieval ablation** (`eval/run_ablation.py`, run offline against the 38
answerable questions in the golden dataset — no LLM calls, so it's fast and
deterministic):

| Config | Hit rate | MRR |
|---|---|---|
| Vector-only | 94.7% | 0.930 |
| BM25-only | 89.5% | 0.851 |
| Hybrid (RRF) | 97.4% | 0.943 |
| Hybrid + rerank | 97.4% | 0.943 |

Hybrid beats either retriever alone, confirming the design above. Reranking
doesn't move hit-rate/MRR further on *this* corpus at k=3 — those metrics
only check whether the right document made the top-3, and RRF already gets
there most of the time here. Reranking's actual job in production is
different: dropping irrelevant chunks via `RERANK_SCORE_THRESHOLD` before
they ever reach the LLM, which this retrieval-only ablation doesn't measure
(that's what `answer_accuracy` in the full eval suite captures instead).

## Structure

```
rag/
  config.py       - all tunable parameters in one place
  ingest.py       - loads documents/, chunks, embeds, persists to Chroma (idempotent)
  retrieval.py    - HybridRetriever: vector + BM25 fused with RRF
  reranker.py     - cross-encoder reranking
  pipeline.py     - retrieve -> rerank -> generate, with retry on flaky LLM responses
api.py            - FastAPI service (/health, /ask)
agent/
  tools.py        - wraps rag/pipeline.py as a LangChain tool
  graph.py        - LangGraph agent: router decides tool-call vs. direct answer,
                    with an enforced step limit
  cli.py          - manual REPL: python -m agent.cli
eval/
  golden_dataset.json  - 52 hand-written Q&A pairs across 8 categories (incl. 14
                          out-of-scope/near-miss questions to test abstention),
                          with numeric near-misses, cross-document distractors,
                          and applied/compound questions for harder coverage
  run_eval.py          - scores retrieval hit rate, answer accuracy, abstention
                          accuracy, latency; --fail-under for CI gating
  run_ablation.py      - retrieval-only ablation across 4 configs (vector-only,
                          BM25-only, hybrid RRF, hybrid+rerank); no LLM calls
tests/agent/      - offline routing/step-limit tests (mocked LLM and pipeline)
documents/        - source policy .txt files (edit/add freely, ingest picks up any *.txt)
Dockerfile, docker-compose.yml, .dockerignore
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
python -m eval.run_ablation                # retrieval-only ablation, no LLM calls -- see table above
```

Metrics: retrieval hit rate (did the right source document make the
final context?), answer accuracy (does the answer contain the expected
fact), abstention accuracy (does the system correctly say "I don't have
enough information" on the 14 out-of-scope/near-miss questions instead of
hallucinating), plus per-category breakdown and p95 latency.

Current baseline: **95.0% overall accuracy** on the 40/52 examples that got
a real answer (see `eval/report.json`) — `openrouter/free`'s daily free-tier
cap (50 requests/day, shared across this whole session) was hit mid-run;
`run_eval.py` now records a request that errors out as "not evaluated"
rather than scoring it as wrong, and reports the excluded ids separately so
a partial run stays honest instead of understating real accuracy. Two of the
real (non-error) misses are informative rather than bugs: one is LLM
phrasing variance ("two days" vs. the expected "twice"), the other is a
genuine retrieval miss on a harder paraphrase that overlaps with
`code_of_conduct.txt`'s "Remote Work Conduct" section — exactly the kind of
gap a bigger, harder dataset is meant to surface.

Note: `openrouter/free` is OpenRouter's auto-router across whichever free
models are currently available, and it occasionally returns a moderation
stub instead of a real completion. `rag/pipeline.py` detects and retries
that case (`GENERATION_MAX_RETRIES` in `rag/config.py`) — the eval suite
is what caught this in the first place.

## Running the agent

```bash
python -m agent.cli
```

A LangGraph agent that decides whether a question needs the employee-rag
tool or can be answered directly, with a hard step limit. See `agent/`
above and `tests/agent/` for the (offline, mocked) routing tests.

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
