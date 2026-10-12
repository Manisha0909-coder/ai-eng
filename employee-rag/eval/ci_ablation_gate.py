"""CI regression gate: re-runs the dev-split retrieval ablation (no LLM
calls, fast and deterministic) and fails if hybrid_rerank's hit@3 drops
more than 3 percentage points versus the committed baseline
(eval/baseline_ablation.json) -- catches a retrieval regression (a bad
chunking change, a config tweak that quietly hurts recall) before it
ships, without spending any LLM budget. Run on every push/PR via
.github/workflows/ci.yml.

Usage:
    python -m eval.ci_ablation_gate
"""

import json
import sys
from pathlib import Path

from eval.run_ablation import run

EVAL_DIR = Path(__file__).resolve().parent
DATASET_PATH = EVAL_DIR / "golden_dataset.json"
BASELINE_PATH = EVAL_DIR / "baseline_ablation.json"

REGRESSION_TOLERANCE = 0.03  # 3 percentage points


def passes_regression_check(
    baseline_hit_at_3: float, current_hit_at_3: float, tolerance: float = REGRESSION_TOLERANCE
) -> bool:
    return (baseline_hit_at_3 - current_hit_at_3) <= tolerance


def main() -> int:
    dataset = json.loads(DATASET_PATH.read_text())
    baseline = json.loads(BASELINE_PATH.read_text())

    summary = run(dataset, split="dev")
    current_hit_at_3 = summary["results"]["hybrid_rerank"]["by_k"]["3"]["hit_rate"]
    baseline_hit_at_3 = baseline["hybrid_rerank_dev_hit_at_3"]
    drop = baseline_hit_at_3 - current_hit_at_3

    print(
        f"hybrid_rerank dev hit@3 -- baseline: {baseline_hit_at_3}, "
        f"current: {current_hit_at_3}, drop: {drop:.3f} "
        f"(tolerance: {REGRESSION_TOLERANCE})"
    )

    if not passes_regression_check(baseline_hit_at_3, current_hit_at_3):
        print(
            f"FAIL: hit@3 dropped by {drop:.3f}, exceeding the {REGRESSION_TOLERANCE} "
            "tolerance. If this drop is intentional (e.g. a harder dataset addition), "
            "update eval/baseline_ablation.json with a comment explaining why."
        )
        return 1

    print("PASS: no significant retrieval regression.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
