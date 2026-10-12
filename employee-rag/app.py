"""Gradio chat UI in front of the LangGraph agent -- the live demo front end.

Local run:    python app.py
Deployed to:  Google Cloud Run (see Dockerfile.gradio) -- Cloud Run injects
              $PORT and routes traffic to whatever port the container listens
              on, so this must bind to it rather than Gradio's 7860 default.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import gradio as gr
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langfuse import get_client
from langfuse.langchain import CallbackHandler

from agent.graph import get_agent
from rag.pipeline import get_pipeline

_langfuse = get_client()
_agent_handler = None

# Precomputed via scripts/precompute_examples.py and committed to the repo.
# Clicking one of the example questions below returns the cached answer
# directly -- zero LLM calls, so the free-tier demo quota (rag/quota.py)
# isn't spent on the same six questions over and over.
_EXAMPLES_PATH = Path(__file__).resolve().parent / "examples_cache.json"
_EXAMPLES_CACHE: Dict[str, str] = {
    question: answer.strip()
    for question, answer in json.loads(_EXAMPLES_PATH.read_text()).items()
} if _EXAMPLES_PATH.exists() else {}
EXAMPLES = list(_EXAMPLES_CACHE.keys())

FOOTER = """
---
[View source on GitHub](https://github.com/Manisha0909-coder/ai-eng/tree/main/employee-rag) \
&nbsp;&middot;&nbsp; All policies referenced in this demo are fictional, written for
demonstration purposes only.
"""


def _get_agent_handler():
    """Lazy singleton, same reasoning as agent/graph.py's _get_llm(): no
    Langfuse credentials needed just to import this module."""

    global _agent_handler
    if _agent_handler is None:
        _agent_handler = CallbackHandler()
    return _agent_handler

DESCRIPTION = """
Ask about company leave, IT/security, expenses, or code-of-conduct policy.
A LangGraph agent decides whether to search the policy documents or answer
directly, with hybrid retrieval + cross-encoder reranking behind the scenes.

Runs on OpenRouter's **free** tier (shared, rate-limited) -- if a response is
slow or errors out, that's the free quota, not a crash. Try again shortly.
Click an example below for an instant, pre-recorded answer.
"""


def _history_to_messages(history: List[Dict[str, Any]], message: str) -> List[BaseMessage]:
    """Converts Gradio's type="messages" history into LangChain messages and
    appends the new user message. Pure function -- no Gradio or agent
    dependency -- so it's unit-testable on its own.
    """

    messages: List[BaseMessage] = []
    for turn in history:
        content = turn["content"]
        if turn["role"] == "user":
            messages.append(HumanMessage(content=content))
        elif turn["role"] == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=message))
    return messages


# Characters revealed per step in the Gradio chat's typewriter effect --
# see _reveal_in_chunks()'s docstring for why this is a simulated reveal,
# not true token-level streaming, for this specific (agent-routed) path.
_STREAM_CHUNK_SIZE = 8


def _reveal_in_chunks(text: str):
    """Yields increasingly-complete prefixes of `text` a few characters at
    a time -- a readable typewriter effect for Gradio's streaming
    ChatInterface, used for both the cached-example path and the live
    agent path below.

    This is deliberately NOT true token-level LLM streaming. The agent's
    router decides tool-use-vs-direct-answer via a single .invoke() call
    (agent/graph.py); getting real token streaming through that would mean
    restructuring the router node around LangGraph's "messages" stream
    mode, with real risk of subtly changing its tool-routing behavior --
    a regression this project's free-LLM-budget rule makes hard to verify
    live before shipping. rag/pipeline.answer_stream() (used by api.py's
    /ask/stream) *is* true token streaming; this simulated reveal is a
    deliberate, lower-risk choice for the agent-routed Gradio demo only.
    """

    if not text:
        yield ""
        return
    for i in range(0, len(text), _STREAM_CHUNK_SIZE):
        yield text[: i + _STREAM_CHUNK_SIZE]


def respond(message: str, history: List[Dict[str, Any]], request: Optional[gr.Request] = None):
    # request.session_hash is stable for one browser tab's whole visit, so it
    # groups every turn of a conversation into one Langfuse session -- see
    # "Group related traces with session IDs" in the best-practices guide.
    cached = _EXAMPLES_CACHE.get(message.strip())
    if cached is not None:
        yield from _reveal_in_chunks(cached)
        return

    session_id = request.session_hash if request else None

    # input= is set after invoke(), not here -- agent/graph.py's
    # input_guard_node computes a PII-redacted version of the message
    # (redacted_input) specifically for what gets logged to Langfuse.
    with _langfuse.start_as_current_observation(as_type="agent", name="run-agent") as obs:
        _langfuse.update_current_trace(tags=["gradio-demo"], session_id=session_id)

        result = {}
        try:
            result = get_agent().invoke(
                {"messages": _history_to_messages(history, message), "steps": 0},
                config={"callbacks": [_get_agent_handler()]},
            )
            answer = result["messages"][-1].content
        except Exception as exc:  # pragma: no cover - defensive, mirrors agent/graph.py
            print(f"WARNING: agent run failed: {exc!r}")
            answer = "The assistant is temporarily unavailable. Please try again."

        obs.update(input=result.get("redacted_input", message), output=answer)

    # Cloud Run throttles CPU once a request finishes, which can starve
    # Langfuse's background flush thread before it ever sends this trace.
    # Flushing synchronously here -- while the request (and its CPU
    # allocation) is still active -- guarantees it ships. Same reasoning as
    # eval/run_eval.py's flush() before exit.
    _langfuse.flush()
    yield from _reveal_in_chunks(answer)


with gr.Blocks(title="Employee Policy Assistant") as demo:
    gr.ChatInterface(
        fn=respond,
        type="messages",
        title="Employee Policy Assistant",
        description=DESCRIPTION,
        examples=EXAMPLES,
    )
    gr.Markdown(FOOTER)

if __name__ == "__main__":
    # Warm up the index/embedder/reranker/LLM client at startup, not on the first
    # message. Guarded here (not at module level) so importing this module --
    # e.g. to test _history_to_messages -- doesn't pull in the whole stack.
    get_pipeline()
    # _frontend=False skips Gradio's own "is localhost reachable" self-probe
    # (gradio.networking.url_ok): on a just-started container that HEAD
    # request can race the server accepting its first connection, raising
    # ValueError and crashing the whole process -- observed on a Cloud Run
    # cold start. The probe is unrelated to serving the UI itself, which
    # works fine either way; this just stops a flaky check from taking the
    # app down.
    demo.launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", 7860)),
        _frontend=False,
    )
