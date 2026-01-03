import { Document, VectorStoreIndex } from "@vectorstores/core";
import { PGVectorStore } from "@vectorstores/postgres";
import dotenv from "dotenv";
import postgres from "postgres";
import { getOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

dotenv.config();

const { PGHOST, PGDATABASE, PGUSER, ENDPOINT_ID } = process.env;
const PGPASSWORD = decodeURIComponent(process.env.PGPASSWORD!);

const sql = postgres({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: "require",
  connection: {
    options: `project=${ENDPOINT_ID}`,
  },
});

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
