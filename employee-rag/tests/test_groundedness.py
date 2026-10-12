"""Offline: pure string matching, no pipeline/LLM involved."""

from rag.groundedness import is_grounded, ungrounded_numbers


def test_grounded_when_every_number_appears_in_context():
    context = "Employees receive 20 days of annual leave per year."
    answer = "You get 20 days of annual leave."

    assert is_grounded(answer, context)
    assert ungrounded_numbers(answer, context) == []


def test_ungrounded_when_answer_invents_a_number():
    context = "Employees receive 20 days of annual leave per year."
    answer = "You get 25 days of annual leave."

    assert not is_grounded(answer, context)
    assert "25" in ungrounded_numbers(answer, context)


def test_percent_and_currency_numbers_recognized():
    context = "The company matches 50% of 401(k) contributions."
    answer = "The match is 50%."

    assert is_grounded(answer, context)


def test_date_recognized():
    context = "Effective Date: 2026-03-01"
    answer = "This took effect on 2026-03-01."

    assert is_grounded(answer, context)


def test_no_numbers_in_answer_is_trivially_grounded():
    context = "Some context with no relevant numbers."
    answer = "Please check with HR."

    assert is_grounded(answer, context)
