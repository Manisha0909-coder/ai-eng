import asyncio
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

OWNER = "octocat"
REPO = "Hello-World"


async def main():

    print("Starting MCP client...")

    server_params = StdioServerParameters(
        command=sys.executable,
        args=["server.py"],
    )

    print("Starting MCP server...")

    async with stdio_client(server_params) as (read, write):

        print("Connecting to server...")

        async with ClientSession(read, write) as session:

            await session.initialize()

            print("Connected to MCP server!")

            tools = await session.list_tools()

            print("\nAvailable tools:")

            for tool in tools.tools:
                print(f"- {tool.name}")
                print(f"  Description: {tool.description}")

            print(f"\nCalling get_repo_info for {OWNER}/{REPO}...")

            result = await session.call_tool(
                "get_repo_info",
                arguments={
                    "owner": OWNER,
                    "repo": REPO,
                }
            )

            print("\nTool result:")

            for content in result.content:
                if hasattr(content, "text"):
                    print(content.text)

            print(f"\nCalling list_issues for {OWNER}/{REPO}...")

            issues_result = await session.call_tool(
                "list_issues",
                arguments={
                    "owner": OWNER,
                    "repo": REPO,
                    "state": "open",
                    "limit": 5,
                }
            )

            print("\nIssues result:")

            for content in issues_result.content:
                if hasattr(content, "text"):
                    print(content.text)

            print("\nAvailable prompts:")

            prompts = await session.list_prompts()

            for prompt in prompts.prompts:
                print(f"- {prompt.name}")
                print(f"  Description: {prompt.description}")


if __name__ == "__main__":
    asyncio.run(main())
