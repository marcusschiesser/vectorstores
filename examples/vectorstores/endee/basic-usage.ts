/**
 * Basic usage example for Endee Vector Store
 *
 * This example demonstrates:
 * - Creating an EndeeVectorStore with auto-index creation
 * - Loading documents into the vector store
 * - Querying with retriever
 * - Using filters
 * - Deleting documents
 *
 * Prerequisites:
 * - Endee server running on localhost:8080
 * - Run: docker run -p 8080:8080 endee/endee:latest
 */

import {
  Document,
  FilterOperator,
  Settings,
  VectorStoreIndex,
} from "@vectorstores/core";
import { EndeeVectorStore } from "@vectorstores/endee";

// Configure embedding function
Settings.embedFunc = async (texts: string[]) => {
  // Replace with your actual embedding function
  // This is a placeholder that generates random embeddings
  return texts.map(() =>
    Array.from({ length: 384 }, () => Math.random() * 2 - 1),
  );
};

async function main() {
  console.log("🚀 Endee Vector Store - Basic Usage Example\n");

  // 1. Create vector store with auto-index creation
  console.log("Creating EndeeVectorStore...");
  const vectorStore = new EndeeVectorStore({
    indexName: "basic_example",
    url: "http://127.0.0.1:8080/api/v1",
    dimension: 384, // Should match your embedding dimension
    batchSize: 50,
  });

  // 2. Create sample documents with metadata
  console.log("Creating sample documents...");
  const documents = [
    new Document({
      text: "The quick brown fox jumps over the lazy dog.",
      metadata: { category: "animals", score: 95 },
    }),
    new Document({
      text: "A journey of a thousand miles begins with a single step.",
      metadata: { category: "wisdom", score: 88 },
    }),
    new Document({
      text: "To be or not to be, that is the question.",
      metadata: { category: "literature", score: 92 },
    }),
    new Document({
      text: "I think, therefore I am.",
      metadata: { category: "philosophy", score: 90 },
    }),
    new Document({
      text: "All you need is love.",
      metadata: { category: "music", score: 85 },
    }),
  ];

  // 3. Load documents into vector store
  console.log("\nLoading documents into vector store...");
  const index = await VectorStoreIndex.fromDocuments(documents, {
    vectorStore,
  });
  console.log("✓ Documents loaded successfully");

  // 4. Basic query
  console.log("\n--- Basic Query ---");
  const retriever = index.asRetriever({ similarityTopK: 3 });
  const results = await retriever.retrieve("What is the meaning of life?");

  console.log(`Found ${results.length} results:`);
  results.forEach((result, i) => {
    console.log(`\n${i + 1}. Score: ${result.score?.toFixed(4)}`);
    console.log(`   Text: ${result.node.getText()}`);
    console.log(`   Metadata:`, result.node.metadata);
  });

  // 5. Query with filters
  console.log("\n--- Query with Filters ---");
  const filteredRetriever = index.asRetriever({
    similarityTopK: 5,
    filters: {
      filters: [
        {
          key: "category",
          value: "philosophy",
          operator: FilterOperator.EQ,
        },
      ],
    },
  });

  const filteredResults = await filteredRetriever.retrieve("thinking");
  console.log(
    `\nFound ${filteredResults.length} results in 'philosophy' category:`,
  );
  filteredResults.forEach((result, i) => {
    console.log(`\n${i + 1}. Score: ${result.score?.toFixed(4)}`);
    console.log(`   Text: ${result.node.getText()}`);
    console.log(`   Category: ${result.node.metadata.category}`);
  });

  // 6. Query with numeric range filter
  console.log("\n--- Query with Numeric Range Filter ---");
  const rangeRetriever = index.asRetriever({
    similarityTopK: 5,
    filters: {
      filters: [
        {
          key: "score",
          value: 90,
          operator: FilterOperator.GTE,
        },
      ],
    },
  });

  const rangeResults = await rangeRetriever.retrieve("famous quotes");
  console.log(`\nFound ${rangeResults.length} results with score >= 90:`);
  rangeResults.forEach((result, i) => {
    console.log(`\n${i + 1}. Score: ${result.score?.toFixed(4)}`);
    console.log(`   Text: ${result.node.getText()}`);
    console.log(`   Document Score: ${result.node.metadata.score}`);
  });

  // 7. Check if document exists
  console.log("\n--- Check Document Existence ---");
  const docId = documents[0]!.id_;
  const exists = await vectorStore.exists(docId);
  console.log(`Document ${docId} exists: ${exists}`);

  // 8. Delete a document
  console.log("\n--- Delete Document ---");
  console.log(`Deleting document: ${docId}`);
  await vectorStore.delete(docId);
  const existsAfterDelete = await vectorStore.exists(docId);
  console.log(`Document ${docId} exists after delete: ${existsAfterDelete}`);

  console.log("\n✅ Example completed successfully!");
}

// Run the example
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
