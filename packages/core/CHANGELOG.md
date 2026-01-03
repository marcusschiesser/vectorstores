# @vectorstores/core

## 0.1.8

### Patch Changes

- f428b0d: Add insertText to VectorStoreIndex to quickly add text to the store

## 0.1.7

### Patch Changes

- 42c7cc4: Add multi-modal embeddings to VectorStoreIndex
- 42c7cc4: Remove embedFunc from vector store - set in VectorStoreIndex instead

## 0.1.6

### Patch Changes

- 925bff9: Add hybrid and BM25 search support to vector stores.
  SimpleVectorStore now includes a fallback BM25 implementation.
  Native support added for Weaviate, ElasticSearch, MongoDB Atlas, and PostgreSQL.

## 0.1.5

### Patch Changes

- 25cd6b3: Remove storageContext - directly pass vectorStore

## 0.1.4

### Patch Changes

- 84dd436: remove indexstore (not needed by VectorStoreIndex if vector store is storing text)
- 52a2451: Remove obsolete docStore (after simplifying doc strategies)
- 84dd436: Add storesText to SimpleVectorStore
- 52a2451: Simplified doc strategies to be based on ref doc id instead of doc hash

## 0.1.3

### Patch Changes

- 38d60b5: fix: passing embedFunc to VectorStoreIndex still requires Settings.embedFunc

## 0.1.2

### Patch Changes

- b068cd2: reduce size

## 0.1.1

### Patch Changes

- cbae32d: Add formatLLM to simplify Agentic RAG
