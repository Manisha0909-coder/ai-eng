"""pgvector-backed vector store implementing the same minimal
VectorStore protocol Chroma does (rag/vectorstore_protocol.py) -- a
drop-in alternative so HybridRetriever's Python-side BM25 + RRF logic
works identically regardless of which backend build_vectorstore()
returns. Runs against a LOCAL docker-compose Postgres (free, no cloud,
not used by the deployed demo) -- see docker-compose.pgvector.yml.

Design choice, stated plainly: this does vector similarity only in
Postgres. The lexical half (BM25) and the RRF fusion stay exactly where
they already are, in rag/retrieval.py, for both backends -- Postgres
full-text search would be a reasonable alternative (and is what the
original ask suggested), but implementing hybrid search twice (once in
Python, once in SQL) for two backends that are meant to be
interchangeable wasn't worth the duplication and drift risk for this
project's scope. Chroma stays the default for the deployed demo; this
exists to demonstrate the pattern, not to replace it.
"""

import json
from typing import Any, Dict, List

import psycopg
from langchain_core.documents import Document
from pgvector.psycopg import register_vector

EMBEDDING_DIMENSIONS = 384  # sentence-transformers/all-MiniLM-L6-v2


class PgVectorStore:
    def __init__(self, dsn: str, embeddings):
        self._embeddings = embeddings
        self._conn = psycopg.connect(dsn, autocommit=True)
        # The "vector" type has to exist in the database before
        # register_vector() can look up its OID -- CREATE EXTENSION must
        # run first, as its own step, not folded into _ensure_schema().
        with self._conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        register_vector(self._conn)
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS chunks (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding VECTOR({EMBEDDING_DIMENSIONS}),
                    metadata JSONB NOT NULL
                );
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS chunks_embedding_idx "
                "ON chunks USING hnsw (embedding vector_cosine_ops);"
            )

    def count(self) -> int:
        with self._conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM chunks;")
            return cur.fetchone()[0]

    def delete_all(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute("TRUNCATE chunks RESTART IDENTITY;")

    def add_documents(self, documents: List[Document]) -> None:
        if not documents:
            return
        vectors = self._embeddings.embed_documents([d.page_content for d in documents])
        with self._conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO chunks (content, embedding, metadata) VALUES (%s, %s, %s);",
                [
                    (doc.page_content, vector, json.dumps(doc.metadata))
                    for doc, vector in zip(documents, vectors)
                ],
            )

    def get(self, include: List[str] = None) -> Dict[str, Any]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT content, metadata FROM chunks ORDER BY id;")
            rows = cur.fetchall()
        return {"documents": [r[0] for r in rows], "metadatas": [r[1] for r in rows]}

    def similarity_search(self, query: str, k: int) -> List[Document]:
        vector = self._embeddings.embed_query(query)
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT content, metadata FROM chunks ORDER BY embedding <=> %s::vector LIMIT %s;",
                (vector, k),
            )
            rows = cur.fetchall()
        return [Document(page_content=r[0], metadata=r[1]) for r in rows]
