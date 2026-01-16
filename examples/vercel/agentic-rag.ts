import { openai } from "@ai-sdk/openai";
import { Document, VectorStoreIndex } from "@vectorstores/core";
import { vercelEmbedding, vercelTool } from "@vectorstores/vercel";
import { stepCountIs, streamText } from "ai";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function main() {
  const filePath = fileURLToPath(
    new URL("../shared/data/abramov.txt", import.meta.url),
  );
  const essay = await fs.readFile(filePath, "utf-8");
  const document = new Document({ text: essay, id_: filePath });

  const index = await VectorStoreIndex.fromDocuments([document], {
    embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
  });
  console.log("Successfully created index");

  const retriever = index.asRetriever();
  const result = streamText({
    model: openai("gpt-4o"),
    prompt: "Cost of moving cat from Russia to UK?",
    tools: {
      queryTool: vercelTool({
        retriever,
        description:
          "get information from your knowledge base to answer questions.",
      }),
    },
    stopWhen: stepCountIs(5),
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
}

main().catch(console.error);
