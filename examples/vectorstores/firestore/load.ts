import type { CollectionReference } from "@google-cloud/firestore";
import { CSVReader } from "@vectorstores/readers/csv";
import "dotenv/config";
import { fileURLToPath } from "node:url";

import { VectorStoreIndex } from "@vectorstores/core";

import { FirestoreVectorStore } from "@vectorstores/firestore";

import { useOpenAIEmbedding } from "../../shared/utils/embedding";
import { ensureOpenAIKey } from "../../shared/utils/runtime";

const indexName = "MovieReviews";

async function main() {
  try {
    if (!ensureOpenAIKey()) return;
    useOpenAIEmbedding();
    const reader = new CSVReader(false);
    const docs = await reader.loadData(
      fileURLToPath(
        new URL("../../shared/data/movie_reviews.csv", import.meta.url),
      ),
    );

    const vectorStore = new FirestoreVectorStore({
      clientOptions: {
        credentials: JSON.parse(process.env.GCP_CREDENTIALS!),
        projectId: process.env.GCP_PROJECT_ID!,
        databaseId: process.env.FIRESTORE_DB!,
        ignoreUndefinedProperties: true,
      },
      collectionName: indexName,
      customCollectionReference: (rootCollection: CollectionReference) => {
        return rootCollection.doc("accountId-123").collection("vectors");
      },
    });
    await VectorStoreIndex.fromDocuments(docs, { vectorStore });
  } catch (e) {
    console.error(e);
  }
}

void main();
