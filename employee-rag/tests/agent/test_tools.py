"""Offline: get_pipeline() is monkeypatched, no embeddings/LLM are loaded."""

from agent import tools


class _FakePipeline:
    def __init__(self, result):
        self._result = result

    def answer(self, question):
        return self._result


def test_formats_answer_with_sources(monkeypatch):
    fake_result = {
        "answer": "Employees receive 20 days of annual leave per year.",
        "sources": [
            {"source": "employee_policy.txt", "text": "..."},
            {"source": "employee_policy.txt", "text": "..."},
        ],
    }
    monkeypatch.setattr(tools, "get_pipeline", lambda: _FakePipeline(fake_result))

    output = tools.search_employee_policies.invoke({"question": "How many annual leave days?"})

    assert "20 days of annual leave" in output
    assert "Sources: employee_policy.txt" in output


def test_no_sources_omits_sources_line(monkeypatch):
    fake_result = {"answer": "I don't have enough information to answer that.", "sources": []}
    monkeypatch.setattr(tools, "get_pipeline", lambda: _FakePipeline(fake_result))

    output = tools.search_employee_policies.invoke({"question": "What's the weather?"})

    assert output == "I don't have enough information to answer that."
    assert "Sources:" not in output
