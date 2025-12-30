import type { ImageType } from "../schema";

type EmbedFunc<T> = (values: T[]) => Promise<Array<number[]>>;
export type TextEmbedFunc = EmbedFunc<string>;
export type ImageEmbedFunc = EmbedFunc<ImageType>;

/**
 * Map of modality to embedding function.
 */
export type EmbeddingsByType = {
  text?: TextEmbedFunc;
  image?: ImageEmbedFunc;
  audio?: never;
};

export async function batchEmbeddings<T>(
  values: T[],
  embedFunc: EmbedFunc<T>,
  chunkSize: number,
): Promise<Array<number[]>> {
  const resultEmbeddings: Array<number[]> = [];

  const queue: T[] = values;

  const curBatch: T[] = [];

  for (let i = 0; i < queue.length; i++) {
    curBatch.push(queue[i]!);
    if (i === queue.length - 1 || curBatch.length === chunkSize) {
      const embeddings = await embedFunc(curBatch);

      resultEmbeddings.push(...embeddings);

      curBatch.length = 0;
    }
  }

  return resultEmbeddings;
}
