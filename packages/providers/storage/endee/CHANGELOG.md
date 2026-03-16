# @vectorstores/endee

## 0.2.0

### Minor Changes

- c1a1e1a: Add Endee vector store provider with support for dense, sparse, and hybrid search

  This release introduces a new vector store provider for Endee, a TypeScript vector database that supports:

  - Dense vector search with multiple distance metrics (cosine, L2, IP)
  - Sparse vector search for BM25-like retrieval
  - Hybrid search combining dense and sparse vectors
  - Advanced filtering with metadata
  - Filter tuning parameters (prefilterCardinalityThreshold, filterBoostPercentage)
  - Automatic index creation
  - Batch uploads for efficient data ingestion

  Key features:

  - Lazy initialization pattern for Endee client and index
  - Support for EQ, IN, GT, GTE, LT, LTE filter operators
  - Custom query parameters for hybrid search and filter tuning
  - Comprehensive documentation and examples
