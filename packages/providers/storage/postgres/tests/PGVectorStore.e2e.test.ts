import { Document, VectorStoreQueryMode } from "@vectorstores/core";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGVectorStore } from "../src/PGVectorStore";

const shouldRunE2E = process.env.RUN_POSTGRES_E2E === "true";
const describeIfE2E = shouldRunE2E ? describe : describe.skip;

describeIfE2E("PGVectorStore e2e", () => {
  let container: StartedPostgreSqlContainer;
  let store: PGVectorStore;

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
      dimensions: 2,
    });
    store.setCollection("e2e-tests");
    await store.client();
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
    const catDoc = new Document({
      text: "The cat is on the mat",
      embedding: [1, 0],
    });
    const dogDoc = new Document({
      text: "The dog is in the house",
      embedding: [0, 1],
    });

    await store.clearCollection();
    await store.add([catDoc, dogDoc]);

    const vectorResult = await store.query({
      queryEmbedding: [1, 0],
      similarityTopK: 1,
      mode: VectorStoreQueryMode.DEFAULT,
    });
    expect(vectorResult.ids).toEqual([catDoc.id_]);

    const bm25Result = await store.query({
      queryStr: "dog",
      similarityTopK: 1,
      mode: VectorStoreQueryMode.BM25,
    });
    expect(bm25Result.ids).toEqual([dogDoc.id_]);
    expect(bm25Result.similarities[0]).toBeGreaterThan(0);

    const hybridResult = await store.query({
      queryEmbedding: [1, 0],
      queryStr: "cat",
      similarityTopK: 1,
      alpha: 0.4,
      mode: VectorStoreQueryMode.HYBRID,
    });
    expect(hybridResult.ids).toEqual([catDoc.id_]);
    expect(hybridResult.similarities[0]).toBeGreaterThan(0);
  }, 120_000);
});
