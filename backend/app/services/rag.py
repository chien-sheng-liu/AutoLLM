from typing import List, Tuple

from .embeddings import EmbeddingService
from ..storage.vector_store import VectorStore, ChunkRecord


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    if chunk_size <= 0:
        return [text]
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]
        chunks.append(chunk)
        if end >= n:
            break
        start = end - max(0, chunk_overlap)
    return chunks


def retrieve(
    store: VectorStore,
    embedder: EmbeddingService,
    query: str,
    top_k: int,
) -> List[Tuple[ChunkRecord, float]]:
    qvec = embedder.embed_texts([query])[0]
    results = store.query_similar(qvec, top_k=top_k)
    return results


def build_context_snippets(chunks: List[Tuple[ChunkRecord, float]]) -> str:
    lines: List[str] = []
    for i, (cr, _score) in enumerate(chunks, start=1):
        name = cr.metadata.get("name") if isinstance(cr.metadata, dict) else None
        page = None
        if isinstance(cr.metadata, dict):
            p = cr.metadata.get("page")
            if isinstance(p, int):
                page = p
        header = f"[Source {i}] doc={name or cr.document_id}" + (f" page={page}" if page is not None else "")
        lines.append(header)
        lines.append(cr.text.strip())
        lines.append("")
    return "\n".join(lines)


def system_prompt_guidance() -> str:
    return (
        "You are a helpful assistant using RAG.\n"
        "Cite sources inline as [n] where n is the 1-based index of the source.\n"
        "Only answer from the provided sources; if the answer is not present, say you don't know.\n"
    )
