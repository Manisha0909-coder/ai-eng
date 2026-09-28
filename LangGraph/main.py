from dotenv import load_dotenv
from langgraph.graph import START, END, StateGraph, add_messages
import os
from typing_extensions import TypedDict
from langchain_openai.chat_models import ChatOpenAI
from langchain_core.runnables import Runnable
from typing import Sequence, Literal, Annotated
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from collections.abc import Sequence

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")

#define a State

class State(TypedDict):
    messages : Annotated[Sequence[BaseMessage], add_messages]

state = State(messages=[HumanMessage("Could you tell me grook by piet hein")])
print(state)
print(state["messages"][0].pretty_print())

#define nodes

chat = ChatOpenAI(
    model="openrouter/free",
    api_key=api_key,
    base_url="https://openrouter.ai/api/v1",
    temperature=0,
    max_tokens=100
)


response = chat.invoke(state["messages"])
print(response.pretty_print())

def ask_question(state : State) -> State:
    print(f"\n ------> ENTERING ASK_QUESTION:")
    print("What is your question?")
    return State(messages=[HumanMessage(input())])

ask_question(State(messages=[]))

def Chatbot(state: State) -> State:
    print(f"\n--------> ENTERING chatbot")
    response = chat.invoke(state["messages"])
    response.pretty_print()

    return State(messages=[response])


def ask_another_question(state : State) -> State:
    print(f"\n ------> ENTERING ASK_another QUESTION:")
    print("Would you like to ask another question (y/n)?")
    return State(messages=[HumanMessage(input())])

ask_another_question(State(messages=[]))

#defin routing function

def routing_funtion(state: State) ->State:
    if state["messages"][0].content == "y":
        return "ask_question"
    else:
        return "__end__"
        

#Define a Graph

graph = StateGraph(State)
graph.add_node("ask_question",ask_question)
graph.add_node("Chatbot",Chatbot)
graph.add_node("ask_another_question",ask_another_question)

graph.add_edge(START,"ask_question")
graph.add_edge("ask_question","Chatbot")
graph.add_edge("Chatbot","ask_another_question")
graph.add_conditional_edges(source = "ask_another_question",
                            path = routing_funtion,
                            path_map = {"True": "ask_question",  "__end__":END})


graph_compiled = graph.compile()

isinstance(graph, Runnable)

graph_compiled

#test the graph

graph_compiled.invoke(state)