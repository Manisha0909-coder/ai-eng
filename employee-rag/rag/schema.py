"""Structured-output schema for RAGPipeline.answer_structured() (see
rag/pipeline.py) -- validated via Pydantic rather than hoping the model's
plain-text answer happens to be well-formed."""

from typing import List, Literal

from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str
    section_heading: str = ""
    chunk_id: str = ""


class AnswerPayload(BaseModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    abstained: bool = False
