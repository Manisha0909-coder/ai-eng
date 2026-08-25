import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():

    print("Starting MCP client...")

    server_params = StdioServerParameters(
        command="python",
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

            print("\nCalling get_employee...")

            result = await session.call_tool(
                "get_employee",
                arguments={
                    "name": "Manisha"
                }
            )

            print("\nTool result:")

            for content in result.content:

                if hasattr(content, "text"):
                    print(content.text)

            print("\nCalling calculate_leave_balance...")

            leave_result = await session.call_tool(
                "calculate_leave_balance",
                        arguments={
                            "total_leave": 20,
                            "used_leave": 5
                        }
                )

            print("\nLeave result:")

            for content in leave_result.content:
                if hasattr(content, "text"):
                    print(content.text)

            print("\nCalling check_leave_eligibility...")

            eligibility_result = await session.call_tool(
                "check_leave_eligibility",
                            arguments={
                            "months_employed": 8
                            }
                        )

            print("\nEligibility result:")

            for content in eligibility_result.content:
                     if hasattr(content, "text"):
                        print(content.text)
            print("\nAvailable resources:")

            resources = await session.list_resources()

            for resource in resources.resources:
                print(f"- {resource.uri}")
                print(f"  Name: {resource.name}")   

            print("\nReading employee leave policy...")

            resource_result = await session.read_resource(
                    "employee-policy://leave"
                        )

            print("\nPolicy:")

            for content in resource_result.contents:
             print(content.text)

        print("\nAvailable prompts:")

        prompts = await session.list_prompts()

        for prompt in prompts.prompts:
            print(f"- {prompt.name}")
            print(f"  Description: {prompt.description}")

if __name__ == "__main__":
    asyncio.run(main())