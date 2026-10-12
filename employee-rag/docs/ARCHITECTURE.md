# Architecture

## End-to-end flow

```mermaid
flowchart TD
    U[User question] --> IG[input_guard node<br/>length cap, injection heuristic,<br/>PII redaction for logging]
    IG -->|blocked| END1[Friendly refusal]
    IG -->|ok| RW[rewrite node<br/>multi-turn only: standalone<br/>question via rag/rewrite.py]
    RW --> R[router node<br/>LLM decides: answer directly<br/>or call the RAG tool]
    R -->|tool call| T[search_employee_policies tool]
    R -->|direct answer| OG
    T --> RAG[RAG pipeline]
    RAG --> T
    T --> R
    R --> OG[output_guard node<br/>system-prompt-leak check,<br/>groundedness check]
    OG --> END2[Final answer]

    subgraph RAG pipeline [rag/pipeline.py]
        direction TB
        VEC[Vector search<br/>Chroma or pgvector] --> RRF[Reciprocal Rank Fusion]
        BM25[BM25 lexical search] --> RRF
        RRF --> CE[Cross-encoder reranking]
        CE --> THRESH{score > threshold?}
        THRESH -->|yes| CTX[Build delimited context<br/>strip injection-like lines]
        THRESH -->|no| ABSTAIN[Abstain: no relevant context]
        CTX --> GEN[LLM generation<br/>context-grounded]
    end
```

## Why hybrid retrieval + reranking

Dense embeddings catch semantic paraphrases ("time off for a new baby" →
*Maternity Leave*) that BM25 misses; BM25 catches exact terms/numbers
embeddings can blur ("12 weeks" vs "10 days"). Fusing both with
Reciprocal Rank Fusion (`rag/retrieval.py`) is more robust than either
alone. A cross-encoder (`rag/reranker.py`) then re-scores the fused
shortlist against true (query, passage) relevance before anything
reaches the LLM — RRF scores are a rank-agreement heuristic, not a
relevance score.

On the original 4-document corpus, hybrid alone already got every
question right, so reranking had nothing to improve. On the current
24-document corpus (`documents/extended/`, added specifically to surface
this), reranking now visibly earns its place: at k=3, hybrid+rerank
beats hybrid-RRF-alone on both splits (dev: 74.0% vs 66.0% hit@3; test:
89.6% vs 83.3%) — see `docs/ABLATION.md`.

## Vector store abstraction

`rag/vectorstore_protocol.py` defines the two methods `HybridRetriever`
actually needs (`get()`, `similarity_search()`). `rag/ingest.py`'s
`build_vectorstore()` returns either a Chroma store (default, used by
the deployed demo) or a `PgVectorStore` (local-only, `VECTOR_BACKEND=
pgvector`) — everything downstream is unchanged either way. See
`docs/VECTOR_BACKENDS.md` for the design trade-off (vector-only in
Postgres; BM25/RRF stay in Python for both backends) and the benchmark.

## Guardrails and injection defense

`rag/guardrails.py` holds the shared primitives (PII redaction, length
cap, injection-phrase heuristics, system-prompt-leak check), used in two
places:

- **Context sanitization** (`rag/pipeline.py`): each retrieved chunk has
  injection-like lines stripped before it reaches the prompt, and the
  prompt itself delimits context (`<context>...</context>`) with an
  explicit "this is data, not instructions" framing. Defense in depth —
  neither layer is a replacement for the other.
- **Agent graph nodes** (`agent/graph.py`): `input_guard` (blocks
  overlong/injection-like input, redacts PII before it's logged to
  Langfuse) and `output_guard` (catches a system-prompt leak or an
  ungrounded answer after a tool call, swapping in a safe fallback
  message) run as explicit, traced nodes in the graph — not buried
  inside `router_node`'s logic.

