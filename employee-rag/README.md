# employee-rag

[![CI](https://github.com/Manisha0909-coder/ai-eng/actions/workflows/ci.yml/badge.svg)](https://github.com/Manisha0909-coder/ai-eng/actions/workflows/ci.yml)

**Live demo:** https://employee-rag-gradio-322697991162.us-central1.run.app
(Cloud Run, scales to zero — first request after idling takes ~15-20s to
cold-start; click an example question for an instant cached answer instead.)

![demo screenshot placeholder](docs/demo.gif)
*(replace with an actual screenshot/GIF of the Gradio UI — click through the
example questions and a free-text question to show retrieval + sources)*

A retrieval-augmented Q&A service over employee policy documents (leave,
IT/security, expenses, code of conduct), built as a tour through the
practical surface area of an AI-engineering RAG system, not just a RAG
demo: hybrid search (vector + BM25) with cross-encoder reranking across
two swappable vector-store backends, a LangGraph agent with explicit
input/output guardrails and query rewriting, prompt-injection defense,
structured output with a validated fallback, both real token streaming
and a FastAPI service, a 120-example eval harness (dev/test split,
chunk-level retrieval metrics, an optional LLM-judge pass, a 25-case
red-team suite), CI with a retrieval-regression gate, and both an
imperative deploy script and a (write-only, unapplied) Terraform config
for the same Cloud Run service.

**Further reading**, each focused on one concern:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (diagram + design
trade-offs) ·
[`docs/ABLATION.md`](docs/ABLATION.md) (retrieval ablation detail) ·
[`docs/EVAL_METHODOLOGY.md`](docs/EVAL_METHODOLOGY.md) (dataset, splits,
metrics, what's measured vs. still pending) ·
[`docs/FAILURE_ANALYSIS.md`](docs/FAILURE_ANALYSIS.md) (6 real failures,
before/after) ·
[`docs/INTERVIEW_NOTES.md`](docs/INTERVIEW_NOTES.md) (15 Q&A, real
numbers only) ·
[`docs/VECTOR_BACKENDS.md`](docs/VECTOR_BACKENDS.md) (Chroma vs pgvector) ·
[`docs/IAC.md`](docs/IAC.md) (what the Terraform config would create).

## Architecture

```
Question
   │
   ├─► Vector search (Chroma or pgvector + all-MiniLM-L6-v2)  ─┐
   │                                                            ├─► Reciprocal Rank Fusion
   └─► BM25 lexical search (rank_bm25)                        ─┘         │
                                                                          ▼
                                          Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
                                                                          │
                                                score > threshold? ──► drop irrelevant chunks
                                                                          │
                                                                          ▼
                              Delimited, injection-stripped context ──► LLM generation
                                    (must abstain if the answer isn't in the context)
```

Full diagram (including the agent's guardrail/rewrite nodes) in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Retrieval ablation** (`eval/run_ablation.py`, chunk-level, no LLM
calls — see [`docs/ABLATION.md`](docs/ABLATION.md) for the full k-sweep
and chunk-size sweep):

| Config | dev hit@3 | dev MRR | test hit@3 | test MRR |
|---|---|---|---|---|
| Vector-only | 70.0% | 0.867 | 85.4% | 0.851 |
| BM25-only | 54.0% | 0.658 | 66.7% | 0.675 |
| Hybrid (RRF) | 66.0% | 0.807 | 83.3% | 0.821 |
| Hybrid + rerank | 74.0% | 0.800 | 89.6% | 0.804 |

Honestly: hybrid doesn't win on *every* metric (vector-only's dev MRR,
0.867, beats hybrid+rerank's 0.800 — BM25's crude tokenizer occasionally
drags a lexically-similar wrong document into the fused rank), but
hybrid+rerank wins on hit@3 on both splits, which is the metric that
determines what the LLM actually sees. Reranking visibly earns its place
on *this* corpus (74.0%/89.6% vs. RRF's 66.0%/83.3%) — it didn't on the
original 4-document corpus, where RRF alone already got everything
right. See `docs/FAILURE_ANALYSIS.md` for the real retrieval bug this
ablation caught (`leave-15`) and `docs/ABLATION.md` for why dev and test
differ.

## Results: baseline vs. current

| | Baseline (`docs/BASELINE.md`) | Current |
|---|---|---|
| Documents / chunks | 4 / 24 | 24 / 239 |
| Tests | 14 | 146 |
| Golden dataset | 52 examples | 120 examples (52 original + 68 new), dev/test split |
| Retrieval ablation (hybrid+rerank) | 100.0% hit-rate, 0.974 MRR (document-level, 38 questions) | 74.0%/89.6% hit@3 (dev/test, **chunk-level** — stricter metric, harder corpus) |
| Full generation eval | 100% overall accuracy (52/52) | **Stale** — see below |

**What got worse, and why that's not a regression**: the headline
retrieval number dropped from "100%" to "74–89.6%." Two real, disclosed
reasons, not a hidden decline: (1) the metric itself got stricter —
baseline measured document-level hits across 38 questions; current
measures chunk-level hits (right *chunk*, not just right document)
across a much larger, deliberately harder dataset; (2) the corpus grew
from 4 toy documents to 24 realistic ones with intentional near-misses,
superseded policies, and cross-document ambiguity — see
`docs/FAILURE_ANALYSIS.md` #3 for the specific new misses this surfaced.

**What's genuinely unresolved**: the baseline's "100% overall accuracy"
full-eval number is **not re-measurable as a direct comparison** — it
was run against the original 52-example dataset before every change in
this round, and a fresh full run against the current 120-item dataset
hasn't happened yet (OpenRouter's shared daily cap was exhausted by
testing earlier in this project's development; see
`docs/EVAL_METHODOLOGY.md` for exactly what's pending and why). Treat
the 100% figure as historical context, not a claim about the current
system.

## Structure

```
rag/
  config.py        - all tunable parameters in one place
  ingest.py         - loads documents/ (.txt/.md/.pdf), heading-aware chunking,
                      dispatches to Chroma or pgvector by VECTOR_BACKEND (idempotent)
  retrieval.py      - HybridRetriever: vector + BM25 fused with RRF, metadata filtering
  reranker.py       - cross-encoder reranking
  vectorstore_protocol.py - the minimal interface a vector-store backend needs
  pgvector_store.py - local-only Postgres+pgvector backend (see docker-compose.pgvector.yml)
  pipeline.py        - retrieve -> rerank -> generate (+ streaming + structured-output
                      variants), context sanitization, request timeout, demo quota,
                      Langfuse tracing (spans + cost/latency + request-id metadata)
  schema.py          - Citation/AnswerPayload Pydantic models for structured output
  guardrails.py      - PII redaction, length cap, injection heuristics, system-prompt-leak
                      check -- shared by rag/pipeline.py and agent/graph.py
  groundedness.py    - deterministic "every number in the answer is in the context" check
  rewrite.py         - multi-turn query rewriting, deterministic fallback on failure
  quota.py           - in-memory daily cap on live LLM calls (free-tier survival for the
                      deployed demo; exempts eval/ablation scripts)
api.py               - FastAPI service: /ask, /ask/stream (SSE), /ask/structured,
                      /health, /ready, /version -- optional API-key auth, per-IP rate
                      limit, consistent error JSON, request-id middleware
app.py               - Gradio chat UI (the deployed demo): streaming (chunked reveal),
                      cached example answers, daily quota, PII-redacted trace input
examples_cache.json  - precomputed answers for the example questions (see
                      scripts/precompute_examples.py) -- clicking one is instant,
                      zero LLM calls
agent/
  tools.py          - wraps rag/pipeline.py as a LangChain tool, Sources as a
                      collapsible <details> accordion
  graph.py          - LangGraph agent: input_guard -> rewrite -> router (tool-call
                      loop, step limit) -> output_guard, with quota/timeout guards
  cli.py            - manual REPL: python -m agent.cli
eval/
  golden_dataset.json   - 120 examples (52 original + 68 new, 7 new categories
                          grounded in the extended corpus's hard cases), dev/test split
  build_golden_dataset.py - the (one-time) generator for the dataset above
  run_eval.py           - --split, --max-calls, --repeats, --judge, --rewrite,
                          --resume (cache-based, no separate state), --fail-under
  run_ablation.py       - chunk-level hit@k/recall@k/MRR/context-precision, k-sweep
                          + chunk-size sweep, per split; no LLM calls
  ci_ablation_gate.py   - CI regression gate against eval/baseline_ablation.json
  judge.py / judge_calibration.json - optional LLM-as-judge pass + hand-labeling template
  redteam.json / run_redteam.py - 25 prompt-injection/jailbreak/PII-bait cases
  cache.py              - on-disk response cache keyed by model+question+repeat
  compare.py            - diffs two eval reports per example id
  benchmark_backends.py - Chroma vs pgvector latency + retrieval-metric comparison
tests/              - 146 offline tests (fakes/mocks throughout; pgvector's 4 tests
                      skip automatically when its local container isn't running)
documents/          - 4 original policy .txt files + documents/extended/ (20 more,
                      .md and .pdf, across hr/it/finance/security/archive)
scripts/
  precompute_examples.py - (re-)generates examples_cache.json via the real agent
  make_pdfs.py            - renders 3 of the extended docs to real PDFs
  deploy.sh               - builds + deploys the Gradio demo to Cloud Run (free tier)
  set_budget_alert.sh     - one-time $1/month billing budget alert
terraform/          - write-only Cloud Run config (fmt + validate run; plan/apply
                      never run) -- see docs/IAC.md
.github/workflows/
  ci.yml             - push/PR: lint, format check, offline tests, ablation gate
  nightly-eval.yml    - weekly/manual: live test-split eval + red-team suite
Dockerfile, Dockerfile.gradio, cloudbuild.gradio.yaml, docker-compose.yml,
docker-compose.pgvector.yml, pyproject.toml, requirements*.txt
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

Optionally add Langfuse credentials for tracing (see "Tracing" below) — the app
runs fine without them, tracing just stays disabled. Dev tooling (`ruff`) is
in `requirements-dev.txt`; the local-only pgvector backend's deps are in
`requirements-pgvector.txt` — neither is needed to run the app normally.

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

Also available: `POST /ask/stream` (Server-Sent Events, real token
streaming), `POST /ask/structured` (validated `AnswerPayload` with
citations), `GET /health` / `GET /ready` (liveness/readiness), `GET
/version` (git SHA, model, config hash). Set `API_KEY` in `.env` to
require an `X-API-Key` header on `/ask*` (unset by default, matching the
open demo); every response carries an `X-Request-ID` header, which also
tags the Langfuse trace for that request.

## Running the eval suite

```bash
python -m eval.run_eval                           # full run, both splits
python -m eval.run_eval --split dev                # dev split only
python -m eval.run_eval --max-calls 40 --resume    # cap live calls; re-running continues (cache-based)
python -m eval.run_eval --judge                    # also run the (extra-cost) LLM-judge pass
python -m eval.run_eval --rewrite                  # apply query rewriting to multi_turn items
python -m eval.run_eval --fail-under 0.9           # exit 1 if overall accuracy drops below 90%
python -m eval.run_ablation                        # chunk-level retrieval ablation, no LLM calls
python -m eval.run_redteam                         # 25 prompt-injection/jailbreak/PII-bait cases
python -m eval.compare report_a.json report_b.json # diff two reports per example id
```

Metrics, full definitions in
[`docs/EVAL_METHODOLOGY.md`](docs/EVAL_METHODOLOGY.md): retrieval hit
rate, answer accuracy (string match with accepted-phrasing variants),
abstention accuracy, a deterministic groundedness check, and an optional
LLM-judge pass (off by default, not yet calibrated against human
labels).

**Current state, stated honestly** — see
[`docs/EVAL_METHODOLOGY.md`](docs/EVAL_METHODOLOGY.md) for the full
picture:
- The chunk-level retrieval ablation is current and verified (table
  above), needs no LLM calls.
- A full `run_eval.py` pass against the current 120-item dataset, the
  `--rewrite` before/after comparison on `multi_turn` items, and
  `run_redteam.py`'s first live run are **not yet done** — OpenRouter's
  shared daily cap (`free-models-per-day`, 50/day) was exhausted by
  earlier testing in this project (confirmed via the API's own 429
  response), and the combined ask (~145 calls) exceeds a single day's
  40-call demo budget on its own. `eval/report.json`'s "100% overall
  accuracy" is from a run against the *original* 52-example dataset —
  historical, not a current-system claim.
- `run_eval.py` detects a 429 and stops immediately rather than retrying
  into more of them; nothing from a rate-limited run gets cached, so a
  later `--resume` retry starts clean.

Note: `openrouter/free` is OpenRouter's auto-router across whichever free
models are currently available, and it occasionally returns a moderation
stub instead of a real completion. `rag/pipeline.py` detects and retries
that case (`GENERATION_MAX_RETRIES` in `rag/config.py`), with a
30-second request timeout per attempt (`LLM_REQUEST_TIMEOUT_SECONDS`) after
a hung connection once stalled an eval run for ~20 hours with no error
(`docs/FAILURE_ANALYSIS.md` #4).

## Running the agent

```bash
python -m agent.cli
```

A LangGraph agent: `input_guard` (length cap, injection heuristic, PII
redaction for logging) → `rewrite` (multi-turn follow-ups only) →
`router` (tool-call loop, step limit) → `output_guard`
(system-prompt-leak and groundedness checks). See `agent/` above and
`tests/agent/` for the offline, mocked tests (routing, step-limit,
guardrail nodes).

## Running the Gradio demo

```bash
python app.py
# -> http://127.0.0.1:7860
```

The same LangGraph agent behind a chat UI — this is what's deployed at
the live demo URL at the top of this file. `respond()` is a generator
(Gradio's streaming `ChatInterface`), but it's a **simulated** chunked
reveal of the complete answer, not true token-level agent streaming —
disclosed, not hidden: real per-token streaming through the agent's
tool-routing decision would need restructuring `router_node` around
LangGraph's "messages" stream mode, a real risk to the tested routing
behavior that's hard to verify live under this project's free-LLM-budget
rule. `rag/pipeline.answer_stream()` (used by `/ask/stream`) *is* real
token streaming.

- **Cached examples** — the 6 example questions under the chat box are
  answered from `examples_cache.json`, so clicking one is instant and makes
  zero LLM calls.
- **Daily quota** — `rag/quota.py` caps this process to `DAILY_LIMIT` (40)
  live LLM calls/day; once hit, every further question gets a friendly
  "demo quota reached" message instead of hammering (or getting rate-limited
  by) the shared `openrouter/free` tier. Doesn't apply to `eval`/`run_ablation`.
- **429s and timeouts** degrade to the existing friendly
  `GENERATION_ERROR` message via the same retry loop that handles
  moderation stubs, rather than surfacing a raw error to the user.

## Vector store backends

Chroma (embedded, default, used by the deployed demo) or pgvector
(local-only, `VECTOR_BACKEND=pgvector`, see
`docker-compose.pgvector.yml`), via a shared minimal protocol
(`rag/vectorstore_protocol.py`) — `HybridRetriever` works identically
either way. Verified: identical retrieval metrics on both backends; see
[`docs/VECTOR_BACKENDS.md`](docs/VECTOR_BACKENDS.md) for the design
trade-off and benchmark. This corpus doesn't need pgvector's
scalability — it exists to demonstrate the abstraction, not because
Chroma ran out of room.

## CI/CD

`.github/workflows/ci.yml` (push/PR): ruff lint + format check, offline
tests, and `eval/ci_ablation_gate.py` (fails if the dev-split retrieval
ablation's hit@3 drops more than 3 points vs. the committed baseline) —
no LLM calls, no secrets needed. `.github/workflows/nightly-eval.yml`
(weekly + manual): the live test-split eval and red-team suite, uploaded
as artifacts; needs an `OPENROUTER_API_KEY` repo secret (not yet added).
`.github/workflows/employee-rag-deploy.yml` (pre-existing, push-to-main
only): tests, builds, and pushes a Docker image.

## Tracing

Every call to `RAGPipeline.answer()`/`answer_stream()`/
`answer_structured()` — from the API, the agent, or the eval suite —
produces a [Langfuse](https://langfuse.com) trace, instrumented against
Langfuse's own best-practices guide:

- `retrieve-context` (`retriever`) and `rerank-candidates` (`span`) — latency
  + what each stage returned.
- The generation step as a nested `generation` observation (prompt,
  completion, token usage, cost, latency).
- When called through the agent, `search_employee_policies` shows up as a
  `tool` observation, and the whole agent turn is wrapped as an `agent`
  observation (`run-agent`) — a tool-using turn reads as one coherent tree.
- A request-id (`api.py`'s middleware, or the agent's PII-redacted
  `redacted_input`) attached as trace metadata/input, so a specific HTTP
  response (`X-Request-ID` header) can be found in the Langfuse UI directly.

Traces are tagged by source (`api` / `agent` / `eval` / `gradio-demo` /
`cli` / `redteam`). Setup (free tier, ~2 minutes): sign up at
[langfuse.com/cloud](https://langfuse.com/cloud), copy your project's
public/secret keys, and add to `.env`:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or https://us.cloud.langfuse.com for the US region
LANGFUSE_TRACING_ENVIRONMENT=development       # set to "production" on the deployed Cloud Run service
```

No credentials set → tracing silently disables itself (the SDK logs a
warning, never raises). Note on cost: `openrouter/free` isn't a model
string Langfuse's pricing table recognizes, so generation cost will
likely show as $0/unresolved — latency and token counts are still real.

## Running with Docker

```bash
docker build -t employee-rag-api .
docker run -p 8000:8000 --env-file .env employee-rag-api
```

or `docker compose up --build`. The embedding and reranker models are
downloaded at **build time**; the vector index is (re)built from
`documents/` on container **startup**, keyed off a content+config hash.

## Deployment (Cloud Run, free tier)

The Gradio demo (`Dockerfile.gradio` + `app.py`) is deployed via
`scripts/deploy.sh` (imperative, already run against the live service):

```bash
PROJECT_ID=your-gcp-project ./scripts/deploy.sh
```

Builds with Cloud Build, pushes to Artifact Registry, deploys to Cloud
Run (`--min-instances 0 --max-instances 1 --concurrency 10 --cpu 1
--memory 2Gi --timeout 120 --allow-unauthenticated`), wires in the 3
secrets, grants the service account `secretmanager.secretAccessor`. A
one-time `scripts/set_budget_alert.sh` sets a $1/month billing alert.

**A declarative equivalent exists** (`terraform/`) — written, formatted,
and validated, **never applied**. See
[`docs/IAC.md`](docs/IAC.md) for exactly what it would create and why
applying it now would conflict with the resources `deploy.sh` already
created.

**Staying in each service's free tier:**

| Service | What could cost | How this stays free |
|---|---|---|
| Cloud Run | vCPU-seconds, memory-seconds, requests beyond the free monthly quota | `min-instances 0` + `max-instances 1` + low demo traffic — comfortably inside the always-free tier |
| Cloud Build | build-minutes beyond 120 free/day | One build per deploy (~5-6 min) |
| Artifact Registry | storage, ~$0.10/GB-month | One image; `terraform/`'s cleanup policy (or manual pruning) keeps only the latest |
| Secret Manager | active secret versions / access ops beyond free quota | 3 secrets, orders of magnitude under the free allowance |

## Known limitations

- **Live multi-turn/red-team numbers are pending**, not fabricated — see
  "Running the eval suite" above and `docs/EVAL_METHODOLOGY.md`.
- **Free-tier request caps, two independent ones**: this demo's own
  40/day (`rag/quota.py`) and OpenRouter's shared 50/day across the
  whole account — both real, both can be hit independently.
- **Small, fictional corpus**: 24 documents, entirely made up — don't
  take any number in them as real-world guidance, and don't expect this
  retrieval setup's numbers to generalize to real-world scale/ambiguity.
- **String-match eval**: `answer_must_contain` (with accepted-phrasing
  variants) and the groundedness check are both substring matching, not
  semantic judging — see `docs/EVAL_METHODOLOGY.md` for exactly how that
  can cut both ways.
- **Simulated Gradio streaming**: a chunked reveal of the complete
  answer, not true token-level agent streaming (see "Running the Gradio
  demo" above) — `/ask/stream` is the real thing.
- **LLM judge not calibrated**: `eval/judge_calibration.json` is a
  15-item template awaiting hand-labeling.
- **pgvector is local-only**, not used by the deployed demo, and
  verified equal-but-not-superior to Chroma at this corpus's scale (see
  `docs/VECTOR_BACKENDS.md`) — not a production recommendation to
  switch.
- **Cold starts**: `min-instances 0` means the first request after idling
  can take ~15-20s (container start + model load).
