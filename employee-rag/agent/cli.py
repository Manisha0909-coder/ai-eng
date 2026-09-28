"""Manual REPL for trying the agent interactively.

Usage: python -m agent.cli
"""

from langchain_core.messages import HumanMessage

from agent.graph import get_agent


def main() -> None:
    agent = get_agent()
    print("employee-rag agent -- ask a question (Ctrl+C to quit)\n")

    while True:
        try:
            question = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not question:
            continue

        result = agent.invoke({"messages": [HumanMessage(content=question)], "steps": 0})
        result["messages"][-1].pretty_print()


if __name__ == "__main__":
    main()
