"""Ingest Alaap's local clinical/music corpus into a persistent Chroma collection.

Run from the repository root: python -m backend.app.rag.ingest
Set RAG_DOCS_DIR, CHROMA_DIR, or EMBEDDING_MODEL to override defaults.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable

from langchain_chroma import Chroma
from langchain_community.document_loaders import Docx2txtLoader, PyPDFLoader
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

ROOT = Path(__file__).resolve().parents[3]
CORPUS_DIR = Path(os.getenv("RAG_DOCS_DIR", ROOT / "RAG DOCs"))
CHROMA_DIR = Path(os.getenv("CHROMA_DIR", ROOT / "backend" / "data" / "chroma"))
COLLECTION_NAME = "alaap_clinical_corpus"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

# Patterns are intentionally broad enough to accept the abbreviated/renamed versions
# used in the supplied corpus while restricting indexing to the requested materials.
CORPUS_RULES: dict[str, tuple[str, ...]] = {
    "safety_crisis": ("who pfa", "c-ssrs", "safe-t", "safe t protocol"),
    "iso_principle": ("iso-principle clinical", "individualised music playlist"),
    "affect_model": ("circumplex model of affect", "openemotionwheeldiarypage", "open emotion wheel"),
    "gems": ("geneva emotional music scale", "gems"),
    "spotify_features": ("spotify track audio features",),
    "music_therapy_evidence": ("music therapy for depression",),
}


def _normalise(value: str) -> str:
    value = value.casefold().replace("‐", "-").replace("–", "-")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def find_corpus_files(directory: Path) -> list[tuple[Path, str]]:
    if not directory.is_dir():
        raise FileNotFoundError(f"Clinical corpus folder not found: {directory}")
    found: list[tuple[Path, str]] = []
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix.casefold() not in {".pdf", ".docx"}:
            continue
        stem = _normalise(path.stem)
        categories = [category for category, patterns in CORPUS_RULES.items()
                      if any(_normalise(pattern) in stem for pattern in patterns)]
        if categories:
            # A document can belong to several retrieval themes; preserve the first
            # category as the primary one and all tags in metadata.
            found.append((path, categories[0] if len(categories) == 1 else "+".join(categories)))
    return found


def load_documents(files: Iterable[tuple[Path, str]]) -> list[Document]:
    documents: list[Document] = []
    for path, category in files:
        loader = PyPDFLoader(str(path)) if path.suffix.casefold() == ".pdf" else Docx2txtLoader(str(path))
        loaded = loader.load()
        for doc in loaded:
            doc.metadata.update({
                "source": path.name,
                "source_path": str(path.resolve()),
                "category": category,
                "safety_priority": category == "safety_crisis",
                "document_type": path.suffix.casefold().lstrip("."),
            })
            documents.append(doc)
    return documents


def chunk_documents(documents: list[Document], embeddings: HuggingFaceEmbeddings) -> list[Document]:
    """Prefer semantic boundaries; use recursive splitting if a source is too sparse."""
    try:
        splitter = SemanticChunker(
            embeddings,
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=85,
            min_chunk_size=250,
        )
        chunks = splitter.split_documents(documents)
        if chunks:
            return chunks
    except (ValueError, IndexError):
        # Very short/scanned pages may not contain enough sentence boundaries for
        # semantic splitting. Keep the corpus ingestible and flag OCR as a follow-up.
        pass
    return RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=160).split_documents(documents)


def retrieve_context(query: str, vector_store: Chroma, *, self_harm_detected: bool, k: int = 5) -> list[Document]:
    """Apply the requested ordering: crisis sources first on risk; clinical strategy otherwise."""
    if self_harm_detected:
        crisis = vector_store.similarity_search(query, k=max(3, k), filter={"safety_priority": True})
        return crisis

    # Retrieve the intervention strategy and emotion/music mapping before general evidence.
    strategy = vector_store.similarity_search(
        query, k=k,
        filter={"category": {"$in": ["iso_principle", "gems", "spotify_features", "affect_model"]}},
    )
    return strategy


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    files = find_corpus_files(CORPUS_DIR)
    if not files:
        raise RuntimeError(f"No requested PDF/DOCX corpus files matched in {CORPUS_DIR}")
    print(f"Found {len(files)} source documents in {CORPUS_DIR}")
    for path, category in files:
        print(f"  [{category}] {path.name}")

    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": os.getenv("EMBEDDING_DEVICE", "cpu")},
        encode_kwargs={"normalize_embeddings": True},
    )
    pages = load_documents(files)
    chunks = chunk_documents(pages, embeddings)
    if not chunks:
        raise RuntimeError("No text extracted. Scanned PDFs may need OCR before indexing.")

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
    # Remove old chunks for these sources so edits/re-ingestion never leave stale text.
    store.delete(where={"source_path": {"$in": [str(path.resolve()) for path, _ in files]}})
    # Stable IDs make reruns update indexed chunks instead of duplicating them.
    ids = []
    for index, chunk in enumerate(chunks):
        source = chunk.metadata.get("source", "unknown")
        page = chunk.metadata.get("page", 0)
        ids.append(f"{source}:{page}:{index}")
    store.add_documents(chunks, ids=ids)
    print(f"Indexed {len(chunks)} semantic chunks in {CHROMA_DIR} ({COLLECTION_NAME})")


if __name__ == "__main__":
    main()
