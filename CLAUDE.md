# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (pnpm is required)
pnpm install

# Build all packages
pnpm build

# Watch mode for development (all packages)
pnpm dev

# Watch specific package
pnpm turbo run dev --filter="./packages/core" --concurrency=100

# Run all tests (requires build first)
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Format check / fix
pnpm format
pnpm format:write

# Run a script during development
pnpm exec tsx my_script.ts

# Check for circular dependencies
pnpm circular-check
```

## Monorepo Structure

This is a pnpm monorepo using Turborepo. Key packages:

- **packages/core** (`@vectorstores/core`): Core library with abstract classes, interfaces, and runtime-agnostic code. Contains:

  - `indices/` - VectorStoreIndex for building and querying vector indices
  - `retriever/` - BaseRetriever and retrieval abstractions
  - `vector-store/` - BaseVectorStore, query modes (hybrid, BM25, etc.), and filters
  - `embeddings/` - Embedding model abstractions and utilities
  - `schema/` - Node types (Document, TextNode, ImageNode), metadata handling
  - `ingestion/` - Document processing pipeline and deduplication strategies
  - `node-parser/` - Text splitting (SentenceSplitter, etc.)
  - `global/` - Settings singleton for configuration (embedFunc, chunkSize, nodeParser)

- **packages/env** (`@vectorstores/env`): Environment compatibility layer for Node.js, Deno, Bun, Edge runtimes

- **packages/providers/** - Vector database integrations:

  - `storage/`: astra, azure, chroma, elastic-search, firestore, milvus, mongodb, pinecone, postgres, qdrant, supabase, upstash, weaviate
  - Other: assemblyai, cohere, discord, excel, notion

- **packages/readers/** - File readers: csv, docx, html, image, json, markdown, obsidian, pdf, text, xml

- **packages/node-parser/** - Specialized parsers: code, html

- **examples/** - Working examples organized by use case

## Architecture Patterns

### Embedding Configuration

Set embeddings via `Settings.embedFunc` or pass `embedFunc` to constructors:

```typescript
Settings.embedFunc = async (input: string[]) => {
  // Return embeddings array
};

async (input: string[]) => {
  // Return embeddings array
};
```

### Vector Store Query Modes

Supported modes in `VectorStoreQueryMode`: `default`, `sparse`, `hybrid`, `bm25`, `mmr`, `semantic_hybrid`

### Document Processing Flow

1. Documents are parsed into nodes via `NodeParser` (configured via `Settings.nodeParser` or defaults to `SentenceSplitter`)
2. Embeddings are computed via `embedFunc`
3. Nodes are stored in vector stores with optional deduplication (`DocStoreStrategy`)
4. Retrieval queries the vector store and returns `NodeWithScore[]`

### Adding New Providers

New packages go in `packages/providers/`. Use existing package.json and tsconfig.json as templates. Reference new packages in root tsconfig.json.

## Changesets for Version Bumps

Before PRs, create a changeset:

```bash
pnpm changeset
```
