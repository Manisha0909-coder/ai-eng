"""Build the Chroma vector index from every .txt file under documents/.

Idempotent: safe to call on every process start. Re-embeds from scratch
whenever the source documents change (detected via a content hash stored
alongside the index), otherwise reuses the existing persisted index.
"""

import hashlib

from langchain_chroma import Chroma
from langchain_community.document_loaders import TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag import config

_HASH_FILE = config.CHROMA_DIR / ".source_hash"


def _source_hash() -> str:
    """Hash the contents of every document so we know when to re-ingest."""

    hasher = hashlib.sha256()

    for path in sorted(config.DOCUMENTS_DIR.glob("*.txt")):
        hasher.update(path.name.encode("utf-8"))
        hasher.update(path.read_bytes())

    return hasher.hexdigest()


def load_chunks():
    """Load every .txt file in documents/ and split into chunks, tagged with source."""

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
    )

    all_chunks = []

    for path in sorted(config.DOCUMENTS_DIR.glob("*.txt")):
        documents = TextLoader(str(path)).load()
        chunks = text_splitter.split_documents(documents)

        for chunk in chunks:
            chunk.metadata["source"] = path.name

        all_chunks.extend(chunks)

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
