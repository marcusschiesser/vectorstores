import type { BaseNode } from "../../schema/index.js";
import type { BaseVectorStore } from "../../vector-store/index.js";
import { RollbackableTransformComponent } from "./rollback.js";

/**
 * Handle upserts by deleting existing documents before re-adding.
 * If a document exists (by ref_doc_id), it is deleted first, then re-added.
 * Note: This always re-indexes existing documents, even if content hasn't changed.
 */
export class UpsertsStrategy extends RollbackableTransformComponent {
  protected vectorStore: BaseVectorStore;

  constructor(vectorStore: BaseVectorStore) {
    super(async (nodes: BaseNode[]): Promise<BaseNode[]> => {
      const seenIds = new Set<string>();

      for (const node of nodes) {
        const refDocId = node.sourceNode?.nodeId || node.id_;

        // Only process each document once
        if (seenIds.has(refDocId)) continue;
        seenIds.add(refDocId);

        // Delete existing document (if any) before re-adding
        const exists = await this.vectorStore.exists(refDocId);
        if (exists) {
          await this.vectorStore.delete(refDocId);
        }
      }

      return nodes;
    });
    this.vectorStore = vectorStore;
  }
}
