"""Offline: the regression-check threshold logic, no real index/retrieval."""

from eval.ci_ablation_gate import passes_regression_check


def test_passes_when_no_drop():
    assert passes_regression_check(baseline_hit_at_3=0.74, current_hit_at_3=0.74)


def test_passes_when_metric_improves():
    assert passes_regression_check(baseline_hit_at_3=0.74, current_hit_at_3=0.90)


def test_passes_within_tolerance():
    assert passes_regression_check(baseline_hit_at_3=0.74, current_hit_at_3=0.72)


def test_fails_beyond_tolerance():
    assert not passes_regression_check(baseline_hit_at_3=0.74, current_hit_at_3=0.60)


def test_custom_tolerance_respected():
    assert not passes_regression_check(
        baseline_hit_at_3=0.74, current_hit_at_3=0.72, tolerance=0.01
    )
