"""Gradio chat UI in front of the LangGraph agent -- the live demo front end.

Local run:    python app.py
Deployed to:  Google Cloud Run (see Dockerfile.gradio) -- Cloud Run injects
              $PORT and routes traffic to whatever port the container listens
              on, so this must bind to it rather than Gradio's 7860 default.
"""

import os
from typing import Any, Dict, List, Optional

import gradio as gr
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langfuse import get_client
from langfuse.langchain import CallbackHandler

from agent.graph import get_agent
from rag.pipeline import get_pipeline

_langfuse = get_client()
_agent_handler = None


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


def respond(message: str, history: List[Dict[str, Any]], request: Optional[gr.Request] = None) -> str:
    # request.session_hash is stable for one browser tab's whole visit, so it
    # groups every turn of a conversation into one Langfuse session -- see
    # "Group related traces with session IDs" in the best-practices guide.
    session_id = request.session_hash if request else None

    with _langfuse.start_as_current_observation(
        as_type="agent", name="run-agent", input=message
    ) as obs:
        _langfuse.update_current_trace(tags=["gradio-demo"], session_id=session_id)

        result = get_agent().invoke(
            {"messages": _history_to_messages(history, message), "steps": 0},
            config={"callbacks": [_get_agent_handler()]},
        )
        answer = result["messages"][-1].content
        obs.update(output=answer)
        return answer


demo = gr.ChatInterface(
    fn=respond,
    type="messages",
    title="Employee Policy Assistant",
    description=DESCRIPTION,
)

if __name__ == "__main__":
    # Warm up the index/embedder/reranker/LLM client at startup, not on the first
    # message. Guarded here (not at module level) so importing this module --
    # e.g. to test _history_to_messages -- doesn't pull in the whole stack.
    get_pipeline()
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))
