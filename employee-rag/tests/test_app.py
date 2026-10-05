"""Offline: tests the Gradio-history-to-LangChain-messages conversion in
isolation, without launching Gradio or touching the agent/LLM."""

from langchain_core.messages import AIMessage, HumanMessage

from app import _history_to_messages


def test_empty_history_just_wraps_the_new_message():
    messages = _history_to_messages([], "How many annual leave days?")

    assert len(messages) == 1
    assert isinstance(messages[0], HumanMessage)
    assert messages[0].content == "How many annual leave days?"


def test_prior_turns_convert_to_alternating_messages():
    history = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello! How can I help?"},
    ]

    messages = _history_to_messages(history, "What's the sick leave policy?")

    assert [type(m) for m in messages] == [HumanMessage, AIMessage, HumanMessage]
    assert messages[0].content == "Hi"
    assert messages[1].content == "Hello! How can I help?"
    assert messages[2].content == "What's the sick leave policy?"
