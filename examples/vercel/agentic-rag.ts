import { openai } from "@ai-sdk/openai";
import { Document, formatLLM, VectorStoreIndex } from "@vectorstores/core";
import { embedMany, stepCountIs, streamText, tool } from "ai";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

async function main() {
  const filePath = fileURLToPath(
    new URL("../shared/data/abramov.txt", import.meta.url),
  );
  const essay = await fs.readFile(filePath, "utf-8");
  const document = new Document({ text: essay, id_: filePath });

  const index = await VectorStoreIndex.fromDocuments([document], {
    embedFunc: async (input: string[]): Promise<number[][]> => {
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: input,
      });
      return embeddings;
    },
  });
  console.log("Successfully created index");

  const retriever = index.asRetriever();
  const result = streamText({
    model: openai("gpt-4o"),
    prompt: "Cost of moving cat from Russia to UK?",
    tools: {
      queryTool: tool({
        description:
          "get information from your knowledge base to answer questions.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("The query to get information about your documents."),
        }),
        execute: async ({ query }) => {
          return (
            formatLLM(await retriever.retrieve({ query })) ||
            "No result found in documents"
          );
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
}

main().catch(console.error);
