# @vectorstores/core

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
