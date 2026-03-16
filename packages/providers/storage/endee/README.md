# @vectorstores/endee

Endee vector store provider for the vectorstores ecosystem.

Endee is a TypeScript vector database that supports dense, sparse, and hybrid vector searches with advanced filtering capabilities.

## Installation

```bash
npm install @vectorstores/endee @vectorstores/core
# or
pnpm add @vectorstores/endee @vectorstores/core
# or
yarn add @vectorstores/endee @vectorstores/core
```

You'll also need to install the Endee client:

```bash
npm install endee
```

## Basic Usage

```typescript
import { EndeeVectorStore } from "@vectorstores/endee";
import { Document, VectorStoreIndex } from "@vectorstores/core";

// Create vector store with auto-index creation
const vectorStore = new EndeeVectorStore({
  indexName: "my_index",
  url: "http://127.0.0.1:8080/api/v1", // default
  dimension: 1536, // OpenAI ada-002 dimension
});

// Load documents
const documents = [
  new Document({ text: "Hello world", metadata: { category: "greeting" } }),
  new Document({ text: "Goodbye world", metadata: { category: "farewell" } }),
];

// Create index and add documents
const index = await VectorStoreIndex.fromDocuments(documents, {
  vectorStore,
});

// Query
const retriever = index.asRetriever({ similarityTopK: 5 });
const results = await retriever.retrieve("hello");

console.log(results);
```

## Configuration Options

### EndeeVectorStoreParams

| Parameter         | Type                       | Default                        | Description                                   |
| ----------------- | -------------------------- | ------------------------------ | --------------------------------------------- |
| `indexName`       | `string`                   | **required**                   | Name of the Endee index                       |
| `client`          | `Endee`                    | -                              | Optional pre-configured Endee client          |
| `url`             | `string`                   | `http://127.0.0.1:8080/api/v1` | Endee server URL                              |
| `authToken`       | `string`                   | -                              | Authentication token for Endee server         |
| `batchSize`       | `number`                   | `100`                          | Number of vectors to upload in a single batch |
| `dimension`       | `number`                   | -                              | Vector dimension for auto-creating index      |
| `sparseDimension` | `number`                   | -                              | Sparse vector dimension for hybrid indexes    |
| `spaceType`       | `'cosine' \| 'l2' \| 'ip'` | `'cosine'`                     | Distance metric                               |
| `precision`       | `Precision`                | `'INT16'`                      | Vector precision                              |
| `M`               | `number`                   | -                              | HNSW parameter M                              |
| `efCon`           | `number`                   | -                              | HNSW parameter efCon                          |

### Using a Pre-configured Client

```typescript
import { Endee } from "endee";
import { EndeeVectorStore } from "@vectorstores/endee";

const client = new Endee({
  baseUrl: "http://localhost:8080/api/v1",
  authToken: "your-token",
});

const vectorStore = new EndeeVectorStore({
  indexName: "my_index",
  client, // Use existing client
});
```

## Hybrid Search

Endee supports hybrid search combining dense and sparse vectors:

```typescript
import { EndeeVectorStore } from "@vectorstores/endee";
import { VectorStoreIndex } from "@vectorstores/core";

// Create hybrid index
const vectorStore = new EndeeVectorStore({
  indexName: "hybrid_index",
  dimension: 1536,
  sparseDimension: 5000, // BM25 vocabulary size
});

// Query with sparse vectors via customParams
const queryResponse = await index.asQueryEngine().query({
  queryStr: "example query",
  customParams: {
    sparseIndices: [1, 5, 10, 100], // Sparse vector indices
    sparseValues: [0.8, 0.6, 0.4, 0.2], // Sparse vector values
  },
});
```

## Filtering

### Basic Filtering

```typescript
import { FilterOperator } from "@vectorstores/core";

const retriever = index.asRetriever({
  similarityTopK: 10,
  filters: {
    filters: [
      { key: "category", value: "greeting", operator: FilterOperator.EQ },
      { key: "score", value: 80, operator: FilterOperator.GTE },
    ],
    condition: "and",
  },
});

const results = await retriever.retrieve("hello");
```

