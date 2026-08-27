# Employee Policy RAG API — hybrid search (vector + BM25) + cross-encoder reranking.
FROM python:3.11-slim

WORKDIR /app

# libgomp1: required at runtime by torch/onnx on Debian slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV HF_HOME=/app/.cache/huggingface \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY rag/ ./rag/
COPY documents/ ./documents/
COPY api.py .

# Pre-download the embedding + reranker models at build time so the
# container's first request doesn't pay for a cold HuggingFace Hub fetch.
RUN python -c "from rag.ingest import get_embeddings; get_embeddings()" && \
    python -c "from rag.reranker import get_reranker; get_reranker()"

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
