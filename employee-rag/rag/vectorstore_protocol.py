"""The minimal interface HybridRetriever (rag/retrieval.py) actually
needs from a vector store -- deliberately narrow, so swapping the
backend (Chroma, pgvector, anything else) never requires implementing
that backend's full client API, just these two methods.

langchain_chroma.Chroma already satisfies this by duck typing; it's
listed here as a Protocol purely for documentation and type-checking,
not because anything casts to it at runtime.
"""

from typing import Any, Dict, List, Protocol

from langchain_core.documents import Document


class VectorStore(Protocol):
    def get(self, include: List[str]) -> Dict[str, Any]:
        """Returns {"documents": [str, ...], "metadatas": [dict, ...]}
        for every stored chunk -- called once, at HybridRetriever
        construction, to build the in-memory BM25 index."""
        ...

    def similarity_search(self, query: str, k: int) -> List[Document]:
        """Returns the top-k most similar chunks."""
        ...
