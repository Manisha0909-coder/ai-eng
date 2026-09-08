import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import StructuredTool
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing import Annotated
from typing_extensions import TypedDict
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv()
def create_list_issues_tool(session):

    async def list_issues(
        owner: str,
        repo: str,
        state: str = "open",
        limit: int = 10,
    ):

        result = await session.call_tool(
            "list_issues",
            {
                "owner": owner,
                "repo": repo,
                "state": state,
                "limit": limit,
            },
        )

        return "\n".join(
            item.text
            for item in result.content
            if hasattr(item, "text")
        )

    return StructuredTool.from_function(
        coroutine=list_issues,
        name="list_issues",
        description=(
            "List issues in a GitHub repository. "
            "state can be open, closed, or all."
        ),
    )

class State(TypedDict):
    messages: Annotated[list, add_messages]
    
async def main():

    server_params = StdioServerParameters(
        command="python",
        args=["server.py"],
    )

    async with stdio_client(server_params) as (read, write):

        async with ClientSession(read, write) as session:

            await session.initialize()

            print("Connected to MCP server!")

            # Discover tools
            response = await session.list_tools()

            print("\nAvailable tools:")
            for tool in response.tools:
                print("-", tool.name)

            # Call an MCP tool
            print("\nCalling list_issues...")

            result = await session.call_tool(
             "list_issues",
                    {
                      "owner": "octocat",
                      "repo": "Hello-World",
                      "state": "open"
                     }
                )

            print("\nMCP tool result:")
            print(result.content)


if __name__ == "__main__":
    asyncio.run(main())