import type { TextEmbedFunc } from "../embeddings/index.js";
import { DEFAULT_NAMESPACE } from "../global/index.js";
import { ModalityType } from "../schema/index.js";
import type {
  BaseVectorStore,
  VectorStoreByType,
} from "../vector-store/index.js";
import { SimpleVectorStore } from "../vector-store/SimpleVectorStore.js";
import type { BaseDocumentStore } from "./doc-store/index.js";
import { SimpleDocumentStore } from "./doc-store/SimpleDocumentStore.js";

export interface StorageContext {
  docStore: BaseDocumentStore;
  vectorStores: VectorStoreByType;
}

type BuilderParams = {
  docStore: BaseDocumentStore;
  vectorStore: BaseVectorStore;
  vectorStores: VectorStoreByType;
  persistDir: string;
  embedFunc: TextEmbedFunc | undefined;
};

export async function storageContextFromDefaults({
  docStore,
  vectorStore,
  vectorStores,
  persistDir,
  embedFunc,
}: Partial<BuilderParams>): Promise<StorageContext> {
  vectorStores = vectorStores ?? {};
  if (!persistDir) {
    docStore = docStore ?? new SimpleDocumentStore();
    if (!(ModalityType.TEXT in vectorStores)) {
      vectorStores[ModalityType.TEXT] =
        vectorStore ?? new SimpleVectorStore({ embedFunc });
    }
  } else {
    docStore =
      docStore ||
      (await SimpleDocumentStore.fromPersistDir(persistDir, DEFAULT_NAMESPACE));
    if (!(ModalityType.TEXT in vectorStores)) {
      vectorStores[ModalityType.TEXT] =
        vectorStore ??
        (await SimpleVectorStore.fromPersistDir(persistDir, undefined, {
          embedFunc,
        }));
    }
  }

  return {
    docStore,
    vectorStores,
  };
}
