from typing import TypedDict

from langgraph.graph import StateGraph, START, END


class State(TypedDict):
    message: str
    needs_processing: bool


def analyze(state: State):
    print("Analyzing...")

    if "process" in state["message"].lower():
        return {"needs_processing": True}

    return {"needs_processing": False}


def process(state: State):
    print("Processing...")
    return {
        "message": state["message"] + " → Processed"
    }


def decide_next(state: State):
    if state["needs_processing"]:
        return "process"

    return "end"


graph = StateGraph(State)

graph.add_node("analyze", analyze)
graph.add_node("process", process)

graph.add_edge(START, "analyze")

graph.add_conditional_edges(
    "analyze",
    decide_next,
    {
        "process": "process",
        "end": END
    }
)

graph.add_edge("process", END)

app = graph.compile()


result = app.invoke({
    "message": "Hello",
    "needs_processing": False
})

print("Final result:", result)