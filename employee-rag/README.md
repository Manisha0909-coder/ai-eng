# employee-rag

**Live demo:** https://employee-rag-gradio-322697991162.us-central1.run.app
(Cloud Run, scales to zero — first request after idling takes ~15-20s to
cold-start; click an example question for an instant cached answer instead.)

![demo screenshot placeholder](docs/demo.gif)
*(replace with an actual screenshot/GIF of the Gradio UI — click through the
example questions and a free-text question to show retrieval + sources)*

A retrieval-augmented Q&A service over employee policy documents (leave,
IT/security, expenses, code of conduct), with hybrid search, cross-encoder
reranking, a FastAPI endpoint, a LangGraph agent, a Gradio demo deployed to
Cloud Run, Langfuse tracing with cost/latency logging, an eval suite with a
52-example golden dataset and a retrieval ablation table, and Docker images
ready to deploy.

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
| Vector-only | 100.0% | 0.982 |
| BM25-only | 89.5% | 0.838 |
| Hybrid (RRF) | 100.0% | 0.982 |
| Hybrid + rerank | 100.0% | 0.974 |

Hybrid beats BM25 alone, confirming the design above. Hit-rate/MRR only
check whether the right document made the top-3, and vector/hybrid already
get there every time on this corpus — reranking's actual job in production
is dropping irrelevant chunks via `RERANK_SCORE_THRESHOLD` before they ever
reach the LLM, which this retrieval-only ablation doesn't measure (that's
what `answer_accuracy` in the full eval suite captures instead).

