# Eval Methodology

## Dataset construction

`eval/golden_dataset.json`, built by `eval/build_golden_dataset.py` (a
one-time generator, re-run only if the dataset itself needs rebuilding
from scratch — not part of the normal eval loop):

- **52 original examples** (`origin: "v1"`), covering annual/sick/
  maternity leave, WFH, IT security, expenses, code of conduct, and
  out-of-scope questions, against the original 4-document corpus.
- **68 new examples** (`origin: "v2"`), added once the corpus grew to 24
  documents (`documents/extended/`), across 7 categories chosen to
  exercise that corpus's *deliberate* hard cases rather than invent
  artificial ones:
  - `extended_docs` (16): one straightforward fact per new document.
  - `numeric_near_miss` (10): a binary-choice question between two
    plausible numbers from different documents (e.g. "Is the home-office
    stipend 15,000 or 8,000?").
  - `cross_document_conflict` (6): current vs. superseded policy
    (`documents/extended/archive/`).
  - `paraphrase_no_overlap` (10): phrased with no literal keyword overlap
    with the expected answer, to test retrieval beyond keyword matching.
  - `out_of_scope_near_miss` (8): sounds like a policy question, isn't
    actually covered (e.g. a US-only benefit asked about for an
    India-based employee).
  - `multi_hop` (8): requires combining facts from 2+ documents.
  - `multi_turn` (10): a follow-up question that only makes sense given
    prior conversation history (`history` field).

## Dev/test split

Stratified per category, ~50/50, via a **fixed, documented seed (42)**
in `_assign_splits()`. This is the structural form of "tune on dev,
report on test" — a fix validated by checking its effect on the dev
split shouldn't be re-validated against the same split to decide it's
real; the test split exists so that check is possible. Current split:
61 dev / 59 test.

**Known limitation**: a random (even seeded) split balances *category
counts*, not *difficulty* — dev and test can and do show different
numbers for the same metric (see `docs/ABLATION.md`'s honest reading of
why hybrid+rerank's hit@3 differs between dev and test). On a dataset
this size (120), that's sampling noise to expect, not leakage to chase.

## Metrics

**Retrieval (document-level, `eval/run_eval.py`)**:
`retrieval_hit_rate` — did the expected source document make it into the
final reranked context.

**Retrieval (chunk-level, `eval/run_ablation.py`)**: `hit@k` / `recall@k`
/ `context_precision@k`, computed against `expected_chunk_substring`
(the literal text of the chunk that actually contains the answer, not
just its document) — stricter than document-level, and the only way to
catch "right document, wrong chunk" on a corpus with multiple chunks per
document. For `multi_hop` items, `expected_chunk_substring` is a list;
`hit` requires *all* of them found among the top-k, `recall` gives
partial credit for finding some.

**Generation**:
- `answer_accuracy` — `_contains_all()`: every required term found,
  where a term can be a plain string or a list of accepted phrasings
  (an OR-match, still fully deterministic).
- `abstention_accuracy` — for unanswerable questions, did the system
  say "I don't have enough information" instead of hallucinating.
- `grounded_rate` (`rag/groundedness.py`) — does every number/date in
  the answer appear somewhere in the retrieved context. Deterministic
  substring check, not semantic grounding — a correct answer that
  derives a number via reasoning the context doesn't state verbatim
  (see Failure #6 in `docs/FAILURE_ANALYSIS.md`) can be flagged even
  though it's right.
- `judge_human_agreement` (optional, `--judge`) — LLM-as-judge
  (faithfulness + relevance), off by default since it costs an extra
  live call per item. **Not yet calibrated**: `eval/judge_calibration.json`
  is a 15-item template awaiting hand-labeling; until that's done,
  "judge agreement" measures agreement between two scoring methods, not
  agreement with ground truth.

## What's real right now, and what's still pending

Being precise about this matters more than a clean-looking number:

- **Current and verified**: the chunk-level retrieval ablation (dev
  hit@3 74.0%, test hit@3 89.6% — `eval/ablation_report.json`), run
  fresh against the current 120-item dataset and current code, no LLM
  calls needed.
- **Stale, not current**: `eval/report.json`'s "100% overall accuracy"
  figure is from a `run_eval.py` invocation against the **original
  52-example dataset**, before the corpus/dataset expansion and before
  every change in this round (guardrails, injection defense, structured
  output, query rewriting). It is not a claim about the current system
  and shouldn't be read as one.
- **Not yet run**: a full `run_eval.py` pass against the current 120-item
  dataset (dev+test), the multi-turn before/after comparison
  (`--rewrite`), and the red-team suite's first-ever live run. All three
  need live OpenRouter calls; the account's shared daily cap was
  exhausted by earlier testing this session (see Failure #5). Needs
  ~145 calls total (120 eval + 25 red-team), which exceeds the 40/day
  cap on its own — expect this to span 2+ days once resumed, using
  `--resume` (which is just "run again"; results are cached, nothing is
  lost between attempts).

## Known limitations of the eval approach itself

- **String matching, not semantic judging**: `answer_must_contain` (even
  with variant groups) is substring matching. It will miss a correct
  answer phrased in a genuinely new way, and will pass a technically-
  matching substring embedded in an otherwise wrong answer. The optional
  judge pass exists to catch more of both, but isn't calibrated yet.
- **Small corpus**: 24 fictional documents. Numbers here don't predict
  behavior on a corpus with real-world scale or ambiguity.
- **Free-tier non-determinism**: `openrouter/free` routes across
  whichever models are currently available; the same question can score
  differently on different runs (Failure #6). Single-run numbers are a
  snapshot, not a guarantee.
