import { Document, VectorStoreIndex } from "@vectorstores/core";
import { LibSQLVectorStore } from "@vectorstores/libsql";
import { getOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

async function main() {
  const vectorStore = new LibSQLVectorStore({
    clientConfig: {
      url: process.env.LIBSQL_URL ?? ":memory:",
      authToken: process.env.LIBSQL_AUTH_TOKEN,
    },
    tableName: "hybrid_test",
    dimensions: 1536,
  });

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
    ],
    {
      vectorStore,
      embedFunc: getOpenAIEmbedding(),
    },
  );

  const retriever = index.asRetriever({
    similarityTopK: 2,
    mode: "hybrid",
    alpha: 0.5,
  });

  console.log("Hybrid Search for 'dog':");
  const result = await retriever.retrieve({ query: "dog" });

  console.log(formatRetrieverResponse(result));
}

main().catch(console.error);
