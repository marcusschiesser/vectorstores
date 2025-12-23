import { VectorStoreIndex } from "@vectorstores/core";
import { CSVReader } from "@vectorstores/readers/csv";
import { WeaviateVectorStore } from "@vectorstores/weaviate";
import { fileURLToPath } from "node:url";

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

    const vectorStore = new WeaviateVectorStore({ indexName });

    await VectorStoreIndex.fromDocuments(docs, { vectorStore });
    console.log("Successfully loaded data into Weaviate");
  } catch (e) {
    console.error(e);
  }
}

void main();
