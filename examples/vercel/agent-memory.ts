import { openai } from "@ai-sdk/openai";
import { VectorStoreIndex } from "@vectorstores/core";
import { vercelEmbedding, vercelTool } from "@vectorstores/vercel";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

async function main() {
  // Create an empty vector store index for storing memories
  const index = await VectorStoreIndex.init({
    embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
  });
  console.log("Successfully created memory index");

  const retriever = index.asRetriever({ similarityTopK: 3 });

  // Example conversation demonstrating memory capabilities
  const conversations = [
    "My name is Alice and I love hiking in the mountains.",
    "What's my name and what do I love?",
    "I also enjoy photography, especially landscape photography.",
    "What is my name and what are my hobbies?",
  ];

  for (const userMessage of conversations) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`User: ${userMessage}`);
    console.log(`${"=".repeat(80)}`);

    const result = streamText({
      model: openai("gpt-5-mini"),
      system: `You are a helpful assistant that can store and retrieve memories about the user. Don't make any new suggestions.`,
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
          execute: async ({ memory }: { memory: string }) => {
            // Add the memory to the vector store with timestamp metadata
            await index.insertText(memory, {
              timestamp: new Date().toISOString(),
            });

            return `Memory stored: ${memory}`;
          },
        }),
        retrieveMemories: vercelTool({
          retriever,
          description:
            "Retrieve relevant memories from long-term storage based on a query. Use this to recall information about the user.",
          noResultsMessage: "No relevant memories found in storage",
        }),
      },
      stopWhen: stepCountIs(5),
    });

    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    console.log("\n");
  }
}

main().catch(console.error);
