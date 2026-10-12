"""LangGraph agent: decides whether a question needs the employee-rag tool
or can be answered directly, with an enforced step limit, input/output
guardrails, and query rewriting for multi-turn follow-ups.

input_guard --(blocked)--> END
     |
   (ok)
     v
  rewrite --> router --tool_calls--> tools --> router (loop, until an
                 \\--no tool_calls / step limit--> output_guard --> END   answer or the
                                                                           step limit)

Uses the same openrouter/free model as rag/pipeline.py, and for the same
reason (cost/consistency), so router_node treats a flaky or malformed
response from it as an expected condition rather than a bug: it degrades to
a fallback message instead of raising.
"""

from typing import Annotated, Literal, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from agent.tools import search_employee_policies
from rag import config, quota
from rag.groundedness import is_grounded
from rag.guardrails import (
    exceeds_length_cap,
    leaks_system_prompt,
    looks_like_injection,
    redact_pii,
)
from rag.rewrite import rewrite_query

MAX_STEPS = 4

STEP_LIMIT_MESSAGE = (
    "I've made several attempts to answer this but haven't converged on a "
    "response. Please try rephrasing your question."
)
LLM_ERROR_MESSAGE = "The assistant is temporarily unavailable. Please try again."
INPUT_TOO_LONG_MESSAGE = (
    "That question is too long for me to process. Please ask something shorter."
)
INJECTION_BLOCKED_MESSAGE = (
    "I can't follow instructions embedded in a question -- I can only answer "
    "questions about company policy. What would you like to know?"
)
SYSTEM_PROMPT_LEAK_FALLBACK = (
    "I can't share my internal instructions, but I'm happy to help with a "
    "question about company policy."
)
UNGROUNDED_FALLBACK_MESSAGE = (
    "I don't have enough information to answer that confidently."
)

_tools = [search_employee_policies]
_tool_node = ToolNode(_tools)


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    steps: int
    blocked: bool
    redacted_input: str


_llm = None
_rewrite_llm = None
_langfuse_handler = None


def _get_llm():
    """Lazy singleton so importing this module (e.g. to test should_continue)
    never requires an API key -- only actually calling the router does."""

    global _llm
    if _llm is None:
        from langchain_openai import ChatOpenAI

        _llm = ChatOpenAI(
            model=config.LLM_MODEL,
            base_url=config.LLM_BASE_URL,
            api_key=config.OPENROUTER_API_KEY,
            timeout=config.LLM_REQUEST_TIMEOUT_SECONDS,
        ).bind_tools(_tools)
    return _llm


def _get_rewrite_llm():
    """Separate lazy singleton (no tool binding needed) for query rewriting."""

    global _rewrite_llm
    if _rewrite_llm is None:
        from langchain_openai import ChatOpenAI

        _rewrite_llm = ChatOpenAI(
            model=config.LLM_MODEL,
            base_url=config.LLM_BASE_URL,
            api_key=config.OPENROUTER_API_KEY,
            timeout=config.LLM_REQUEST_TIMEOUT_SECONDS,
        )
    return _rewrite_llm


def _get_langfuse_handler():
    """Lazy singleton, same reasoning as _get_llm(): no Langfuse credentials
    needed just to import/test this module."""

    global _langfuse_handler
    if _langfuse_handler is None:
        from langfuse.langchain import CallbackHandler

        _langfuse_handler = CallbackHandler()
    return _langfuse_handler


def input_guard_node(state: AgentState) -> AgentState:
    """Runs once, before the router ever sees the question: a length cap,
    a prompt-injection heuristic, and PII redaction for what gets logged
    to Langfuse (redacted_input) -- not for what the model sees, since a
    user's own email/phone in their question isn't a model-safety issue,
    but storing it in a third-party observability tool unnecessarily is a
    privacy-hygiene one."""

    last_message = state["messages"][-1]
    text = (
        last_message.content
        if isinstance(last_message.content, str)
        else str(last_message.content)
    )
    redacted_text, _ = redact_pii(text)

    if exceeds_length_cap(text):
        return {
            "messages": [AIMessage(content=INPUT_TOO_LONG_MESSAGE)],
            "blocked": True,
            "redacted_input": redacted_text,
        }

    if looks_like_injection(text):
        return {
            "messages": [AIMessage(content=INJECTION_BLOCKED_MESSAGE)],
            "blocked": True,
            "redacted_input": redacted_text,
        }

    return {"blocked": False, "redacted_input": redacted_text}


