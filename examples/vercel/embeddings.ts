import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

export const embeddings = {
  text: async function embedFunc(input: string[]): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: input,
    });
    return embeddings;
  },
};
