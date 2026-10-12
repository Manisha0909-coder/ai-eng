"""Deterministic groundedness check: every number/date-like token in a
generated answer should appear somewhere in the retrieved context, else
it's flagged "ungrounded" -- a cheap, fast complement to the (optional,
LLM-based) faithfulness judge. A model can *sound* faithful while still
inventing a number that was never in the context; this catches that
specific, checkable failure mode without needing another LLM call.

Lives in rag/, not eval/: agent/graph.py's output guard uses this at
request time (replacing an ungrounded answer with a safe fallback), and
eval/run_eval.py uses the same function offline for the grounded_rate
metric -- one implementation, not two copies that could drift apart.

Deliberately crude (substring presence, not semantic grounding) -- same
trade-off as the project's other deterministic checks (variant-group
string matching, the light BM25 stemmer): fast and dependency-free, at
the cost of occasionally flagging a number that's trivially derivable
(e.g. "3 months" when the context says "6 months" and "half of that") or
missing one written in an unusual format. Good enough as a tripwire, not
a substitute for a human or judge-model review of flagged cases.
"""

import re
from typing import List

_NUMBER_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?%?|\d{4}-\d{2}-\d{2}")


def extract_numbers(text: str) -> List[str]:
    return _NUMBER_RE.findall(text)


def ungrounded_numbers(answer: str, context: str) -> List[str]:
    """Numbers present in `answer` that don't appear anywhere in `context`."""

    return [n for n in extract_numbers(answer) if n not in context]


def is_grounded(answer: str, context: str) -> bool:
    return not ungrounded_numbers(answer, context)