def _input_guard_routing(state: AgentState) -> str:
    return END if state.get("blocked") else "continue"


def rewrite_node(state: AgentState) -> AgentState:
    """Rewrites the latest message into a standalone question when there's
    prior conversation history -- a no-op (no LLM call) on the first turn
    of a conversation. Runs once, before the router loop starts; the
    router/tools loop never re-enters this node."""

    messages = state["messages"]
    if len(messages) <= 1:
        return {}

    last = messages[-1]
    if not isinstance(last, HumanMessage):
        return {}

    history = [
        {
            "role": "user" if isinstance(m, HumanMessage) else "assistant",
            "content": m.content,
        }
        for m in messages[:-1]
        if isinstance(m, (HumanMessage, AIMessage)) and isinstance(m.content, str)
    ]
    if not history:
        return {}

    try:
        quota.check_and_increment()
    except quota.QuotaExceededError:
        # Rewriting is an optimization, not the user-facing answer -- fail
        # silently to "no rewriting" rather than spending the quota
        # message slot on something the user didn't directly ask for.
        return {}

    rewritten = rewrite_query(_get_rewrite_llm(), last.content, history)
    if rewritten == last.content:
        return {}

    # Same id as the message being replaced -- add_messages' reducer
    # updates in place instead of appending a duplicate.
    return {"messages": [HumanMessage(content=rewritten, id=last.id)]}


def router_node(state: AgentState) -> AgentState:
    steps = state.get("steps", 0) + 1

    if steps > MAX_STEPS:
        return {"messages": [AIMessage(content=STEP_LIMIT_MESSAGE)], "steps": steps}

    try:
        quota.check_and_increment()
    except quota.QuotaExceededError:
        return {"messages": [AIMessage(content=quota.QUOTA_MESSAGE)], "steps": steps}

    try:
        response = _get_llm().invoke(
            state["messages"], config={"callbacks": [_get_langfuse_handler()]}
        )
    except Exception as exc:  # pragma: no cover - defensive, mirrors pipeline.py
        print(f"WARNING: agent LLM call failed: {exc!r}")
        response = AIMessage(content=LLM_ERROR_MESSAGE)

    return {"messages": [response], "steps": steps}


def output_guard_node(state: AgentState) -> AgentState:
    """Runs once the router has produced a final (non-tool-call) answer:
    a system-prompt-leak check, and -- when the agent used the RAG tool
    this turn -- the deterministic groundedness check from eval/, against
    the tool's own returned text as a proxy for "the retrieved context."
    """

    last_message = state["messages"][-1]

    if not isinstance(last_message, AIMessage) or getattr(
        last_message, "tool_calls", None
    ):
        return {}

    text = last_message.content

    if leaks_system_prompt(text):
        return {
            "messages": [
                AIMessage(content=SYSTEM_PROMPT_LEAK_FALLBACK, id=last_message.id)
            ]
        }

    tool_messages = [m for m in state["messages"] if isinstance(m, ToolMessage)]
    if tool_messages:
        context = "\n\n".join(str(m.content) for m in tool_messages)
        if not is_grounded(text, context):
            return {
                "messages": [
                    AIMessage(content=UNGROUNDED_FALLBACK_MESSAGE, id=last_message.id)
                ]
            }

    return {}


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    if state.get("steps", 0) > MAX_STEPS:
        return END

    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"

    return END


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("input_guard", input_guard_node)
    graph.add_node("rewrite", rewrite_node)
    graph.add_node("router", router_node)
    graph.add_node("tools", _tool_node)
    graph.add_node("output_guard", output_guard_node)

    graph.add_edge(START, "input_guard")
    graph.add_conditional_edges(
        "input_guard", _input_guard_routing, {"continue": "rewrite", END: END}
    )
    graph.add_edge("rewrite", "router")
    graph.add_conditional_edges(
        "router", should_continue, {"tools": "tools", END: "output_guard"}
    )
    graph.add_edge("tools", "router")
    graph.add_edge("output_guard", END)

    return graph.compile()


_agent = None


def get_agent():
    """Process-wide singleton, mirroring rag.pipeline.get_pipeline()."""

    global _agent
    if _agent is None:
        _agent = build_graph()
    return _agent
