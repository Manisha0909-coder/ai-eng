"""One-time (re-run only when the example questions or documents change)
precompute of answers for app.py's clickable examples, so visitors clicking
one get an instant, zero-LLM-call response instead of spending demo quota
on the same six questions over and over.

Usage:
    python -m scripts.precompute_examples
"""

import json
from pathlib import Path

from langchain_core.messages import HumanMessage

from agent.graph import get_agent

OUT_PATH = Path(__file__).resolve().parent.parent / "examples_cache.json"

EXAMPLE_QUESTIONS = [
    "How many days of annual leave do I get per year?",
    "How long is maternity leave?",
    "Do I need a VPN to access internal systems from home?",
    "What's the daily meal allowance when traveling for work?",
    "What is the company's stock price?",
    "If I work remotely, what are my obligations and how often can I do it?",
]


def main() -> None:
    agent = get_agent()
    cache = {}

    for question in EXAMPLE_QUESTIONS:
        print(f"Precomputing: {question}")
        result = agent.invoke({"messages": [HumanMessage(content=question)], "steps": 0})
        answer = result["messages"][-1].content
        cache[question] = answer
        print(f"  -> {answer}\n")

    OUT_PATH.write_text(json.dumps(cache, indent=2))
    print(f"Wrote {len(cache)} cached examples to {OUT_PATH}")


if __name__ == "__main__":
    main()