### Filter by Document IDs

```typescript
const retriever = index.asRetriever({
  similarityTopK: 10,
  docIds: ["doc1", "doc2", "doc3"],
});

const results = await retriever.retrieve("hello");
```

## Filter Tuning Parameters

Endee provides advanced filter tuning for optimizing query performance:

```typescript
const results = await vectorStore.query({
  queryEmbedding: embedding,
  similarityTopK: 10,
  filters: myFilters,
  customParams: {
    ef: 512, // Search quality (max 1024)
    prefilterCardinalityThreshold: 10000, // Range: 1000-1000000
    filterBoostPercentage: 50, // Range: 0-100
  },
});
```

**Parameters:**

- **`ef`**: Controls search quality (higher = more accurate but slower). Max: 1024
- **`prefilterCardinalityThreshold`**: Threshold for pre-filtering vs post-filtering strategy
- **`filterBoostPercentage`**: Percentage boost applied to filter scores

## Known Limitations

### Unsupported Filter Operators

Endee does not support the following filter operators:

- `FilterOperator.NE` (not equal)
- `FilterOperator.NIN` (not in)
- `FilterOperator.ANY`
- `FilterOperator.ALL`
- `FilterOperator.TEXT_MATCH`
- `FilterOperator.CONTAINS`
- `FilterOperator.IS_EMPTY`

When these operators are used, a warning will be logged and the filter will be skipped.

### OR Conditions

Endee only supports AND conditions for filters. If you use `FilterCondition.OR`, a warning will be logged and filters will be treated as AND.

### Range Limitations

Endee's range filters work with values in the range 0-999. Values outside this range will trigger warnings and be skipped.

**Workaround**: Normalize your numeric metadata values to the 0-999 range before upserting:

```typescript
const normalizedScore = Math.floor((originalScore / maxScore) * 999);

const document = new Document({
  text: "content",
  metadata: {
    score: normalizedScore, // Use normalized value
  },
});
```

### Sparse Vectors

VectorStoreQuery doesn't have native fields for sparse vectors. Use `customParams` to pass sparse indices and values:

```typescript
const results = await vectorStore.query({
  queryEmbedding: denseEmbedding,
  similarityTopK: 10,
  customParams: {
    sparseIndices: [1, 5, 10],
    sparseValues: [0.8, 0.6, 0.4],
  },
});
```

## API Reference

### EndeeVectorStore

Extends `BaseVectorStore<Endee, EndeeCustomParams>`

#### Methods

##### `client(): Endee`

Returns the Endee client instance (lazy initialization).

##### `add(embeddingResults: BaseNode[]): Promise<string[]>`

Adds nodes to the vector store.

**Parameters:**

- `embeddingResults`: Array of nodes to insert

**Returns:** Array of node IDs that were added

##### `delete(refDocId: string): Promise<void>`

Deletes all nodes associated with a document reference ID.

**Parameters:**

- `refDocId`: The document reference ID

##### `exists(refDocId: string): Promise<boolean>`

Checks if any nodes exist for the given document reference ID.

**Parameters:**

- `refDocId`: The document reference ID to check

**Returns:** `true` if any nodes with this ref_doc_id exist

##### `query(query: VectorStoreQuery<EndeeCustomParams>, options?: object): Promise<VectorStoreQueryResult>`

Queries the vector store for the closest matching data.

**Parameters:**

- `query`: The VectorStoreQuery configuration
- `options`: Additional options (currently unused)

**Returns:** Query results with nodes, similarities, and IDs

## Examples

See the [examples directory](../../../../examples/vectorstores/endee/) for complete examples:

- **basic-usage.ts**: Basic vector store operations
- **hybrid-search.ts**: Hybrid search with sparse vectors

## License

MIT
