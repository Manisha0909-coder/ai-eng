"""Manual REPL for trying the agent interactively.

Usage: python -m agent.cli
"""

import uuid

from langchain_core.messages import HumanMessage
from langfuse import get_client
from langfuse.langchain import CallbackHandler

from agent.graph import get_agent


def main() -> None:
    agent = get_agent()
    langfuse = get_client()
    langfuse_handler = CallbackHandler()
    session_id = str(uuid.uuid4())  # one REPL run = one conversation = one session
    print("employee-rag agent -- ask a question (Ctrl+C to quit)\n")

    while True:
        try:
            question = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not question:
            continue

        with langfuse.start_as_current_observation(as_type="agent", name="run-agent") as obs:
            langfuse.update_current_trace(tags=["cli"], session_id=session_id)

            result = agent.invoke(
                {"messages": [HumanMessage(content=question)], "steps": 0},
                config={"callbacks": [langfuse_handler]},
            )
            obs.update(
                input=result.get("redacted_input", question),
                output=result["messages"][-1].content,
            )

        result["messages"][-1].pretty_print()

    langfuse.flush()  # short-lived script -- make sure traces are sent before exit


if __name__ == "__main__":
    main()
