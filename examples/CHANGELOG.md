# @vectorstores/examples

## 0.1.6

### Patch Changes

- fddc11c: Add LibSQL/Turso vector store support with:

  - Vector search (default mode) using native vector32() and vector_distance_cos()
  - BM25 full-text search mode using FTS5
  - Hybrid search mode combining vector + FTS5
  - Metadata filtering with all standard operators
  - Collection management

## 0.1.5

### Patch Changes

- f428b0d: Add insertText to VectorStoreIndex to quickly add text to the store

## 0.1.4

### Patch Changes

- 42c7cc4: Remove embedFunc from vector store - set in VectorStoreIndex instead

## 0.1.3

### Patch Changes

- 25cd6b3: Remove storageContext - directly pass vectorStore

## 0.1.2

### Patch Changes

- 84dd436: remove indexstore (not needed by VectorStoreIndex if vector store is storing text)
- 52a2451: Remove obsolete docStore (after simplifying doc strategies)
- 84dd436: Add storesText to SimpleVectorStore
- 52a2451: Simplified doc strategies to be based on ref doc id instead of doc hash

## 0.1.1

### Patch Changes

- cbae32d: Add formatLLM to simplify Agentic RAG
