import type { TextEmbedFunc } from "@vectorstores/core";
import type { EmbeddingModel } from "ai";
import { embedMany } from "ai";

/**
 * Creates a text embedding function from a Vercel AI SDK embedding model.
 *
 * This adapter allows you to use any Vercel AI SDK compatible embedding model
 * (OpenAI, Anthropic, Cohere, etc.) with vectorstores.
 *
 * @param model - A Vercel AI SDK embedding model instance
 * @returns A TextEmbedFunc compatible with vectorstores
 *
 * @example
 * ```typescript
 * import { openai } from "@ai-sdk/openai";
 * import { VectorStoreIndex } from "@vectorstores/core";
 * import { vercelEmbedding } from "@vectorstores/vercel";
 *
 * const index = await VectorStoreIndex.fromDocuments(documents, {
 *   embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
 * });
 * ```
 */
export function vercelEmbedding<T extends string>(
  model: EmbeddingModel<T>,
): TextEmbedFunc {
  return async (input: string[]): Promise<number[][]> => {
    const { embeddings } = await embedMany({
      model,
      values: input,
    });
    return embeddings;
  };
}
