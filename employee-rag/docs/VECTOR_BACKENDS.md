# Vector Store Backends

## The abstraction

`rag/vectorstore_protocol.py` defines the minimal interface
`HybridRetriever` (`rag/retrieval.py`) actually needs from a vector
store: `get(include)` (pull every chunk, once, to build the in-memory
BM25 index) and `similarity_search(query, k)`. `langchain_chroma.Chroma`
already satisfies this by duck typing; `rag/pgvector_store.py`'s
`PgVectorStore` implements the same two methods against a local
Postgres+pgvector instance.

`rag/ingest.py`'s `build_vectorstore()` picks the backend via
`config.VECTOR_BACKEND` (`"chroma"`, the default, or `"pgvector"`).
Everything downstream — `HybridRetriever`, `RAGPipeline`, the agent —
is unchanged either way, because both backends return the same shape.

## Design choice: vector-only in Postgres, not full hybrid-in-SQL

The original ask suggested doing hybrid search *inside* Postgres
(pgvector + `tsvector` full-text search). This implementation does
**vector similarity only** in Postgres; the lexical half (BM25) and the
RRF fusion stay exactly where they already were, in Python, for both
backends. Reasoning: these two backends are meant to be interchangeable,
and implementing hybrid search twice (once in Python, once in SQL) for
backends that should behave identically risked drift between them for no
real benefit at this project's scale. Chroma stays the production
default; pgvector exists to demonstrate the pattern of swapping a vector
backend cleanly, not to replace Chroma for this demo's corpus size.

## Running it locally

```bash
docker compose -f docker-compose.pgvector.yml up -d
pip install -r requirements-pgvector.txt   # psycopg + pgvector, not in the main requirements.txt
VECTOR_BACKEND=pgvector python -m rag.ingest
```

`pip install -r requirements-pgvector.txt` is deliberately separate from
`requirements.txt` — the deployed demo (Cloud Run, `Dockerfile.gradio`)
never needs a Postgres client, so this isn't installed in its image.

## Benchmark (`python -m eval.benchmark_backends`)

Dev split, 50 answerable questions, `hybrid_rerank` config, no LLM calls.
Raw numbers in `eval/backend_benchmark.json`.

| | Chroma | pgvector |
|---|---|---|
| Chunks | 239 | 239 |
| Ingest time | 11,611 ms | 10,986 ms |
| Avg query latency | 361.7 ms | 336.1 ms |
| p95 query latency | 668.6 ms | 616.5 ms |
| hit@3 | 0.74 | 0.74 |
| MRR | 0.80 | 0.80 |

**Honest reading:**

- **Retrieval quality is identical**, as it should be — both backends
  embed with the exact same model and feed the exact same Python-side
  BM25/RRF/rerank logic; only the vector-similarity engine differs. A
  mismatch here would have meant a bug in `PgVectorStore`, not a real
  trade-off.
- **pgvector was slightly faster** on both ingest and query latency in
  this run. Take that with real caution: this is a single run on one
  laptop, local Docker vs. an embedded SQLite-backed store, on a
  239-chunk corpus — not a rigorous benchmark, and not a result that
  should generalize. The honest takeaway is "comparable, not a clear
  winner either way at this scale," not "pgvector is faster."
- **Where pgvector would actually start to matter**: a corpus too large
  to fit comfortably in Chroma's embedded index, needing horizontal
  scaling, concurrent writers, or integration with an existing Postgres
  deployment (shared connection pooling, backups, access control already
  solved for other tables) — none of which this project's 24-document,
  239-chunk corpus needs. This exists to show the abstraction works
  cleanly, not because this demo outgrew Chroma.