The red-team suite (`eval/redteam.json`, 25 cases) exercises both layers
independently: `injection_in_context` cases call
`RAGPipeline._generate()` directly with a poisoned context, bypassing
retrieval, to test the prompt-framing defense in isolation without
planting attack text in the real (recruiter-facing) corpus.

## Structured output and the fallback it needs

`RAGPipeline.answer_structured()` uses LangChain's
`with_structured_output()` to get a validated `AnswerPayload` (answer +
citations + confidence + abstained) instead of a plain string. Because
`openrouter/free` routes across models with uneven function-calling
support, this has a bounded retry that falls back to the plain-text path
after `GENERATION_MAX_RETRIES` failures — wrapped into the *same* schema
with citations taken deterministically from the retrieved sources, not
invented by the model. Exposed as `POST /ask/structured`; the Gradio
demo doesn't use it (see the streaming note below for why the agent path
stays simpler).

## Streaming: two different answers for two different questions

`RAGPipeline.answer_stream()` is real token-level streaming (used by
`POST /ask/stream`) — it skips the moderation-stub retry (incompatible
with tokens already shown to the user) as a stated, deliberate
trade-off. The Gradio demo's `respond()` is a generator too, but
deliberately does a *simulated* chunked reveal of the agent's complete
answer, not true per-token agent streaming: the router's tool-routing
decision happens via a single `.invoke()` call, and getting real
streaming through that would mean restructuring it around LangGraph's
"messages" stream mode with real risk of subtly changing routing
behavior — a risk this project's free-LLM-budget rule makes hard to
verify live before shipping. The lower-risk, honestly-labeled choice was
preferred over an unverified "real" one.

## Query rewriting

`rag/rewrite.py`'s `rewrite_query()` turns a multi-turn follow-up +
history into a standalone question before retrieval, with a
deterministic fallback to the raw question on any failure. Wired into
`agent/graph.py` as a `rewrite` node that runs once, before the router
loop starts (not on every tool-call iteration), and into
`eval/run_eval.py` as an opt-in `--rewrite` flag so its effect on the
golden dataset's `multi_turn` category is measurable independent of the
full agent.

## Eval harness

`eval/golden_dataset.json`: 120 examples (52 original, "v1"; 68 added
for this round, "v2", across 7 new categories grounded in the extended
corpus's deliberate hard cases — multi-hop, numeric near-miss,
cross-document conflict, paraphrase-with-no-keyword-overlap,
out-of-scope-near-miss, multi-turn). A fixed-seed (42) stratified
dev/test split. See `docs/EVAL_METHODOLOGY.md` for the full design and
known limitations.

`eval/run_eval.py`: deterministic string-match scoring plus an optional
LLM-judge pass (`eval/judge.py`, off by default) and a deterministic
groundedness check (`rag/groundedness.py`). Every result is cached on
disk (`eval/cache.py`), which is what makes `--resume` work — there's no
separate resume state, re-running just serves cached items instantly and
respects `--max-calls`/pacing for new ones. A 429 stops the run
immediately rather than retrying into more 429s.

`eval/run_ablation.py`: retrieval-only (no LLM calls), chunk-level
hit@k/recall@k/MRR/context-precision across a k-sweep and a chunk-size
sweep, per split. `eval/ci_ablation_gate.py` runs this in CI and fails if
`hybrid_rerank`'s dev-split hit@3 drops more than 3 points versus the
committed baseline.

## CI/CD and deployment

`.github/workflows/ci.yml` (push/PR): lint, format check, offline tests,
the ablation regression gate — no LLM calls, no secrets needed.
`.github/workflows/nightly-eval.yml` (weekly + manual): the live
test-split eval and red-team suite, needs `OPENROUTER_API_KEY` as a repo
secret.

Deployed via `scripts/deploy.sh` (imperative, already run against the
live Cloud Run service) or, declaratively, `terraform/` — written,
formatted, and validated, but never applied (see `docs/IAC.md` for why
applying it now would conflict with the already-running imperative
deployment).
