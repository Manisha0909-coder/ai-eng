"""should_continue is a pure function over state -- no LLM, no graph
execution, so these run instantly and identically in CI or on a laptop."""

from langchain_core.messages import AIMessage
from langgraph.graph import END

from agent.graph import MAX_STEPS, should_continue


def _state(message, steps=1):
    return {"messages": [message], "steps": steps}


def test_tool_call_routes_to_tools():
    message = AIMessage(
        content="",
        tool_calls=[{"name": "search_employee_policies", "args": {"question": "x"}, "id": "1"}],
    )
    assert should_continue(_state(message)) == "tools"


def test_no_tool_call_ends():
    message = AIMessage(content="Hi there!")
    assert should_continue(_state(message)) == END


def test_step_limit_ends_even_with_tool_call():
    message = AIMessage(
        content="",
        tool_calls=[{"name": "search_employee_policies", "args": {"question": "x"}, "id": "1"}],
    )
    assert should_continue(_state(message, steps=MAX_STEPS + 1)) == END
