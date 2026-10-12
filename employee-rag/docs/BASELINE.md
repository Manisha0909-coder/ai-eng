# Baseline — captured pre-flight, before gap-closing work

Captured on branch `gap-closing`, from commit `007d0a5f4456a835e9eab05771e406b30b790f0d`
(2026-10-12), before any Stage 1+ changes.

## Tests

```
14 passed, 10 warnings in 63.06s
```

## Corpus (pre-Stage-1)

4 documents in `documents/`: `code_of_conduct.txt`, `employee_policy.txt`,
`expense_policy.txt`, `it_security_policy.txt` — 24 chunks total
(`CHUNK_SIZE=200`, `CHUNK_OVERLAP=50`, `RecursiveCharacterTextSplitter`).

## Retrieval ablation (`eval/run_ablation.py`, 38 answerable questions, no LLM calls)

| Config | Hit rate | MRR |
|---|---|---|
| Vector-only | 100.0% | 0.982 |
| BM25-only | 89.5% | 0.838 |
| Hybrid (RRF) | 100.0% | 0.982 |
| Hybrid + rerank | 100.0% | 0.974 |

## Full eval (`eval/run_eval.py`, 52 examples, live LLM calls via `openrouter/free`)

- n_examples: 52, n_errors: 0
- retrieval_hit_rate: 100.0%
- answer_accuracy: 100.0%
- abstention_accuracy: 100.0%
- overall_accuracy: **100.0%**
- avg/p95 latency: 3163.3 ms / 8008.2 ms

This number is real but fragile — see the README's "Running the eval suite"
section for why (shared free-tier daily cap; a run shortly before this one on
the same day scored 0% after the cap was exhausted). No model/dataset hash
tracking exists yet at this baseline — that's part of Stage 2's run-mechanics
work (`eval/reports/`, resolved model name, dataset hash, git SHA per report).

## Known pre-existing gaps this work is closing

See the conversation history / task prompt for the full list: realistic
corpus size, LLM-as-judge eval, chunk-level retrieval metrics, red-teaming,
streaming, structured output, guardrails, query rewriting, CI gating,
API hardening, a second vector-store backend, Terraform (write-only), and
(explicitly out of scope) fine-tuning.
