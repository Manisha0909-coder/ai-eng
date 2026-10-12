"""Build the Chroma vector index from every supported document under
documents/ (recursively, including documents/extended/**).

Idempotent: safe to call on every process start. Re-embeds from scratch
whenever the source documents OR the chunking configuration change
(detected via a content+config hash stored alongside the index), otherwise
reuses the existing persisted index.

Supports .txt, .md, and .pdf. Chunking is heading-aware: a document is
first split into (heading, body) sections -- recognizing both markdown
"#"-style headings and the original docs' "Heading:" style -- and only
then split into fixed-size chunks within each section, so a chunk never
silently straddles two unrelated headings.
"""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from rag import config

_HASH_FILE = config.CHROMA_DIR / ".source_hash"

SUPPORTED_EXTENSIONS = (".txt", ".md", ".pdf")

# A markdown "#".."######" heading, or the original docs' short
# "Heading:" style (a short line ending in a colon, e.g. "Annual Leave:").
_MD_HEADING_RE = re.compile(r"^#{1,6}\s+(.*)$")
_TXT_HEADING_RE = re.compile(r"^([A-Za-z][A-Za-z0-9 /&()'-]{2,60}):\s*$")
_H1_RE = re.compile(r"^#\s+(.*)$")
_EFFECTIVE_DATE_RE = re.compile(
    r"\*\*Effective Date:\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", re.IGNORECASE
)

# A chunking-config fingerprint folded into the rebuild hash, so a config
# change (not just a content change) also triggers a re-embed. Bump
# "loader_version" whenever load_chunks()'s own logic changes in a way
# that would produce different chunks for the same documents/config.
_LOADER_VERSION = 2


@dataclass
class _Section:
    heading: Optional[str]
    text: str


def _category_for(path: Path) -> str:
    """Category = the document's immediate containing folder (e.g. "hr",
    "it", "finance", "security", "archive" under documents/extended/),
    or "core" for the original flat documents/*.txt files."""

    if path.parent == config.DOCUMENTS_DIR:
        return "core"
    return path.parent.name


def _read_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _load_raw_text(path: Path) -> str:
    if path.suffix == ".pdf":
        return _read_pdf_text(path)
    return path.read_text(encoding="utf-8")


def _extract_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        m = _H1_RE.match(line.strip())
        if m:
            return m.group(1).strip()
    stripped = text.strip()
    return stripped.splitlines()[0].strip() if stripped else fallback


def _extract_effective_date(text: str) -> Optional[str]:
    m = _EFFECTIVE_DATE_RE.search(text)
    return m.group(1) if m else None


def _split_into_sections(text: str) -> List[_Section]:
    """Split on headings (markdown or "Heading:" style). Text before the
    first heading becomes a section with heading=None."""

    sections: List[_Section] = []
    current_heading: Optional[str] = None
    current_lines: List[str] = []

    def _flush() -> None:
        body = "\n".join(current_lines).strip()
        if body:
            sections.append(_Section(heading=current_heading, text=body))

    for line in text.splitlines():
        stripped = line.strip()
        md_match = _MD_HEADING_RE.match(stripped)
        txt_match = _TXT_HEADING_RE.match(stripped) if not md_match else None

        if md_match:
            _flush()
            current_heading = md_match.group(1).strip()
            current_lines = []
        elif txt_match:
            _flush()
            current_heading = txt_match.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    _flush()
    return sections


def _iter_document_paths():
    for ext in SUPPORTED_EXTENSIONS:
        yield from sorted(config.DOCUMENTS_DIR.rglob(f"*{ext}"))


def config_fingerprint() -> str:
    return (
        f"chunk_size={config.CHUNK_SIZE};"
        f"chunk_overlap={config.CHUNK_OVERLAP};"
        f"loader_version={_LOADER_VERSION}"
    )


def _source_hash() -> str:
    """Hash every document's relative path + bytes, plus the chunking
    config fingerprint, so either kind of change triggers a rebuild."""

    hasher = hashlib.sha256()

    for path in _iter_document_paths():
        hasher.update(str(path.relative_to(config.DOCUMENTS_DIR)).encode("utf-8"))
        hasher.update(path.read_bytes())

    hasher.update(config_fingerprint().encode("utf-8"))

    return hasher.hexdigest()


def load_chunks() -> List[Document]:
    """Load every supported document under documents/ (recursively) and
    split into heading-aware chunks, tagged with source/title/
    section_heading/category/effective_date/chunk_id metadata.

    Chroma metadata values can't be None, so section_heading and
    effective_date fall back to "" when a document doesn't have one.
    """

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
    )

    all_chunks: List[Document] = []

    for path in _iter_document_paths():
        raw_text = _load_raw_text(path)
        title = _extract_title(raw_text, fallback=path.stem)
        effective_date = _extract_effective_date(raw_text)
        category = _category_for(path)
        source = str(path.relative_to(config.DOCUMENTS_DIR))

        chunk_index = 0
        for section in _split_into_sections(raw_text):
            for piece in text_splitter.split_text(section.text):
                metadata = {
                    "source": source,
                    "title": title,
                    "section_heading": section.heading or "",
                    "category": category,
                    "effective_date": effective_date or "",
                    "chunk_id": f"{source}::{chunk_index}",
                }
                all_chunks.append(Document(page_content=piece, metadata=metadata))
                chunk_index += 1

    return all_chunks


def get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)


def build_vectorstore(force: bool = False) -> Chroma:
    """Return a Chroma vectorstore over documents/, rebuilding only when needed."""

    config.CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    embeddings = get_embeddings()
    current_hash = _source_hash()
    previous_hash = _HASH_FILE.read_text().strip() if _HASH_FILE.exists() else None

    vectorstore = Chroma(
        collection_name=config.COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(config.CHROMA_DIR),
    )

    needs_rebuild = force or current_hash != previous_hash or vectorstore._collection.count() == 0

    if needs_rebuild:
        existing_ids = vectorstore.get()["ids"]

        if existing_ids:
            vectorstore.delete(ids=existing_ids)

        chunks = load_chunks()
        vectorstore.add_documents(chunks)
        _HASH_FILE.write_text(current_hash)

        print(f"Ingested {len(chunks)} chunks from {config.DOCUMENTS_DIR}")
    else:
        print(f"Reusing existing index ({vectorstore._collection.count()} chunks, unchanged)")

    return vectorstore


if __name__ == "__main__":
    build_vectorstore(force=True)
