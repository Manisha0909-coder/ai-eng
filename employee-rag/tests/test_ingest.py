"""Offline: rag/ingest.py's loaders, chunking, and hash logic, all against
a small temp document set -- no real embeddings, no model downloads (none
of this touches build_vectorstore(), the only function that needs one)."""

from pathlib import Path

import pytest
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate

from rag import config, ingest


@pytest.fixture
def temp_docs(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DOCUMENTS_DIR", tmp_path)
    return tmp_path


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_loads_txt_and_md(temp_docs):
    _write(temp_docs / "a.txt", "Heading:\nSome text.")
    _write(temp_docs / "sub" / "b.md", "# Title\n\n## Section\nBody text.")

    chunks = ingest.load_chunks()

    sources = {c.metadata["source"] for c in chunks}
    assert "a.txt" in sources
    assert "sub/b.md" in sources


def test_loads_pdf(temp_docs):
    pdf_path = temp_docs / "c.pdf"
    doc = SimpleDocTemplate(str(pdf_path), pagesize=LETTER)
    styles = getSampleStyleSheet()
    doc.build([Paragraph("Hello from a PDF.", styles["Normal"])])

    chunks = ingest.load_chunks()

    pdf_chunks = [c for c in chunks if c.metadata["source"] == "c.pdf"]
    assert pdf_chunks
    assert "Hello from a PDF" in pdf_chunks[0].page_content


def test_chunk_metadata_fields(temp_docs):
    _write(
        temp_docs / "hr" / "policy.md",
        "# My Policy\n\n**Effective Date:** 2026-01-01\n\n## Section One\nBody text here.",
    )

    chunks = ingest.load_chunks()
    chunk = next(c for c in chunks if c.metadata["source"] == "hr/policy.md")

    assert chunk.metadata["title"] == "My Policy"
    assert chunk.metadata["category"] == "hr"
    assert chunk.metadata["effective_date"] == "2026-01-01"
    assert chunk.metadata["chunk_id"] == "hr/policy.md::0"


def test_core_category_for_flat_txt_files(temp_docs):
    _write(temp_docs / "flat.txt", "Heading:\nBody.")

    chunks = ingest.load_chunks()

    assert chunks[0].metadata["category"] == "core"


def test_section_heading_tracks_nearest_heading(temp_docs):
    _write(
        temp_docs / "a.txt",
        "Intro text with no heading.\n\nFirst Section:\nContent A.\n\nSecond Section:\nContent B.",
    )

    chunks = ingest.load_chunks()

    headings = [c.metadata["section_heading"] for c in chunks]
    assert "" in headings  # the no-heading intro chunk
    assert "First Section" in headings
    assert "Second Section" in headings


def test_hash_changes_when_content_changes(temp_docs):
    _write(temp_docs / "a.txt", "Heading:\nOriginal.")
    hash_before = ingest._source_hash()

    _write(temp_docs / "a.txt", "Heading:\nChanged.")
    hash_after = ingest._source_hash()

    assert hash_before != hash_after


def test_hash_changes_when_chunking_config_changes(temp_docs, monkeypatch):
    _write(temp_docs / "a.txt", "Heading:\nSame content, different config.")
    hash_before = ingest._source_hash()

    monkeypatch.setattr(config, "CHUNK_SIZE", config.CHUNK_SIZE + 50)
    hash_after = ingest._source_hash()

    assert hash_before != hash_after


def test_empty_corpus_loads_no_chunks(temp_docs):
    assert ingest.load_chunks() == []
