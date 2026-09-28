"""LangGraph agent: decides whether a question needs the employee-rag tool
or can be answered directly, with an enforced step limit.

router --tool_calls--> tools --> router (loop, until an answer or the step
   \\--no tool_calls / step limit--> END                limit is hit)

Uses the same openrouter/free model as rag/pipeline.py, and for the same
reason (cost/consistency), so router_node treats a flaky or malformed
response from it as an expected condition rather than a bug: it degrades to
a fallback message instead of raising.
"""

from typing import Annotated, Literal, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from rag import config
from agent.tools import search_employee_policies

MAX_STEPS = 4

STEP_LIMIT_MESSAGE = (
    "I've made several attempts to answer this but haven't converged on a "
    "response. Please try rephrasing your question."
)
LLM_ERROR_MESSAGE = (
    "The assistant is temporarily unavailable. Please try again."
)

_tools = [search_employee_policies]
_tool_node = ToolNode(_tools)


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    steps: int


_llm = None


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
        ).bind_tools(_tools)
    return _llm


def router_node(state: AgentState) -> AgentState:
    steps = state.get("steps", 0) + 1

    if steps > MAX_STEPS:
        return {"messages": [AIMessage(content=STEP_LIMIT_MESSAGE)], "steps": steps}

    try:
        response = _get_llm().invoke(state["messages"])
    except Exception as exc:  # pragma: no cover - defensive, mirrors pipeline.py
        print(f"WARNING: agent LLM call failed: {exc!r}")
        response = AIMessage(content=LLM_ERROR_MESSAGE)

    return {"messages": [response], "steps": steps}


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    if state.get("steps", 0) > MAX_STEPS:
        return END

    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"

    return END


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("router", router_node)
    graph.add_node("tools", _tool_node)

    graph.add_edge(START, "router")
    graph.add_conditional_edges("router", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "router")

    return graph.compile()


_agent = None


def get_agent():
    """Process-wide singleton, mirroring rag.pipeline.get_pipeline()."""

    global _agent
    if _agent is None:
        _agent = build_graph()
    return _agent
