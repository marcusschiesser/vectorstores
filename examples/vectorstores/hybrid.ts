import {
  Document,
  SimpleVectorStore,
  VectorStoreIndex,
  VectorStoreQueryMode,
} from "@vectorstores/core";
import { getOpenAIEmbedding } from "../shared/utils/embedding";
import { formatRetrieverResponse } from "../shared/utils/format-response";

async function main() {
  const embedFunc = getOpenAIEmbedding();
  const vectorStore = new SimpleVectorStore({ embedFunc });
  const index = await VectorStoreIndex.fromDocuments(
    [
      new Document({
        text: "The cat is on the mat.",
        id_: "1",
      }),
      new Document({
        text: "The dog is in the house.",
        id_: "2",
      }),
      new Document({
        text: "The bird is in the sky.",
        id_: "3",
      }),
    ],
    { vectorStore, embedFunc },
  );

  console.log("BM25 Search for 'dog':");
  const bm25Retriever = index.asRetriever({
    mode: VectorStoreQueryMode.BM25,
    similarityTopK: 2,
  });
  const bm25Result = await bm25Retriever.retrieve("dog");

  console.log(formatRetrieverResponse(bm25Result));

  console.log("\nHybrid Search for 'bird':");
  const hybridRetriever = index.asRetriever({
    mode: VectorStoreQueryMode.HYBRID,
    similarityTopK: 2,
    alpha: 0.5,
  });
  const hybridResult = await hybridRetriever.retrieve("bird");

  console.log(formatRetrieverResponse(hybridResult));
}

main().catch(console.error);
