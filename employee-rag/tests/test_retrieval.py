"""Offline: HybridRetriever tested against a fake vectorstore -- no real
embeddings, no model downloads. BM25 runs for real (it's pure Python, no
model needed); only the vector half is faked, with a hand-picked search
order so tests can control both retrievers' rankings precisely."""

from langchain_core.documents import Document

from rag.retrieval import HybridRetriever, _tokenize


class _FakeVectorStore:
    """Minimal stand-in for Chroma: HybridRetriever only ever calls
    .get(include=[...]) once (at construction) and .similarity_search()
    per query."""

    def __init__(self, documents, search_order=None):
        self._documents = documents
        self._search_order = documents if search_order is None else search_order

    def get(self, include=None):
        return {
            "documents": [d.page_content for d in self._documents],
            "metadatas": [d.metadata for d in self._documents],
        }

    def similarity_search(self, query, k):
        return self._search_order[:k]


def _doc(text, **metadata):
    return Document(page_content=text, metadata=metadata)


# --- tokenizer ---


def test_tokenizer_lowercases_and_strips_punctuation():
    assert _tokenize("Can I expense alcohol?") == ["can", "i", "expense", "alcohol"]


def test_tokenizer_keeps_hyphenated_numeric_compounds_intact():
    assert "12-weeks" in _tokenize("Employees receive 12-weeks of leave.")


def test_tokenizer_keeps_plain_numbers_intact():
    assert "1500" in _tokenize("A daily allowance of 1500 rupees.")


def test_tokenizer_light_stemming_folds_simple_variants():
    assert _tokenize("working") == ["work"]
    assert _tokenize("managers") == _tokenize("manager")
    assert _tokenize("days") == ["day"]


def test_tokenizer_stemmer_is_crude_not_a_real_lemmatizer():
    # Documented limitation: naive "-es" stripping over-stems a word whose
    # singular already ends in "e" (allowance -> allowanc, not allowance).
    # BM25 only needs query/doc tokens to overlap consistently, not to be
    # real dictionary words, so this is an accepted trade-off, not a bug
    # to chase with a heavier (downloaded) stemmer.
    assert _tokenize("allowances") == ["allowanc"]


def test_tokenizer_does_not_mangle_short_words():
    # "twice" must survive untouched -- it's a literal required answer
    # term in the golden dataset.
    assert _tokenize("twice") == ["twice"]


# --- RRF math (hand-computed) ---


def test_rrf_fuses_scores_from_both_retrievers():
    doc_a = _doc("alpha")
    doc_b = _doc("beta")

    vs = _FakeVectorStore(documents=[doc_a, doc_b], search_order=[doc_a, doc_b])
    retriever = HybridRetriever(vs)

    results = retriever.retrieve("alpha", vector_top_k=2, bm25_top_k=2, rrf_k=60)
    alpha = next(c for c in results if c.text == "alpha")

    # "alpha" is the only query token and appears only in doc_a, so BM25
    # ranks it rank 0; the fake vector search order also puts it rank 0.
    assert alpha.vector_rank == 0
    assert alpha.bm25_rank == 0
    assert abs(alpha.fused_score - (1 / 60 + 1 / 60)) < 1e-9


def test_doc_found_by_both_retrievers_outranks_doc_found_by_only_one():
    doc_both = _doc("policy remote work process")
    doc_filler = _doc("another filler filler filler document")
    doc_vector_top = _doc("completely unrelated filler text filler")

    # BM25 corpus order matters for tie-breaking zero-overlap scores
    # (Python's sort is stable): doc_filler (index 1) must come before
    # doc_vector_top (index 2) so it wins the tie and survives bm25_top_k=2,
    # pushing doc_vector_top out of BM25's results entirely.
    vs = _FakeVectorStore(
        documents=[doc_both, doc_filler, doc_vector_top],
        search_order=[doc_vector_top, doc_both, doc_filler],
    )
    retriever = HybridRetriever(vs)

    results = retriever.retrieve(
        "policy remote work process", vector_top_k=2, bm25_top_k=2
    )

    both = next(c for c in results if c.text == doc_both.page_content)
    vector_top = next(c for c in results if c.text == doc_vector_top.page_content)

    assert both.vector_rank == 1 and both.bm25_rank == 0
    assert vector_top.vector_rank == 0 and vector_top.bm25_rank is None
    # Despite doc_vector_top having the single best individual vector rank,
    # doc_both (found by both retrievers) ranks higher overall.
    assert results[0].text == doc_both.page_content


# --- empty corpus ---


def test_empty_corpus_does_not_crash():
    vs = _FakeVectorStore(documents=[], search_order=[])
    retriever = HybridRetriever(vs)

    assert retriever.retrieve("anything") == []


# --- metadata filter ---


def test_metadata_filter_only_returns_matching_category():
    hr_doc = _doc("grievance process", category="hr")
    it_doc = _doc(
        "grievance shaped IT ticket", category="it"
    )  # shares tokens on purpose

    vs = _FakeVectorStore(documents=[hr_doc, it_doc], search_order=[hr_doc, it_doc])
    retriever = HybridRetriever(vs)

    results = retriever.retrieve("grievance", metadata_filter={"category": "hr"})

    assert results
    assert all(c.document.metadata["category"] == "hr" for c in results)
    assert any(c.text == hr_doc.page_content for c in results)
    assert not any(c.text == it_doc.page_content for c in results)
