# @vectorstores/examples

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
