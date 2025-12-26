import {
  Document,
  SimpleVectorStore,
  VectorStoreIndex,
  type TextEmbedFunc,
} from "@vectorstores/core";
import { describe, expect, test } from "vitest";

const embedFunc: TextEmbedFunc = async (texts) => {
  return texts.map((text) => {
    const normalized = text.toLowerCase();
    return [
      normalized.includes("cat") ? 1 : 0,
      normalized.includes("dog") ? 1 : 0,
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
  return { index };
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
