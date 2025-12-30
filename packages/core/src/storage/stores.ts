import { path } from "@vectorstores/env";
import { ALL_MODALITIES } from "../schema/index.js";
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

  if (options.vectorStore) {
    // If vectorStore is provided, use it for text modality
    vectorStores.text = options.vectorStore;
  } else {
    // Create new stores for each modality
    for (const modality of ALL_MODALITIES) {
      if (options.persistDir) {
        // Use persistDir as a prefix for each modality
        const modalityPersistDir = path.join(options.persistDir, modality);
        vectorStores[modality] =
          await SimpleVectorStore.fromPersistDir(modalityPersistDir);
      } else {
        // Create new in-memory stores
        vectorStores[modality] = new SimpleVectorStore();
      }
    }
  }

  return vectorStores;
}
