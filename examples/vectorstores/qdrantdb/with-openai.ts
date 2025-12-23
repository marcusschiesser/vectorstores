import { Document, VectorStoreIndex } from "@vectorstores/core";
import { QdrantVectorStore } from "@vectorstores/qdrant";

import { useOpenAIEmbedding } from "../../shared/utils/embedding";

async function main() {
  useOpenAIEmbedding();
  const docs = [new Document({ text: "Lorem ipsum dolor sit amet" })];
  const vectorStore = new QdrantVectorStore({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: "openai_test",
  });
  await VectorStoreIndex.fromDocuments(docs, { vectorStore });
  console.log("Initialized vector store successfully");
}

void main().catch((err) => console.error(err));
