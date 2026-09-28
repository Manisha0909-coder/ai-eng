"""Runs the real compiled graph, but with the LLM and the RAG pipeline both
faked out -- fully offline, and exercises the step-limit enforcement against
a worst case: an LLM that always wants to call the tool again."""

from langchain_core.messages import AIMessage, HumanMessage

from agent import graph as graph_module
from agent import tools as tools_module
from agent.graph import MAX_STEPS, STEP_LIMIT_MESSAGE, get_agent


class _AlwaysCallsToolLLM:
    """Simulates a runaway loop: every call asks for the tool again."""

    def invoke(self, messages):
        return AIMessage(
            content="",
            tool_calls=[
                {"name": "search_employee_policies", "args": {"question": "loop"}, "id": "call-1"}
            ],
        )


class _FakePipeline:
    def answer(self, question):
        return {"answer": "canned answer", "sources": []}


def test_step_limit_terminates_instead_of_looping_forever(monkeypatch):
    monkeypatch.setattr(graph_module, "_get_llm", lambda: _AlwaysCallsToolLLM())
    monkeypatch.setattr(tools_module, "get_pipeline", lambda: _FakePipeline())

    agent = get_agent()
    result = agent.invoke({"messages": [HumanMessage(content="loop forever")], "steps": 0})

    assert result["messages"][-1].content == STEP_LIMIT_MESSAGE
    assert result["steps"] == MAX_STEPS + 1
