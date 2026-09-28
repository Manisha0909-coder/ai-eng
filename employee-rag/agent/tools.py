"""Tools the agent can call. Currently just the employee-rag pipeline itself,
wrapped so the same retrieval/reranking/generation logic that backs api.py is
what the agent uses too -- one pipeline, two front ends.
"""

from langchain_core.tools import tool

from rag.pipeline import get_pipeline


@tool
def search_employee_policies(question: str) -> str:
    """Search company employee policy documents (annual/sick/maternity leave,
    work-from-home, IT/security, expenses, code of conduct) to answer an
    employee's question. Use this for any question about company policy --
    do not guess at policy specifics from general knowledge."""

    result = get_pipeline().answer(question)

    sources = sorted({s["source"] for s in result["sources"]})
    if not sources:
        return result["answer"]

    return f"{result['answer']}\n\nSources: {', '.join(sources)}"
