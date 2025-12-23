import {
  Document,
  SimpleVectorStore,
  VectorStoreQueryMode,
} from "@vectorstores/core";
import { describe, expect, test } from "vitest";

describe("SimpleVectorStore Hybrid and BM25 Search", () => {
  test("BM25 search", async () => {
    const vectorStore = new SimpleVectorStore();
    const nodes = [
      new Document({
        text: "The cat is on the mat",
        id_: "1",
        embedding: [1, 0],
      }),
      new Document({
        text: "The dog is in the house",
        id_: "2",
        embedding: [0, 1],
      }),
    ];
    await vectorStore.add(nodes);

    const result = await vectorStore.query({
      queryStr: "dog",
      similarityTopK: 1,
      mode: VectorStoreQueryMode.BM25,
    });

    expect(result.ids).toHaveLength(1);
    expect(result.ids[0]).toBe("2");
    expect(result.similarities[0]).toBeGreaterThan(0);
  });

  test("Hybrid search", async () => {
    const vectorStore = new SimpleVectorStore();
    const nodes = [
      new Document({
        text: "The cat is on the mat",
        id_: "1",
        embedding: [1, 0],
      }),
      new Document({
        text: "The dog is in the house",
        id_: "2",
        embedding: [0, 1],
      }),
    ];
    await vectorStore.add(nodes);

    const result = await vectorStore.query({
      queryStr: "cat",
      queryEmbedding: [1, 0],
      similarityTopK: 1,
      mode: VectorStoreQueryMode.HYBRID,
      alpha: 0.5,
    });

    expect(result.ids).toHaveLength(1);
    expect(result.ids[0]).toBe("1");
    expect(result.similarities[0]).toBeGreaterThan(0);
  });
});