One real retrieval bug this ablation caught: `leave-15` ("Am I allowed to
skip the office sometimes and work remotely?") was retrieving
`code_of_conduct.txt`'s "Remote Work Conduct" section instead of
`employee_policy.txt`'s WFH policy, because the WFH chunk never said
"remotely" — only "work from home" — so the cross-encoder scored it below
`RERANK_SCORE_THRESHOLD` while the code-of-conduct chunk (which does say
"remotely") won instead. Fixed by adding that wording to
`documents/employee_policy.txt` without changing the actual policy (still
"twice per week") — see its git history for the exact diff.

## Structure

```
rag/
  config.py       - all tunable parameters in one place
  ingest.py       - loads documents/, chunks, embeds, persists to Chroma (idempotent)
  retrieval.py    - HybridRetriever: vector + BM25 fused with RRF
  reranker.py     - cross-encoder reranking
  pipeline.py     - retrieve -> rerank -> generate, with retry on flaky/429 LLM
                    responses, a request timeout, the demo quota check, and
                    Langfuse tracing (spans + cost/latency per call)
  quota.py        - in-memory daily cap on live LLM calls (free-tier survival
                    for the deployed demo; exempts eval/ablation scripts)
api.py            - FastAPI service (/health, /ask)
app.py            - Gradio chat UI (the deployed demo): cached example answers,
                    daily quota + friendly error messages, Langfuse session
                    tracking, footer linking this repo
examples_cache.json - precomputed answers for the example questions (see
                    scripts/precompute_examples.py) -- clicking one is instant
                    and makes zero LLM calls
agent/
  tools.py        - wraps rag/pipeline.py as a LangChain tool
  graph.py        - LangGraph agent: router decides tool-call vs. direct answer,
                    with an enforced step limit and the same quota/timeout guards
  cli.py          - manual REPL: python -m agent.cli
eval/
  golden_dataset.json  - 52 hand-written Q&A pairs across 8 categories (incl. 14
                          out-of-scope/near-miss questions to test abstention),
                          with numeric near-misses, cross-document distractors,
                          applied/compound questions, and accepted-phrasing
                          variants for facts the model states in equivalent ways
  run_eval.py          - scores retrieval hit rate, answer accuracy, abstention
                          accuracy, latency; --fail-under for CI gating
  run_ablation.py      - retrieval-only ablation across 4 configs (vector-only,
                          BM25-only, hybrid RRF, hybrid+rerank); no LLM calls
tests/            - offline unit tests: agent routing/step-limit, quota, eval
                    matching, Gradio history conversion (mocked LLM/pipeline)
documents/        - source policy .txt files (edit/add freely, ingest picks up any *.txt)
scripts/
  precompute_examples.py - (re-)generates examples_cache.json via the real agent
  deploy.sh              - builds + deploys the Gradio demo to Cloud Run (free tier)
  set_budget_alert.sh    - one-time $1/month billing budget alert
Dockerfile, Dockerfile.gradio, cloudbuild.gradio.yaml, docker-compose.yml, .dockerignore
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
runs fine without them, tracing just stays disabled.

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

Current baseline: **100% overall accuracy, 52/52 examples, 0 errors**
(100% retrieval hit rate, 100% answer accuracy, 100% abstention accuracy;
avg/p95 latency 3.2s/8.0s — see `eval/report.json`). That number is real but
fragile, and worth reading honestly rather than at face value:

- `openrouter/free`'s daily free-tier cap is shared across *everything*
  hitting that key that day. Running the full 52-question suite back-to-back
  more than once or twice in a day reliably exhausts it mid-run — every
  remaining call then returns `GENERATION_ERROR` ("The answer service is
  temporarily unavailable"), which scores as a hard fail, not an abstention.
  An earlier run this session hit exactly that: answer accuracy cratered to
  0% for one pass, recovered to 100% after the daily reset. If you see a
  cluster of `GENERATION_ERROR` answers in a run, that's the free-tier cap,
  not a regression — retry after the reset rather than debugging the pipeline.
- Two specific misses surfaced during iteration and are worth knowing about
  even though the current run is clean: `expense-05` ("Can I fly business
  class for a 3-hour domestic flight?") once got a false abstention — the
  model said "I don't have enough information" instead of reasoning
  3 < 6 hours from the retrieved context — on a free-tier model this kind of
  reasoning miss isn't fully deterministic; a re-run passed. `expense-07`
  failed purely on phrasing ("non-reimbursable" vs. the expected "not
  reimbursable") until `answer_must_contain` was given both as accepted
  variants — a quality-of-eval-harness fix, not a model or retrieval fix.
- The eval suite's own string-matching is intentionally dumb (see "Known
  limitations" below) — a 100% score here means every required fact/phrase
  showed up verbatim (or as a listed variant), not that an LLM judged the
  answers correct.

Note: `openrouter/free` is OpenRouter's auto-router across whichever free
models are currently available, and it occasionally returns a moderation
stub instead of a real completion. `rag/pipeline.py` detects and retries
that case (`GENERATION_MAX_RETRIES` in `rag/config.py`), now with a
30-second request timeout per attempt (`LLM_REQUEST_TIMEOUT_SECONDS`) after
a hung connection once stalled an eval run indefinitely with no error.

## Running the agent

```bash
python -m agent.cli
```

A LangGraph agent that decides whether a question needs the employee-rag
tool or can be answered directly, with a hard step limit. See `agent/`
above and `tests/agent/` for the (offline, mocked) routing tests.

## Running the Gradio demo

```bash
python app.py
# -> http://127.0.0.1:7860
```

The same LangGraph agent behind a chat UI — this is what's deployed at the
live demo URL at the top of this file. A few things only this front end
does, all in `app.py`/`rag/quota.py`:

- **Cached examples** — the 6 example questions under the chat box are
  answered from `examples_cache.json` (precomputed by
  `scripts/precompute_examples.py`), so clicking one is instant and makes
  zero LLM calls.
- **Daily quota** — `rag/quota.py` caps this process to `DAILY_LIMIT` (40)
  live LLM calls/day; once hit, every further question gets a friendly
  "demo quota reached" message instead of hammering (or getting rate-limited
  by) the shared `openrouter/free` tier. Resets on UTC day rollover or a
  cold restart. Doesn't apply to `eval`/`run_ablation` (see above).
- **429s and timeouts** degrade to the existing friendly
  `GENERATION_ERROR` message via the same retry loop that handles
  moderation stubs, rather than surfacing a raw error to the user.

## Tracing

Every call to `RAGPipeline.answer()` — from the API, the agent, or the eval
suite — produces a [Langfuse](https://langfuse.com) trace, instrumented
against Langfuse's own best-practices guide (verb-first stable names,
explicit clean input/output rather than raw function args, and the most
specific correct [observation type](https://langfuse.com/docs/observability/features/observation-types)
for each step):

- `retrieve-context` (`retriever`) and `rerank-candidates` (`span`) — latency
  + what each stage returned.
- The generation step as a nested `generation` observation (prompt,
  completion, token usage, cost, latency) via
  `langfuse.langchain.CallbackHandler`.
- When called through the agent, `search_employee_policies` shows up as a
  `tool` observation (set automatically by the LangChain integration), and
  the whole agent turn is wrapped as an `agent` observation (`run-agent`) in
  `app.py`/`agent/cli.py` — so a tool-using turn reads as one coherent tree:
  agent → router generation → tool → retriever/rerank → generation.

Traces are tagged by where they came from (`api` / `agent` / `eval` /
`gradio-demo` / `cli`) so you can filter production traffic from eval runs
and manual testing in the dashboard. The Gradio demo and CLI also set a
`session_id` (the browser tab's `session_hash`, or a per-REPL-run UUID) so a
multi-turn conversation groups into one session in the Langfuse UI.

Setup (free tier, ~2 minutes): sign up at
[langfuse.com/cloud](https://langfuse.com/cloud), create a project, copy its
public/secret keys from Project Settings → API Keys, and add to `.env`:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or https://us.cloud.langfuse.com for the US region
LANGFUSE_TRACING_ENVIRONMENT=development       # set to "production" on the deployed Cloud Run service
```

No credentials set → tracing silently disables itself (the SDK logs a
warning, never raises) — it's additive, not a hard dependency to run the app.

Note on cost: `openrouter/free` isn't a model string Langfuse's pricing table
recognizes, so generation cost will likely show as $0/unresolved rather than a
real figure — latency and token counts are still real. Worth knowing going in
rather than assuming cost tracking is fully proven out on this particular
model string.

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

## Deployment (Cloud Run, free tier)

The Gradio demo (`Dockerfile.gradio` + `app.py`) is deployed to Google Cloud
Run, region `us-central1`, via `scripts/deploy.sh`:

```bash
PROJECT_ID=your-gcp-project ./scripts/deploy.sh
```

This script (idempotent, safe to re-run on every change):

1. Enables the Run/Build/Artifact Registry/Secret Manager APIs.
2. Creates an Artifact Registry repo if it doesn't exist.
3. Creates/updates 3 Secret Manager secrets (`OPENROUTER_API_KEY`,
   `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`) from local `.env` — values
   are piped over stdin, never logged or committed — and grants Cloud Run's
   service account `secretmanager.secretAccessor` on each.
4. Builds the image with Cloud Build (`cloudbuild.gradio.yaml`) and pushes
   it to Artifact Registry.
5. Deploys to Cloud Run:
   `--min-instances 0 --max-instances 1 --concurrency 10 --cpu 1 --memory 2Gi
   --timeout 120 --allow-unauthenticated`, with
   `LANGFUSE_TRACING_ENVIRONMENT=production` and the 3 secrets wired in as
   env vars.

One-time, separate from every deploy so re-running `deploy.sh` never creates
a duplicate: `PROJECT_ID=... BILLING_ACCOUNT_ID=... ./scripts/set_budget_alert.sh`
sets a $1/month billing budget alert (50/90/100% thresholds).

**Staying in each service's free tier:**

| Service | What could cost | How this stays free |
|---|---|---|
| Cloud Run | vCPU-seconds, memory-seconds, requests beyond the free monthly quota | `min-instances 0` (scales to zero when idle, the deploy script's actual cost-control lever) + `max-instances 1` (caps a traffic spike) + low demo traffic — all comfortably inside Cloud Run's generous always-free tier |
| Cloud Build | build-minutes beyond 120 free/day | One build per deploy (~5-6 min); don't wire this into CI on every push |
| Artifact Registry | storage, ~$0.10/GB-month | One image; prune old digests occasionally (`gcloud artifacts docker images list/delete` — see `deploy.sh`'s own "Housekeeping" output) |
| Secret Manager | active secret versions / access ops beyond free quota | 3 secrets, a handful of versions/accesses — orders of magnitude under the free allowance |

Other targets (Render, Fly.io, Railway, Hugging Face Spaces) work with
`Dockerfile.gradio` as-is; they differ in how secrets and free-tier limits
are configured.

## Known limitations

- **Free-tier request cap**: the live demo caps itself to 40 live LLM
  calls/day (`rag/quota.py`) on top of whatever cap `openrouter/free`
  itself imposes that day — see "Running the eval suite" above for what
  happens when the latter is exhausted mid-eval-run. Both are intentional
  trade-offs for a $0 demo, not bugs.
- **Small, fictional corpus**: 4 policy documents, entirely made up for this
  project — don't take any number in them (leave days, allowances, etc.) as
  real-world guidance, and don't expect this retrieval setup's numbers to
  generalize to a corpus with real ambiguity, longer documents, or many more
  near-duplicate sections.
- **String-match eval**: `answer_must_contain` (with the variant-group
  support added for phrasing differences) is still substring matching, not
  semantic judging. It will miss a correct answer phrased in a genuinely
  new way, and it will pass a technically-matching substring embedded in an
  otherwise wrong answer. An LLM-judge pass would catch more of both; this
  dataset's size (52) keeps it cheap enough that it hasn't been worth adding.
- **Cold starts**: `min-instances 0` means the first request after idling
  can take ~15-20s (container start + model load) before Gradio's own
  "localhost reachable" self-check can also occasionally race a very fresh
  container (worked around via `_frontend=False` in `app.py`, see its
  comment) — expect that latency on a cold demo link, not a hang.
