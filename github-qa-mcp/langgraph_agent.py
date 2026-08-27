import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing import Annotated
from typing_extensions import TypedDict


load_dotenv()


@tool
def get_repo_status(repo: str) -> str:
    """Get the current status of a GitHub repository."""
    return f"Repository {repo} has 5 open issues."


@tool
def list_open_issues(repo: str) -> str:
    """List open issues in a GitHub repository."""
    return (
        f"Open issues in {repo}:\n"
        "1. Login button not working\n"
        "2. API timeout issue\n"
        "3. UI alignment problem"
    )


tools = [
    get_repo_status,
    list_open_issues,
]


llm = ChatOpenAI(
    model=os.getenv("OPENROUTER_MODEL"),
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)


llm_with_tools = llm.bind_tools(tools)


class State(TypedDict):
    messages: Annotated[list, add_messages]


def call_llm(state: State):
    response = llm_with_tools.invoke(state["messages"])

    return {
        "messages": [response]
    }


graph = StateGraph(State)

graph.add_node("llm", call_llm)

graph.add_node(
    "tools",
    ToolNode(tools)
)

graph.add_edge(START, "llm")

graph.add_conditional_edges(
    "llm",
    tools_condition
)

graph.add_edge("tools", "llm")

app = graph.compile()


result = app.invoke({
    "messages": [
        (
            "user",
            "Show me the open issues in octocat/Hello-World."
        )
    ]
})


for message in result["messages"]:
    print("\n---")
    print(type(message).__name__)
    print(message)