"""On-disk response cache keyed by (resolved model name, question hash,
repeat index), so re-running eval (after a --max-calls stop, or while
iterating on scoring logic) never re-spends LLM budget on a call it
already has a real answer for.

Keyed by the *question* text, not the full LLM prompt -- run_eval.py calls
into rag/pipeline.py as a black box, so it never sees the literal prompt;
for a fixed corpus and config, the same question always builds the same
context and prompt, so this is an equivalent, simpler key.

The repeat index is part of the key (not just the question) so --repeats
can collect genuinely independent samples instead of serving the same
cached answer for every repeat -- caching only dedupes *across runs*, not
*within* a single --repeats sweep.
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

CACHE_PATH = Path(__file__).resolve().parent / ".cache" / "responses.json"


def _key(model: str, question: str, repeat_index: int) -> str:
    digest = hashlib.sha256(question.encode("utf-8")).hexdigest()[:16]
    return f"{model}:{digest}:{repeat_index}"


def load() -> Dict[str, Any]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def get(model: str, question: str, repeat_index: int = 0) -> Optional[Dict[str, Any]]:
    return load().get(_key(model, question, repeat_index))


def put(
    model: str, question: str, result: Dict[str, Any], repeat_index: int = 0
) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    cache = load()
    cache[_key(model, question, repeat_index)] = result
    CACHE_PATH.write_text(json.dumps(cache, indent=2))
