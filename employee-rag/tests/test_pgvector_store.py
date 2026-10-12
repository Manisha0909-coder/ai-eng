"""Integration test against a REAL local Postgres (docker-compose.pgvector.yml)
-- skipped automatically when that container isn't running, since this is a
local-only backend CI never spins up. Uses a fake embeddings object (fixed-size
deterministic vectors), not the real sentence-transformers model -- this test
is about round-tripping through Postgres correctly, not embedding quality
(already verified live via eval/benchmark_backends.py)."""

import pytest
from langchain_core.documents import Document

from rag import config

psycopg = pytest.importorskip("psycopg")


def _pgvector_available() -> bool:
    try:
        conn = psycopg.connect(config.PGVECTOR_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pgvector_available(),
    reason="pgvector container not running -- `docker compose -f docker-compose.pgvector.yml up -d`",
)


class _FakeEmbeddings:
    """Deterministic, fixed-size fake embeddings -- not semantically
    meaningful, just enough to exercise the real INSERT/SELECT round trip."""

    def embed_documents(self, texts):
        return [self.embed_query(t) for t in texts]

    def embed_query(self, text):
        seed = sum(ord(c) for c in text) % 1000
        return [((seed + i) % 100) / 100.0 for i in range(384)]


@pytest.fixture
def store():
    from rag.pgvector_store import PgVectorStore

    s = PgVectorStore(dsn=config.PGVECTOR_DSN, embeddings=_FakeEmbeddings())
    s.delete_all()
    yield s
    s.delete_all()


def test_add_and_count(store):
    assert store.count() == 0

    store.add_documents(
        [
            Document(
                page_content="Employees receive 20 days of annual leave.",
                metadata={"source": "a.txt"},
            ),
            Document(
                page_content="Employees receive 12 weeks of maternity leave.",
                metadata={"source": "a.txt"},
            ),
        ]
    )

    assert store.count() == 2


def test_get_returns_documents_and_metadatas(store):
    store.add_documents(
        [
            Document(
                page_content="Employees receive 20 days of annual leave.",
                metadata={"source": "a.txt"},
            )
        ]
    )

    result = store.get(include=["documents", "metadatas"])

    assert result["documents"] == ["Employees receive 20 days of annual leave."]
    assert result["metadatas"][0]["source"] == "a.txt"


def test_similarity_search_returns_documents(store):
    store.add_documents(
        [
            Document(
                page_content="Employees receive 20 days of annual leave.",
                metadata={"source": "a.txt"},
            ),
            Document(
                page_content="Employees receive 12 weeks of maternity leave.",
                metadata={"source": "b.txt"},
            ),
        ]
    )

    results = store.similarity_search("How many days of annual leave?", k=1)

    assert len(results) == 1
    assert isinstance(results[0], Document)


def test_delete_all_empties_the_table(store):
    store.add_documents(
        [
            Document(
                page_content="Employees receive 20 days of annual leave.",
                metadata={"source": "a.txt"},
            )
        ]
    )
    assert store.count() == 1

    store.delete_all()

    assert store.count() == 0
