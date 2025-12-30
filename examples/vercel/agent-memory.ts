import { openai } from "@ai-sdk/openai";
import { formatLLM, VectorStoreIndex } from "@vectorstores/core";
import { embedMany, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

async function main() {
  // Create an empty vector store index for storing memories
  const index = await VectorStoreIndex.init({
    nodes: [],
    embedFunc: async (input: string[]): Promise<number[][]> => {
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: input,
      });
      return embeddings;
    },
  });
  console.log("Successfully created memory index");

  const retriever = index.asRetriever({ similarityTopK: 3 });

  // Example conversation demonstrating memory capabilities
  const conversations = [
    "My name is Alice and I love hiking in the mountains.",
    "What's my name and what do I love?",
    "I also enjoy photography, especially landscape photography.",
    "What are my hobbies?",
  ];

  for (const userMessage of conversations) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`User: ${userMessage}`);
    console.log(`${"=".repeat(80)}\n`);

    const result = streamText({
      model: openai("gpt-4o"),
      prompt: userMessage,
      tools: {
        addMemory: tool({
          description:
            "Store important information about the user in long-term memory. Use this to remember facts, preferences, and context from conversations.",
          inputSchema: z.object({
            memory: z
              .string()
              .describe(
                "The information to remember (e.g., user preferences, facts, context).",
              ),
          }),
          execute: async ({ memory }) => {
            // Add the memory to the vector store with timestamp metadata
            await index.insertText(memory, {
              timestamp: new Date().toISOString(),
            });

            return `Memory stored: ${memory}`;
          },
        }),
        retrieveMemories: tool({
          description:
            "Retrieve relevant memories from long-term storage based on a query. Use this to recall information about the user.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("The query to search for relevant memories."),
          }),
          execute: async ({ query }) => {
            const results = await retriever.retrieve({ query });
            return (
              formatLLM(results) || "No relevant memories found in storage"
            );
          },
        }),
      },
      stopWhen: stepCountIs(10),
    });

    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    console.log("\n");
  }
}

main().catch(console.error);
