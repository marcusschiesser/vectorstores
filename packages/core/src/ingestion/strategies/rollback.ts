import { type BaseNode, TransformComponent } from "../../schema/index.js";
import type { BaseVectorStore } from "../../vector-store/index.js";

export class RollbackableTransformComponent extends TransformComponent {
  /**
   * Remove all nodes for documents that exist in the vector store.
   * Useful in case generating embeddings fails and we want to remove partially added docs.
   */
  public async rollback(
    vectorStore: BaseVectorStore,
    nodes: BaseNode[],
  ): Promise<void> {
    const seenIds = new Set<string>();
    for (const node of nodes) {
      const refDocId = node.sourceNode?.nodeId || node.id_;
      if (seenIds.has(refDocId)) continue;
      seenIds.add(refDocId);

      const exists = await vectorStore.exists(refDocId);
      if (exists) {
        await vectorStore.delete(refDocId);
      }
    }
  }
}
