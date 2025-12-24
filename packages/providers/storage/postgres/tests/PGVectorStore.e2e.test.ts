import {
  Document,
  VectorStoreIndex,
  VectorStoreQueryMode,
  type TextEmbedFunc,
} from "@vectorstores/core";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGVectorStore } from "../src/PGVectorStore";

const shouldRunE2E = process.env.RUN_POSTGRES_E2E === "true";
const describeIfE2E = shouldRunE2E ? describe : describe.skip;

const embedFunc: TextEmbedFunc = async (texts) => {
  return texts.map((text) => {
    const normalized = text.toLowerCase();
    return [
      normalized.includes("cat") ? 1 : 0,
      normalized.includes("dog") ? 1 : 0,
      normalized.includes("bird") ? 1 : 0,
    ];
  });
};

describeIfE2E("PGVectorStore e2e", () => {
  let container: StartedPostgreSqlContainer;
  let store: PGVectorStore;
  let index: VectorStoreIndex;
  let catDoc: Document;
  let dogDoc: Document;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
      .withDatabase("vectorstores")
      .withUsername("vector")
      .withPassword("vector")
      .start();

    store = new PGVectorStore({
      clientConfig: {
        connectionString: container.getConnectionUri(),
      },
      dimensions: 3,
      embedFunc,
    });
    store.setCollection("e2e-tests");

    index = await VectorStoreIndex.init({
      vectorStore: store,
      embedFunc,
    });

    catDoc = new Document({
      text: "The cat is on the mat",
    });
    dogDoc = new Document({
      text: "The dog is in the house",
    });
    const birdDoc = new Document({
      text: "The bird soars in the sky",
    });

    await store.clearCollection();
    await index.insertNodes([catDoc, dogDoc, birdDoc]);
  }, 120_000);

  afterAll(async () => {
    if (store) {
      await store.clearCollection();
      const db = await store.client();
      await db.close();
    }

    if (container) {
      await container.stop();
    }
  }, 120_000);

  test("supports vector, bm25, and hybrid queries", async () => {
    const vectorRetriever = index.asRetriever({
      mode: VectorStoreQueryMode.DEFAULT,
      similarityTopK: 1,
    });
    const bm25Retriever = index.asRetriever({
      mode: VectorStoreQueryMode.BM25,
      similarityTopK: 1,
    });
    const hybridRetriever = index.asRetriever({
      mode: VectorStoreQueryMode.HYBRID,
      similarityTopK: 1,
      alpha: 0.4,
    });

    const vectorResult = await vectorRetriever.retrieve("cat");
    expect(vectorResult[0]?.node.id_).toEqual(catDoc.id_);

    const bm25Result = await bm25Retriever.retrieve("dog");
    expect(bm25Result[0]?.node.id_).toEqual(dogDoc.id_);
    expect(bm25Result[0]?.score).toBeGreaterThan(0);

    const hybridResult = await hybridRetriever.retrieve("cat");
    expect(hybridResult[0]?.node.id_).toEqual(catDoc.id_);
    expect(hybridResult[0]?.score).toBeGreaterThan(0);
  }, 120_000);
});
