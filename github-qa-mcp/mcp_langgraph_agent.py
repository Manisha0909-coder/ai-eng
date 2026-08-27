import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


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