"""Offline: judge prompt building and response parsing, with a fake LLM
standing in for the real judge call."""

from eval.judge import (
    JudgeVerdict,
    build_judge_prompt,
    judge_answer,
    parse_judge_response,
)


class _FakeLLM:
    def __init__(self, raw_response: str):
        self._raw_response = raw_response

    def invoke(self, prompt):
        class _Response:
            content = self._raw_response

        return _Response()


def test_parses_valid_judge_json():
    verdict = parse_judge_response(
        '{"faithful": true, "relevant": false, "reason": "partial match"}'
    )

    assert verdict.faithful is True
    assert verdict.relevant is False
    assert verdict.reason == "partial match"


def test_unparseable_response_yields_null_verdict_not_false():
    verdict = parse_judge_response("not json at all")

    # Unparseable means "we don't know," not "the judge said no" -- these
    # must be None, not False, so a flaky judge call never silently counts
    # as a failure.
    assert verdict.faithful is None
    assert verdict.relevant is None
    assert "unparseable" in verdict.reason


def test_json_missing_fields_defaults_to_null():
    verdict = parse_judge_response("{}")

    assert verdict.faithful is None
    assert verdict.relevant is None


def test_build_judge_prompt_includes_all_inputs():
    prompt = build_judge_prompt(
        "How many days?", "20 days of leave.", "You get 20 days."
    )

    assert "How many days?" in prompt
    assert "20 days of leave." in prompt
    assert "You get 20 days." in prompt


def test_judge_answer_uses_fake_llm_end_to_end():
    fake_llm = _FakeLLM(
        '{"faithful": true, "relevant": true, "reason": "matches context"}'
    )

    verdict = judge_answer(fake_llm, "question", "context", "answer")

    assert isinstance(verdict, JudgeVerdict)
    assert verdict.faithful is True
    assert verdict.relevant is True
