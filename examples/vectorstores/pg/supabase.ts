import { VectorStoreIndex } from "@vectorstores/core";
import { PGVectorStore } from "@vectorstores/postgres";
import { SimpleDirectoryReader } from "@vectorstores/readers/directory";
import dotenv from "dotenv";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

dotenv.config();

// Get direct connection string from Supabase and set it as POSTGRES_URL environment variable
// https://supabase.com/docs/guides/database/connecting-to-postgres#direct-connection

const sourceDir = "../shared/data";
const connectionString = process.env.POSTGRES_URL;

const rdr = new SimpleDirectoryReader();
const docs = await rdr.loadData({ directoryPath: sourceDir });
const pgvs = new PGVectorStore({ clientConfig: { connectionString } });
pgvs.setCollection(sourceDir);

const index = await VectorStoreIndex.fromDocuments(docs, {
  vectorStore: pgvs,
});

const retriever = index.asRetriever();

const results = await retriever.retrieve({
  query: "Information about the planet",
});

console.log(formatRetrieverResponse(results));
