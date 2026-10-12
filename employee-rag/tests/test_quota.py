"""Offline: pure in-memory counter, no network/LLM involved."""

from rag import quota


def _fresh_module_state(monkeypatch):
    monkeypatch.setattr(quota, "_count", 0)
    monkeypatch.setattr(quota, "_day", quota._today())


def test_allows_calls_up_to_the_limit(monkeypatch):
    _fresh_module_state(monkeypatch)

    for _ in range(3):
        quota.check_and_increment(limit=3)

    assert quota.remaining(limit=3) == 0


def test_raises_once_the_limit_is_spent(monkeypatch):
    _fresh_module_state(monkeypatch)

    quota.check_and_increment(limit=1)

    try:
        quota.check_and_increment(limit=1)
        assert False, "expected QuotaExceededError"
    except quota.QuotaExceededError:
        pass


def test_resets_on_a_new_day(monkeypatch):
    monkeypatch.setattr(quota, "_count", 5)
    monkeypatch.setattr(quota, "_day", quota._today())

    import datetime

    monkeypatch.setattr(quota, "_today", lambda: quota._day + datetime.timedelta(days=1))

    assert quota.remaining(limit=5) == 5
    quota.check_and_increment(limit=5)  # should not raise -- fresh day, fresh count
