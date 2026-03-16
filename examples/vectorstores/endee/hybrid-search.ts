/**
 * Hybrid search example for Endee Vector Store
 *
 * This example demonstrates:
 * - Creating a hybrid index with sparse vector support
 * - Querying with dense + sparse vectors
 * - Using filter tuning parameters
 * - Advanced query customization
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
  VectorStoreQueryMode,
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

/**
 * Simple BM25-like sparse vector generator (for demonstration)
 * In production, use a proper BM25 implementation
 */
function generateSparseVector(
  text: string,
  vocabularySize: number = 1000,
): { indices: number[]; values: number[] } {
  const words = text.toLowerCase().split(/\s+/);
  const termFreq = new Map<number, number>();

  // Simple hash function to map words to vocabulary indices
  words.forEach((word) => {
    const hash =
      Array.from(word).reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      vocabularySize;
    termFreq.set(hash, (termFreq.get(hash) || 0) + 1);
  });

  // Compute TF scores (normalized)
  const maxFreq = Math.max(...termFreq.values());
  const indices: number[] = [];
  const values: number[] = [];

  termFreq.forEach((freq, index) => {
    indices.push(index);
    values.push(freq / maxFreq); // Normalized term frequency
  });

  return { indices, values };
}

async function main() {
  console.log("🚀 Endee Vector Store - Hybrid Search Example\n");

  // 1. Create hybrid vector store
  console.log("Creating hybrid EndeeVectorStore...");
  const vectorStore = new EndeeVectorStore({
    indexName: "hybrid_example",
    url: "http://127.0.0.1:8080/api/v1",
    dimension: 384, // Dense vector dimension
    sparseDimension: 1000, // Sparse vector dimension (vocabulary size)
    batchSize: 50,
  });

  // 2. Create sample documents
  console.log("Creating sample documents...");
  const documents = [
    new Document({
      text: "Machine learning is a subset of artificial intelligence that focuses on algorithms.",
      metadata: { topic: "AI", difficulty: 5 },
    }),
    new Document({
      text: "Deep learning uses neural networks with multiple layers to process data.",
      metadata: { topic: "AI", difficulty: 7 },
    }),
    new Document({
      text: "Natural language processing enables computers to understand human language.",
      metadata: { topic: "NLP", difficulty: 6 },
    }),
    new Document({
      text: "Computer vision allows machines to interpret and understand visual information.",
      metadata: { topic: "CV", difficulty: 6 },
    }),
    new Document({
      text: "Reinforcement learning trains agents through rewards and penalties.",
      metadata: { topic: "RL", difficulty: 8 },
    }),
  ];

  // 3. Load documents
  console.log("\nLoading documents into vector store...");
  const index = await VectorStoreIndex.fromDocuments(documents, {
    vectorStore,
  });
  console.log("✓ Documents loaded successfully");

  // 4. Basic dense vector query
  console.log("\n--- Dense Vector Query (Default) ---");
  const retriever = index.asRetriever({ similarityTopK: 3 });
  const denseResults = await retriever.retrieve("What is machine learning?");

  console.log(`Found ${denseResults.length} results:`);
  denseResults.forEach((result, i) => {
    console.log(`\n${i + 1}. Score: ${result.score?.toFixed(4)}`);
    console.log(`   Text: ${result.node.getText().substring(0, 80)}...`);
    console.log(`   Topic: ${result.node.metadata.topic}`);
  });

  // 5. Hybrid query with sparse vectors
  console.log("\n--- Hybrid Query (Dense + Sparse) ---");

  const queryText = "neural networks and deep learning";
  const queryEmbedding = (await Settings.embedFunc([queryText]))[0];
  const { indices: sparseIndices, values: sparseValues } =
    generateSparseVector(queryText);

  console.log(`Query: "${queryText}"`);
  console.log(`Sparse vector: ${sparseIndices.length} non-zero terms`);

  const hybridResults = await vectorStore.query({
    queryEmbedding: queryEmbedding!,
    similarityTopK: 3,
    mode: VectorStoreQueryMode.HYBRID,
    customParams: {
      sparseIndices,
      sparseValues,
    },
  });

  console.log(`\nFound ${hybridResults.nodes?.length || 0} results:`);
  hybridResults.nodes?.forEach((node, i) => {
    console.log(
      `\n${i + 1}. Similarity: ${hybridResults.similarities[i]?.toFixed(4)}`,
    );
    console.log(`   Text: ${node.getText().substring(0, 80)}...`);
    console.log(`   Topic: ${node.metadata.topic}`);
  });

  // 6. Hybrid query with filter tuning
  console.log("\n--- Hybrid Query with Filter Tuning ---");

  const tunedResults = await vectorStore.query({
    queryEmbedding: queryEmbedding!,
    similarityTopK: 3,
    mode: VectorStoreQueryMode.HYBRID,
    filters: {
      filters: [
        {
          key: "difficulty",
          value: 6,
          operator: FilterOperator.GTE,
        },
      ],
    },
    customParams: {
      sparseIndices,
      sparseValues,
      ef: 512, // Higher search quality
      prefilterCardinalityThreshold: 5000,
      filterBoostPercentage: 30,
    },
  });

  console.log(
    `\nFound ${tunedResults.nodes?.length || 0} results (difficulty >= 6):`,
  );
  tunedResults.nodes?.forEach((node, i) => {
    console.log(
      `\n${i + 1}. Similarity: ${tunedResults.similarities[i]?.toFixed(4)}`,
    );
    console.log(`   Text: ${node.getText().substring(0, 80)}...`);
    console.log(
      `   Topic: ${node.metadata.topic}, Difficulty: ${node.metadata.difficulty}`,
    );
  });

  // 7. Compare dense vs hybrid results
  console.log("\n--- Performance Comparison ---");
  console.log(`Dense-only results: ${denseResults.length}`);
  console.log(`Hybrid results: ${hybridResults.nodes?.length || 0}`);
  console.log(
    "\nNote: Hybrid search combines semantic (dense) and lexical (sparse) matching",
  );
  console.log(
    "for more robust retrieval, especially for keyword-specific queries.",
  );

  console.log("\n✅ Example completed successfully!");
}

// Run the example
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
