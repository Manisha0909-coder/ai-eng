"""Process-wide daily cap on live OpenRouter calls.

The deployed demo shares OpenRouter's free tier with everyone else running
this code, so a burst of traffic (or a bot) could exhaust it for the day.
This caps how many calls *this* process will make per day and degrades to a
friendly message instead of errors once the cap is hit. In-memory by design:
good enough for a single Cloud Run instance (min/max-instances 0/1, see
scripts/deploy.sh), resets naturally on a cold restart or UTC day rollover.

Not applied to eval/run_eval.py or run_ablation.py -- those are developer-run
scripts against the full golden dataset, not public demo traffic.
"""

import datetime
import threading

DAILY_LIMIT = 40

QUOTA_MESSAGE = (
    "Demo quota reached for today (free-tier OpenRouter calls are capped to "
    "keep this instance available for everyone). See the README for recorded "
    "example answers, or check back after the daily reset."
)

_lock = threading.Lock()
_count = 0
_day = None


class QuotaExceededError(Exception):
    """Raised instead of making a call once today's cap is already spent."""


def _today() -> datetime.date:
    return datetime.datetime.now(datetime.timezone.utc).date()


def check_and_increment(limit: int = DAILY_LIMIT) -> None:
    """Count one call against today's cap, raising if it's already spent."""

    global _count, _day

    with _lock:
        today = _today()
        if _day != today:
            _day = today
            _count = 0

        if _count >= limit:
            raise QuotaExceededError(f"Daily demo quota ({limit} calls) reached.")

        _count += 1


def remaining(limit: int = DAILY_LIMIT) -> int:
    with _lock:
        if _day != _today():
            return limit
        return max(0, limit - _count)
