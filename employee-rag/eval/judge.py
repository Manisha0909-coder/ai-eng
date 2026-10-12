"""LLM-as-judge: scores (a) faithfulness -- every claim in the answer
supported by the retrieved context (an answer that correctly abstains
counts as faithful), and (b) relevance -- does the answer address the
question. Off by default (--judge on run_eval.py): a real LLM call per
item, non-deterministic, and it costs budget the deterministic
string-match scoring doesn't need.

Strict JSON via Pydantic, temperature 0. A parse failure yields None (not
False) for both fields -- an unparseable judge response means "we don't
know," which is a different, more honest thing than "the judge said it
failed," and keeps a flaky judge call from silently counting as a miss.
"""

import json
from typing import Optional

from pydantic import BaseModel, ValidationError

JUDGE_PROMPT_TEMPLATE = """You are a strict evaluator of a RAG system's answer.

Question: {question}

Retrieved context:
{context}

Generated answer: {answer}

Score the answer on two dimensions and respond with ONLY a JSON object, no \
other text, no markdown fences:
{{"faithful": true|false, "relevant": true|false, "reason": "<one sentence>"}}

faithful: every factual claim in the answer is supported by the context \
(an answer that correctly abstains when the context doesn't cover the \
question is faithful).
relevant: the answer actually addresses the question asked.
"""


class JudgeVerdict(BaseModel):
    faithful: Optional[bool] = None
    relevant: Optional[bool] = None
    reason: str = ""


def build_judge_prompt(question: str, context: str, answer: str) -> str:
    return JUDGE_PROMPT_TEMPLATE.format(
        question=question, context=context, answer=answer
    )


def parse_judge_response(raw: str) -> JudgeVerdict:
    """Never raises -- an unparseable response becomes a null verdict,
    not a crash and not a silent False."""

    try:
        data = json.loads(raw)
        return JudgeVerdict(**data)
    except (json.JSONDecodeError, ValidationError, TypeError):
        return JudgeVerdict(reason=f"unparseable judge response: {raw!r}")


def judge_answer(llm, question: str, context: str, answer: str) -> JudgeVerdict:
    """Makes one real LLM call and returns a validated verdict. `llm` is
    any object exposing .invoke(prompt) -> response-with-.content (e.g.
    langchain_openai.ChatOpenAI), injected rather than constructed here so
    tests can pass a fake instead of a real network client."""

    prompt = build_judge_prompt(question, context, answer)
    raw = llm.invoke(prompt).content
    return parse_judge_response(raw)
