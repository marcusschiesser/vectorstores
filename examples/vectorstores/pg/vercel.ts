// https://vercel.com/docs/storage/vercel-postgres/sdk
import { Document, VectorStoreIndex } from "@vectorstores/core";
import { PGVectorStore } from "@vectorstores/postgres";
import { sql } from "@vercel/postgres";
import dotenv from "dotenv";
import { getOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

dotenv.config();

await sql`CREATE EXTENSION IF NOT EXISTS vector`;

const vectorStore = new PGVectorStore({
  dimensions: 1536,
  client: sql,
});

const index = await VectorStoreIndex.fromDocuments(
  [
    new Document({
      text: "hello, world",
    }),
  ],
  {
    vectorStore,
    embedFunc: getOpenAIEmbedding(),
  },
);

const retriever = index.asRetriever({ similarityTopK: 1 });
const results = await retriever.retrieve({ query: "hello, world" });

console.log(formatRetrieverResponse(results));

await sql.end();
