import type {
  BaseVectorStore,
  VectorStoreByType,
} from "../vector-store/index.js";
import { SimpleVectorStore } from "../vector-store/SimpleVectorStore.js";

export interface CreateVectorStoresOptions {
  vectorStore?: BaseVectorStore | undefined;
  persistDir?: string | undefined;
}

/**
 * Internal function to create vector stores with sensible defaults.
 * Used by VectorStoreIndex to initialize vector stores when not explicitly provided.
 * @internal
 */
export async function createVectorStores(
  options: CreateVectorStoresOptions,
): Promise<VectorStoreByType> {
  const vectorStores: VectorStoreByType = {};
  if (!options.persistDir) {
    vectorStores.text = options.vectorStore ?? new SimpleVectorStore();
  } else {
    vectorStores.text =
      options.vectorStore ??
      (await SimpleVectorStore.fromPersistDir(options.persistDir));
  }
  return vectorStores;
}
