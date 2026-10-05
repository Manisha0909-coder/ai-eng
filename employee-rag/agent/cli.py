"""Manual REPL for trying the agent interactively.

Usage: python -m agent.cli
"""

from langchain_core.messages import HumanMessage
from langfuse import get_client
from langfuse.langchain import CallbackHandler

from agent.graph import get_agent


def main() -> None:
    agent = get_agent()
    langfuse_handler = CallbackHandler()
    print("employee-rag agent -- ask a question (Ctrl+C to quit)\n")

    while True:
        try:
            question = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not question:
            continue

        result = agent.invoke(
            {"messages": [HumanMessage(content=question)], "steps": 0},
            config={"callbacks": [langfuse_handler]},
        )
        result["messages"][-1].pretty_print()

    get_client().flush()  # short-lived script -- make sure traces are sent before exit


if __name__ == "__main__":
    main()
