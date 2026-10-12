"""Offline: rag/schema.py's Pydantic validation, no pipeline/LLM involved."""

import pytest
from pydantic import ValidationError

from rag.schema import AnswerPayload, Citation


def test_answer_payload_defaults():
    payload = AnswerPayload(answer="You get 20 days.")

    assert payload.citations == []
    assert payload.confidence == "medium"
    assert payload.abstained is False


def test_citation_defaults_to_empty_strings():
    citation = Citation(source="employee_policy.txt")

    assert citation.section_heading == ""
    assert citation.chunk_id == ""


def test_confidence_must_be_one_of_the_allowed_values():
    with pytest.raises(ValidationError):
        AnswerPayload(answer="x", confidence="very high")


def test_answer_payload_round_trips_through_dict():
    payload = AnswerPayload(
        answer="You get 20 days.",
        citations=[Citation(source="employee_policy.txt", section_heading="Annual Leave", chunk_id="x::1")],
        confidence="high",
        abstained=False,
    )

    rebuilt = AnswerPayload(**payload.model_dump())

    assert rebuilt == payload
