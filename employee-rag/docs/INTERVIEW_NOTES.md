# Interview Notes

Decision rationale, known weaknesses, and 15 questions an interviewer is
likely to ask — every answer below is drawn from a real number in this
repo's reports, not an invented one. Where a number has a caveat, the
caveat is included; see `docs/EVAL_METHODOLOGY.md` for what's current
vs. still pending.

## Decision rationale, in brief

- **Hybrid retrieval over vector-only**: not because hybrid always wins
  — it doesn't, see Q3 below — but because it's the more robust default
  across a corpus with both semantic paraphrases and exact numeric
  near-misses, which is exactly what `documents/extended/` was built to
  contain.
- **Chroma by default, pgvector as an alternative, not a replacement**:
  the corpus (239 chunks) doesn't need pgvector's scalability; the
  abstraction (`rag/vectorstore_protocol.py`) exists to demonstrate the
  pattern cleanly, stated explicitly in `docs/VECTOR_BACKENDS.md` rather
  than oversold as a real scaling need.
- **Deterministic checks over an LLM judge, by default**: every core
  metric (`answer_must_contain`, groundedness, red-team pass/fail) is
  string/regex matching, deliberately, so CI and local runs are free and
  reproducible. The LLM judge exists as an *addition*, not a replacement.
- **Guardrails as explicit graph nodes, not inline logic**: `input_guard`
  and `output_guard` are visible, traced steps in `agent/graph.py`, not
  buried inside `router_node` — makes the defense auditable and
  independently testable (13 tests in `tests/agent/test_guardrail_nodes.py`).

## Known weaknesses (stated plainly)

1. The multi-turn query-rewriting improvement and the red-team suite's
   pass rate are **unmeasured live** as of this writing — both ran into
   OpenRouter's daily cap mid-session (see `docs/FAILURE_ANALYSIS.md`
   #5). The code and tests are real; the live numbers aren't yet.
2. `grounded_rate` and `answer_must_contain` are both deterministic
   substring checks — they can be fooled in both directions (missing a
   correct answer phrased unusually, passing a wrong answer that happens
   to contain the right substring).
3. The LLM-judge pass is wired up but not calibrated against human
   labels yet (`eval/judge_calibration.json` is still a template).
4. The Gradio demo's "streaming" is a simulated chunked reveal, not true
   token-level agent streaming — disclosed in code comments and
   `docs/ARCHITECTURE.md`, not hidden.
5. 24 fictional documents. Nothing here predicts behavior at real-world
   corpus scale or ambiguity.

## 15 likely questions

**1. Why hybrid retrieval instead of just vector search?**
BM25 catches exact terms/numbers embeddings blur together. On the dev
split, BM25-only's hit@3 (54.0%) trails hybrid_rrf (66.0%) and
hybrid+rerank (74.0%) — dense embeddings alone aren't enough on a corpus
with numeric near-misses by design.

**2. Does reranking actually help, or is it just extra latency?**
Yes, now — on the *current* corpus. At k=3: dev hit@3 goes from 66.0%
(hybrid RRF) to 74.0% (hybrid+rerank); test from 83.3% to 89.6%. On the
original 4-document corpus, reranking made no measurable difference
(RRF alone already got everything right) — the honest answer is "it
depends on whether the corpus has real near-misses to disambiguate,"
not "reranking always helps."

**3. Is hybrid always better than vector-only?**
No — and that's worth saying directly. On the dev split, vector-only's
MRR (0.867) actually *beats* hybrid+rerank's (0.800). BM25's crude
tokenizer (`rag/retrieval.py`) occasionally pulls in a lexically-similar
wrong document, dragging the fused rank down. Hybrid wins more
consistently at higher k and on hit-rate, not uniformly on every metric.

**4. How do you defend against prompt injection in retrieved documents?**
Two independent layers: (a) `rag/guardrails.strip_injection_like_lines`
removes lines that look like an injected instruction from each chunk
before it reaches the prompt, and (b) the prompt itself delimits context
(`<context>...</context>`) with an explicit "this is data" framing. The
red-team suite's `injection_in_context` cases test layer (b) in
isolation by calling the generation step directly with a poisoned
context, bypassing retrieval — so the test doesn't depend on layer (a)
having already caught it.

**5. What happens if the structured-output call fails?**
`answer_structured()` retries up to `GENERATION_MAX_RETRIES` times, then
falls back to the plain-text generation path, wrapped into the *same*
`AnswerPayload` schema with citations taken deterministically from the
retrieved sources (not invented by the model). `openrouter/free` has
uneven function-calling support across the models it routes to, so this
fallback is the realistic common path, not a rare edge case.

