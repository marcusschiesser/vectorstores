import {
  Document,
  FilterOperator,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";
import { LibSQLVectorStore } from "@vectorstores/libsql";

import { useOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";
import { ensureOpenAIKey } from "../../shared/utils/runtime";

type LibsqlConfig = {
  url: string;
  authToken?: string;
  collection: string;
  tableName?: string;
  dimensions?: number;
};

function loadLibsqlConfig(): LibsqlConfig | null {
  const url = process.env.LIBSQL_URL ?? ":memory:";
  if (!process.env.LIBSQL_URL) {
    console.warn(
      "LIBSQL_URL not set. Falling back to in-memory libSQL (non-persistent). Set LIBSQL_URL for a real database.",
    );
  }

  const parsedDimensions = process.env.LIBSQL_DIMENSIONS
    ? Number.parseInt(process.env.LIBSQL_DIMENSIONS, 10)
    : undefined;

  return {
    url,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
    collection: process.env.LIBSQL_COLLECTION ?? "demo",
    tableName: process.env.LIBSQL_TABLE,
    dimensions: Number.isNaN(parsedDimensions) ? undefined : parsedDimensions,
  };
}

async function main() {
  if (!ensureOpenAIKey()) return;
  const libsqlConfig = loadLibsqlConfig();
  if (!libsqlConfig) return;

  useOpenAIEmbedding();

  const documents = [
    new Document({
      text: "libSQL is a SQLite-compatible database engine maintained by Turso.",
      metadata: { source: "libsql-docs", topic: "intro" },
    }),
    new Document({
      text: "Turso lets you deploy libSQL replicas close to your users.",
      metadata: { source: "turso-blog", topic: "deploy" },
    }),
    new Document({
      text: "Vector search in libSQL stores embeddings as F32_BLOB and can use libsql_vector_idx for ANN queries.",
      metadata: { source: "libsql-docs", topic: "vectors" },
    }),
  ];

  const vectorStore = new LibSQLVectorStore({
    collection: libsqlConfig.collection,
    ...(libsqlConfig.tableName ? { tableName: libsqlConfig.tableName } : {}),
    ...(libsqlConfig.dimensions ? { dimensions: libsqlConfig.dimensions } : {}),
    clientConfig: {
      url: libsqlConfig.url,
      ...(libsqlConfig.authToken ? { authToken: libsqlConfig.authToken } : {}),
    },
  });

  const storageContext = await storageContextFromDefaults({ vectorStore });
  const index = await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });

  const retriever = index.asRetriever();
  const response = await retriever.retrieve({
    query: "How does libSQL handle vector search?",
  });
  console.log("\nVector search response:");
  console.log(formatRetrieverResponse(response));

  const filteredRetriever = index.asRetriever({
    filters: {
      filters: [
        {
          key: "source",
          value: "libsql-docs",
          operator: FilterOperator.EQ,
        },
      ],
    },
  });
  const filteredResponse = await filteredRetriever.retrieve({
    query: "Which index does libSQL use for embeddings?",
  });
  console.log("\nFiltered search (source=libsql-docs):");
  console.log(formatRetrieverResponse(filteredResponse));
}

main().catch(console.error);
