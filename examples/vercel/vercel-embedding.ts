/**
 * This example demonstrates how to use the vercelEmbedding function
 * to integrate Vercel AI SDK embedding models with vectorstores.
 *
 * The vercelEmbedding function provides a simple wrapper that converts
 * any Vercel AI SDK embedding model into a vectorstores-compatible
 * embedding function.
 *
 * Run with: npx tsx examples/vercel/vercel-embedding.ts
 */

import { openai } from "@ai-sdk/openai";
import { Document, VectorStoreIndex } from "@vectorstores/core";
import { vercelEmbedding } from "@vectorstores/vercel";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function main() {
  // Load a sample document
  const filePath = fileURLToPath(
    new URL("../shared/data/abramov.txt", import.meta.url),
  );
  const essay = await fs.readFile(filePath, "utf-8");
  const document = new Document({ text: essay, id_: filePath });

  // Create a vector index using Vercel AI SDK embeddings
  // The vercelEmbedding function wraps the OpenAI embedding model
  // to make it compatible with vectorstores
  const index = await VectorStoreIndex.fromDocuments([document], {
    embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
  });
  console.log("Created vector index with Vercel AI SDK embeddings");

  // Query the index
  const retriever = index.asRetriever();
  const results = await retriever.retrieve({
    query: "What is the essay about?",
  });

  console.log("\nQuery results:");
  for (const result of results) {
    console.log(`- Score: ${result.score?.toFixed(4)}`);
    console.log(`  Content: ${result.node.getContent().slice(0, 200)}...`);
  }
}

main().catch(console.error);