**6. Why does the Gradio demo have a daily call quota?**
It's a shared free resource (`openrouter/free`, 50 requests/day across
the whole account) backing a public demo link. `rag/quota.py` caps the
process to 40 live calls/day so one burst of demo traffic can't lock out
every other use of the same key — including the eval harness, which is
explicitly exempted since it needs to get through a batch run in one
process.

**7. How do you know the demo quota and OpenRouter's own cap don't
double-count or conflict?**
They're independent and both real — the account actually hit
OpenRouter's own 50/day cap once during this project's testing (not from
demo traffic; from eval/benchmark runs), confirmed by the API's own 429
response body (`free-models-per-day`, limit 50, remaining 0). The
demo-quota and OpenRouter-quota are two separate, stacking constraints,
not a simulated one.

**8. What's the one bug that was hardest to find?**
A hung OpenRouter connection with no timeout configured stalled an eval
run for ~20 hours before anyone noticed — the process had burned only
23 seconds of CPU time in that whole span, meaning it was silently
blocked on a network read, not crashed or erroring. Fixed with an
explicit 30-second timeout on both `ChatOpenAI` clients. The "hard" part
wasn't the fix, it was noticing a *silent* hang rather than a loud
failure.

**9. How do you keep CI from spending real LLM budget on every push?**
It doesn't call an LLM at all. `.github/workflows/ci.yml` runs lint,
format check, offline tests, and `eval/ci_ablation_gate.py` — the
retrieval-only ablation, which needs the embedding model but zero
network calls to OpenRouter. Live evaluation is a separate, weekly
workflow (`nightly-eval.yml`) specifically so cost and CI frequency are
decoupled.

**10. Why swap vector backends via an abstraction instead of just using
pgvector everywhere?**
Chroma is the right choice for this project's actual scale (239 chunks)
— embedded, zero infra, fast enough. `rag/vectorstore_protocol.py`'s
abstraction demonstrates the pattern of swapping a backend cleanly
(verified: identical retrieval metrics on both backends, hit@3 = 74.0%
dev on both — see `docs/VECTOR_BACKENDS.md`) without pretending this
corpus actually needed pgvector's scalability.

**11. Why didn't you write Terraform as the primary deployment path?**
The Cloud Run service already exists, deployed imperatively
(`scripts/deploy.sh`) before the Terraform config was written. Applying
Terraform now would conflict with those existing resources
(`terraform apply` would try to create a service/repo with the same
names) without first running `terraform import` — a real, consequential
decision documented in `docs/IAC.md` as a known limitation, not silently
glossed over.

**12. How do you handle a 429 rate-limit during an eval run?**
`run_eval.py` detects it (status code or "429" in the exception message)
and stops making further live calls immediately for that run, recording
remaining items as "skipped," not "errored" or "wrong" — conflating a
rate limit with a real failure would understate accuracy. This is
exactly what happened mid-session (see weakness #1 and
`docs/FAILURE_ANALYSIS.md` #5): the harness behaved as designed.

**13. What's the dev/test split and why does it matter here?**
A fixed-seed (42), per-category stratified ~50/50 split (61 dev / 59
test). It's the structural answer to "don't edit your eval after seeing
the results" — a fix is validated against dev, then checked against test
before being trusted. The honest caveat: on 120 examples, dev and test
show different numbers for the same metric (e.g. hybrid+rerank hit@3:
74.0% dev vs. 89.6% test) — sampling noise on a dataset this size, not
something to over-interpret either direction.

**14. Is the 100% accuracy number in early project notes still true?**
No, and that's stated directly in `docs/EVAL_METHODOLOGY.md`: that
figure is from a run against the *original* 52-example dataset, before
the corpus grew to 24 documents and before every change in this round
(guardrails, structured output, query rewriting). It's a historical
number, not a claim about the current 120-item dataset or current code.
A fresh full run is planned once OpenRouter's daily cap resets.

**15. What would you do differently with more time/budget?**
Calibrate the LLM judge against real human labels
(`eval/judge_calibration.json`) rather than leaving it as a template;
get the live multi-turn and red-team numbers instead of deferring them;
and fine-tune the embedding model on this domain's own near-miss
pairs — deliberately skipped this round (see the original gap-closing
prompt's own note on why: "AI Engineer roles centre on orchestration,
RAG and evals" more than training, and this corpus's scale doesn't
justify the cost/complexity of a training pipeline for the quality gain
it would likely yield).
