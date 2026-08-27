import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import ToolMessage

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


@tool
def get_repo_commits(repo: str) -> str:
    """Get recent commits from a GitHub repository."""
    return (
        f"Recent commits in {repo}:\n"
        "1. Fix authentication bug\n"
        "2. Update README\n"
        "3. Improve API error handling"
    )


@tool
def get_pull_requests(repo: str) -> str:
    """Get open pull requests in a GitHub repository."""
    return (
        f"Open pull requests in {repo}:\n"
        "1. Add login validation\n"
        "2. Fix API response handling"
    )


llm = ChatOpenAI(
    model=os.getenv("OPENROUTER_MODEL"),
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)

tools = [
    get_repo_status,
    list_open_issues,
    get_repo_commits,
    get_pull_requests,
]

llm_with_tools = llm.bind_tools(tools)


response = llm_with_tools.invoke(
    "Show me the open issues in octocat/Hello-World."
)

print("AI response:")
print(response)

print("\nTool calls:")
print(response.tool_calls)


if response.tool_calls:

    tool_messages = []

    for tool_call in response.tool_calls:

        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        print(f"\nExecuting tool: {tool_name}")
        print(f"Arguments: {tool_args}")

        selected_tool = {
            "get_repo_status": get_repo_status,
            "list_open_issues": list_open_issues,
            "get_repo_commits": get_repo_commits,
            "get_pull_requests": get_pull_requests,
        }[tool_name]

        result = selected_tool.invoke(tool_args)

        print("Tool result:")
        print(result)

        tool_messages.append(
            ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
            )
        )

    final_response = llm_with_tools.invoke(
        [
            ("user", "Show me the open issues in octocat/Hello-World."),
            response,
            *tool_messages,
        ]
    )

    print("\nFinal answer:")
    print(final_response.content)