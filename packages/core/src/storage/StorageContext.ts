import type { TextEmbedFunc } from "../embeddings/index.js";
import { ModalityType } from "../schema/index.js";
import type {
  BaseVectorStore,
  VectorStoreByType,
} from "../vector-store/index.js";
import { SimpleVectorStore } from "../vector-store/SimpleVectorStore.js";

export interface StorageContext {
  vectorStores: VectorStoreByType;
}

type BuilderParams = {
  vectorStore: BaseVectorStore;
  vectorStores: VectorStoreByType;
  persistDir: string;
  embedFunc: TextEmbedFunc | undefined;
};

export async function storageContextFromDefaults({
  vectorStore,
  vectorStores,
  persistDir,
  embedFunc,
}: Partial<BuilderParams>): Promise<StorageContext> {
  vectorStores = vectorStores ?? {};
  if (!persistDir) {
    if (!(ModalityType.TEXT in vectorStores)) {
      vectorStores[ModalityType.TEXT] =
        vectorStore ?? new SimpleVectorStore({ embedFunc });
    }
  } else {
    if (!(ModalityType.TEXT in vectorStores)) {
      vectorStores[ModalityType.TEXT] =
        vectorStore ??
        (await SimpleVectorStore.fromPersistDir(persistDir, undefined, {
          embedFunc,
        }));
    }
  }

  return {
    vectorStores,
  };
}
