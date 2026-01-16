/**
 * This example demonstrates how to use the vercelTool function
 * to create a Vercel AI SDK tool from a vectorstores retriever.
 *
 * The vercelTool function wraps a retriever as a tool that can be used
 * with Vercel AI SDK's streamText, generateText, or agent workflows.
 *
 * Run with: npx tsx examples/vercel/vercel-tool.ts
 */

import { openai } from "@ai-sdk/openai";
import { Document, VectorStoreIndex } from "@vectorstores/core";
import { vercelEmbedding, vercelTool } from "@vectorstores/vercel";
import { stepCountIs, streamText } from "ai";
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
  const index = await VectorStoreIndex.fromDocuments([document], {
    embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
  });
  console.log("Created vector index");

  // Create a retriever and wrap it as a Vercel AI SDK tool
  const retriever = index.asRetriever();

  // Use streamText with the vercelTool
  const result = streamText({
    model: openai.chat("gpt-4o-mini"),
    prompt:
      "What is the difference between a generative model and an embedding model? Use the knowledge base to answer.",
    tools: {
      queryKnowledge: vercelTool({
        retriever,
        description:
          "Search the AI knowledge base for information about AI concepts.",
      }),
    },
    stopWhen: stepCountIs(5),
  });

  console.log("\nStreaming response:");
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
  console.log("\n");
}

main().catch(console.error);
