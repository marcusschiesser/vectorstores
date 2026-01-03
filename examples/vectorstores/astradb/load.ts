import { AstraDBVectorStore } from "@vectorstores/astra";
import { VectorStoreIndex } from "@vectorstores/core";
import { CSVReader } from "@vectorstores/readers/csv";
import { fileURLToPath } from "node:url";

import { useOpenAIEmbedding } from "../../shared/utils/embedding";
import { ensureOpenAIKey } from "../../shared/utils/runtime";

const collectionName = "movie_reviews";

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

    const astraVS = new AstraDBVectorStore({ contentKey: "reviewtext" });
    await astraVS.createAndConnect(collectionName, {
      vector: { dimension: 1536, metric: "cosine" },
    });
    await astraVS.connect(collectionName);

    await VectorStoreIndex.fromDocuments(docs, { vectorStore: astraVS });
  } catch (e) {
    console.error(e);
  }
}

void main();
