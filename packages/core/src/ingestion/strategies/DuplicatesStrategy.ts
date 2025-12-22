import type { BaseNode } from "../../schema/index.js";
import type { BaseVectorStore } from "../../vector-store/index.js";
import { RollbackableTransformComponent } from "./rollback.js";

/**
 * Handle duplicates by checking if documents already exist in the vector store.
 * Documents that already exist (by ref_doc_id) are skipped.
 * Note: This does NOT detect content changes - use UPSERTS strategy if you need to update changed documents.
 */
export class DuplicatesStrategy extends RollbackableTransformComponent {
  private vectorStore: BaseVectorStore;

  constructor(vectorStore: BaseVectorStore) {
    super(async (nodes: BaseNode[]): Promise<BaseNode[]> => {
      const seenIds = new Set<string>();
      const nodesToRun: BaseNode[] = [];

      for (const node of nodes) {
        const refDocId = node.sourceNode?.nodeId || node.id_;

        // Skip if we've already processed this document in this batch
        if (seenIds.has(refDocId)) continue;
        seenIds.add(refDocId);

        // Skip if document already exists in vector store
        const exists = await this.vectorStore.exists(refDocId);
        if (!exists) {
          nodesToRun.push(node);
        }
      }

      return nodesToRun;
    });
    this.vectorStore = vectorStore;
  }
}
