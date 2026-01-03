import type { BaseVectorStore } from "../../vector-store/index.js";
import { DuplicatesStrategy } from "./DuplicatesStrategy.js";
import { RollbackableTransformComponent } from "./rollback.js";
import { UpsertsStrategy } from "./UpsertsStrategy.js";

/**
 * Document de-duplication strategies work by checking if documents exist in vector stores.
 */
export enum DocStoreStrategy {
  // Use upserts to handle duplicates. Deletes existing documents (by ref_doc_id) and re-adds them.
  UPSERTS = "upserts",
  // Only handle duplicates. Skips documents that already exist in the vector store (by ref_doc_id).
  DUPLICATES_ONLY = "duplicates_only",
  // @deprecated Use UPSERTS instead. This is now an alias for UPSERTS.
  UPSERTS_AND_DELETE = "upserts_and_delete",
  NONE = "none", // no-op strategy
}

class NoOpStrategy extends RollbackableTransformComponent {
  constructor() {
    super(async (nodes) => nodes);
  }
}

/**
 * Create a deduplication strategy for a single vector store.
 */
export function createDocStoreStrategy(
  docStoreStrategy: DocStoreStrategy,
  vectorStore: BaseVectorStore,
): RollbackableTransformComponent {
  if (docStoreStrategy === DocStoreStrategy.NONE) {
    return new NoOpStrategy();
  }
  if (
    docStoreStrategy === DocStoreStrategy.UPSERTS ||
    docStoreStrategy === DocStoreStrategy.UPSERTS_AND_DELETE
  ) {
    return new UpsertsStrategy(vectorStore);
  } else if (docStoreStrategy === DocStoreStrategy.DUPLICATES_ONLY) {
    return new DuplicatesStrategy(vectorStore);
  } else {
    throw new Error(`Invalid docstore strategy: ${docStoreStrategy}`);
  }
}

export * from "./DuplicatesStrategy.js";
export * from "./rollback.js";
export * from "./UpsertsStrategy.js";
