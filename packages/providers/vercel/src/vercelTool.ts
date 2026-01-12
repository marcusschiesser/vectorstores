import type { BaseRetriever } from "@vectorstores/core";
import { formatLLM } from "@vectorstores/core";
import { tool } from "ai";
import { z } from "zod";

/**
 * Options for creating a Vercel AI SDK tool from a retriever.
 */
export interface VercelToolOptions {
  /**
   * The retriever to use for searching documents.
   */
  retriever: BaseRetriever;
  /**
   * A description of what the tool does. This helps the LLM understand
   * when to use the tool.
   */
  description: string;
  /**
   * Optional message to return when no results are found.
   * Defaults to "No results found in documents."
   */
  noResultsMessage?: string;
}

/**
 * Creates a Vercel AI SDK tool from a vectorstores retriever.
 *
 * This adapter allows you to use a vectorstores retriever as a tool
 * in Vercel AI SDK's `streamText`, `generateText`, or agent workflows.
 *
 * @param options - Configuration for the tool
 * @returns A Vercel AI SDK tool that can be used with streamText/generateText
 *
 * @example
 * ```typescript
 * import { openai } from "@ai-sdk/openai";
 * import { streamText, stepCountIs } from "ai";
 * import { vercelTool } from "@vectorstores/vercel";
 *
 * const retriever = index.asRetriever();
 *
 * const result = await streamText({
 *   model: openai.chat("gpt-4o-mini"),
 *   prompt: "What are the key concepts in AI?",
 *   tools: {
 *     queryKnowledge: vercelTool({
 *       retriever,
 *       description: "Search the AI knowledge base for information.",
 *     }),
 *   },
 *   stopWhen: stepCountIs(5),
 * });
 * ```
 */
export function vercelTool(options: VercelToolOptions) {
  const {
    retriever,
    description,
    noResultsMessage = "No results found in documents.",
  } = options;

  return tool({
    description,
    parameters: z.object({
      query: z
        .string()
        .describe("The search query to find relevant information."),
    }),
    execute: async ({ query }) => {
      const nodes = await retriever.retrieve({ query });
      const result = formatLLM(nodes);
      return result || noResultsMessage;
    },
  });
}
