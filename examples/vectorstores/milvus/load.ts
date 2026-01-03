import { VectorStoreIndex } from "@vectorstores/core";
import { MilvusVectorStore } from "@vectorstores/milvus";
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

    const vectorStore = new MilvusVectorStore({ collection: collectionName });
    await VectorStoreIndex.fromDocuments(docs, { vectorStore });
  } catch (e) {
    console.error(e);
  }
}

void main();
