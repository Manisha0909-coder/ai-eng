"""Query rewriting: turns a follow-up question plus recent conversation
history into a standalone question, so retrieval doesn't have to guess
what "that" or "it" refers to. Wired into agent/graph.py as a node right
before the router -- only triggered when there's history to rewrite from;
a first-turn question is already standalone and skips this entirely.

Any failure (LLM error, empty response) falls back deterministically to
the original, un-rewritten question -- a rewriting bug should degrade to
"no rewriting," never to a crash or a worse question than what the user
actually typed.
"""

from typing import Any, Dict, List

from langchain_core.prompts import ChatPromptTemplate

_REWRITE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """Given a conversation history and a follow-up question, rewrite the
follow-up into a standalone question that makes sense without the
history. Preserve the user's intent exactly -- do not answer the
question, do not add information, just make it self-contained.

If the follow-up is already standalone, return it unchanged.

Respond with ONLY the rewritten question, no other text.""",
    ),
    (
        "human",
        """Conversation history:
{history}

Follow-up question:
{question}""",
    ),
])


def _format_history(history: List[Dict[str, Any]]) -> str:
    lines = []
    for turn in history:
        role = "User" if turn.get("role") == "user" else "Assistant"
        lines.append(f"{role}: {turn.get('content', '')}")
    return "\n".join(lines)


def rewrite_query(llm, question: str, history: List[Dict[str, Any]]) -> str:
    """Returns a standalone question. `llm` is any object exposing
    .invoke(prompt_value) -> response-with-.content (e.g.
    langchain_openai.ChatOpenAI), injected rather than constructed here
    so tests can pass a fake instead of a real network client.

    history: a list of {"role": "user"|"assistant", "content": str}
    dicts, oldest first.
    """

    if not history:
        return question

    try:
        prompt_value = _REWRITE_PROMPT.invoke({"history": _format_history(history), "question": question})
        response = llm.invoke(prompt_value)
        rewritten = response.content.strip()
        return rewritten if rewritten else question
    except Exception as exc:  # pragma: no cover - network/rate-limit errors
        print(f"WARNING: query rewrite failed, falling back to the raw question: {exc!r}")
        return question
