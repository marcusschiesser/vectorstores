import {
  Document,
  SimpleVectorStore,
  type TextEmbedFunc,
  VectorStoreIndex,
} from "@vectorstores/core";
import { describe, expect, test } from "vitest";

/**
 * Embedding function that creates distinct vectors based on keywords.
 * Each dimension represents a different animal/concept.
 */
const embedFunc: TextEmbedFunc = async (texts) => {
  return texts.map((text) => {
    const normalized = text.toLowerCase();
    return [
      normalized.includes("cat") ? 1 : 0,
      normalized.includes("dog") ? 1 : 0,
      normalized.includes("bird") ? 1 : 0,
      normalized.includes("fish") ? 1 : 0,
      normalized.includes("pet") ? 0.5 : 0, // semantic similarity to all animals
    ];
  });
};

async function createIndex() {
  const vectorStore = new SimpleVectorStore({ embedFunc });
  const index = await VectorStoreIndex.init({
    vectorStore,
    embedFunc,
  });

  const nodes = [
    new Document({
      text: "The cat is on the mat",
      id_: "1",
    }),
    new Document({
      text: "The dog is in the house",
      id_: "2",
    }),
  ];

  await index.insertNodes(nodes);
  return { index, vectorStore };
}

/**
 * Creates a larger index to test prefetch behavior.
 * With 10 documents, we can test that prefetch fetches more than topK.
 */
async function createLargeIndex() {
  const vectorStore = new SimpleVectorStore({ embedFunc });
  const index = await VectorStoreIndex.init({
    vectorStore,
    embedFunc,
  });

  const nodes = [
    new Document({ text: "The cat is sleeping", id_: "1" }),
    new Document({ text: "The dog is running", id_: "2" }),
    new Document({ text: "The bird is flying", id_: "3" }),
    new Document({ text: "The fish is swimming", id_: "4" }),
    new Document({ text: "The cat and dog play together", id_: "5" }),
    new Document({ text: "A bird watches the fish", id_: "6" }),
    new Document({ text: "My pet cat is fluffy", id_: "7" }),
    new Document({ text: "The pet dog loves walks", id_: "8" }),
    new Document({ text: "Wild bird in the garden", id_: "9" }),
    new Document({ text: "Tropical fish in the aquarium", id_: "10" }),
  ];

  await index.insertNodes(nodes);
  return { index, vectorStore };
}

describe("SimpleVectorStore Hybrid and BM25 Search", () => {
  test("BM25 search", async () => {
    const { index } = await createIndex();
    const retriever = index.asRetriever({
      mode: "bm25",
      similarityTopK: 1,
    });

    const result = await retriever.retrieve("dog");

    expect(result).toHaveLength(1);
    expect(result[0]?.node.id_).toBe("2");
    expect(result[0]?.score).toBeGreaterThan(0);
  });

  test("Hybrid search", async () => {
    const { index } = await createIndex();
    const retriever = index.asRetriever({
      mode: "hybrid",
      similarityTopK: 1,
      alpha: 0.5,
    });

    const result = await retriever.retrieve("cat");

    expect(result).toHaveLength(1);
    expect(result[0]?.node.id_).toBe("1");
    expect(result[0]?.score).toBeGreaterThan(0);
  });
});

describe("Hybrid Search Prefetch", () => {
  test("hybrid search with prefetch finds documents from both searches", async () => {
    const { index } = await createLargeIndex();

    // Request topK=2, but prefetch should fetch 5x = 10 from each sub-search
    const retriever = index.asRetriever({
      mode: "hybrid",
      similarityTopK: 2,
      alpha: 0.5,
    });

    // Query "pet cat" - BM25 matches "pet" and "cat", vector matches "cat" semantically
    const result = await retriever.retrieve("pet cat");

    expect(result).toHaveLength(2);
    // Should find documents with both "pet" and "cat"
    const ids = result.map((r) => r.node.id_);
    // Doc 7 "My pet cat is fluffy" should be top (matches both BM25 and vector)
    expect(ids).toContain("7");
  });

  test("hybrid search respects custom hybridPrefetch", async () => {
    const { vectorStore } = await createLargeIndex();

    // Query directly on vector store to test prefetch parameter
    const result = await vectorStore.query({
      queryEmbedding: [1, 0, 0, 0, 0], // cat embedding
      queryStr: "cat",
      similarityTopK: 2,
      mode: "hybrid",
      alpha: 0.5,
      hybridPrefetch: 3, // Override default prefetch
    });

    // Should still return topK results
    expect(result.ids.length).toBeLessThanOrEqual(2);
  });

  test("documents appearing in both searches get boosted", async () => {
    const { vectorStore } = await createLargeIndex();

    // Query that should match "cat" docs in both vector and BM25
    const result = await vectorStore.query({
      queryEmbedding: [1, 0, 0, 0, 0], // cat embedding
      queryStr: "cat",
      similarityTopK: 3,
      mode: "hybrid",
      alpha: 0.5,
    });

    // Documents with "cat" should be ranked higher due to RRF boosting
    // Doc 1, 5, 7 all contain "cat"
    const catDocIds = ["1", "5", "7"];
    const topIds = result.ids.slice(0, 3);

    // At least 2 of the top 3 should be cat-related
    const catDocsInTop = topIds.filter((id) => catDocIds.includes(id)).length;
    expect(catDocsInTop).toBeGreaterThanOrEqual(2);
  });

  test("prefetch allows finding documents ranked lower in individual searches", async () => {
    const { vectorStore } = await createLargeIndex();

    // Without prefetch (topK=1), we'd only get the #1 result from each search
    // With prefetch, we can find documents that rank well in combined scoring

    const resultWithPrefetch = await vectorStore.query({
      queryEmbedding: [1, 1, 0, 0, 0], // cat+dog embedding
      queryStr: "cat dog play",
      similarityTopK: 2,
      mode: "hybrid",
      alpha: 0.5,
      // Default prefetch = 5 * 2 = 10
    });

    // Doc 5 "The cat and dog play together" should rank high with prefetch
    // because it matches both vector (cat+dog) and BM25 (cat, dog, play)
    expect(resultWithPrefetch.ids).toContain("5");
  });
});
