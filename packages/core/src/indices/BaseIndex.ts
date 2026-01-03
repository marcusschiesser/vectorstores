import type { EmbeddingsByType } from "../embeddings/index.js";
import { Settings } from "../global/settings.js";
import { runTransformations } from "../ingestion/IngestionPipeline.js";
import { SentenceSplitter } from "../node-parser/index.js";
import type { BaseRetriever } from "../retriever/index.js";
import type { BaseNode, Document } from "../schema/node.js";
import type { VectorStoreByType } from "../vector-store/index.js";

export interface BaseIndexInit {
  vectorStores: VectorStoreByType;
  embeddings: EmbeddingsByType;
}

/**
 * Indexes are the data structure that we store our nodes and embeddings in so
 * they can be retrieved for our queries.
 */
export abstract class BaseIndex {
  vectorStores: VectorStoreByType;
  embeddings: EmbeddingsByType;

  constructor(init: BaseIndexInit) {
    this.vectorStores = init.vectorStores;
    this.embeddings = init.embeddings;
  }

  /**
   * Create a new retriever from the index.
   * @param options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract asRetriever(options?: any): BaseRetriever;

  /**
   * Insert a document into the index.
   * @param document
   */
  async insert(document: Document) {
    const nodeParser =
      Settings.nodeParser ??
      new SentenceSplitter({
        ...(Settings.chunkSize !== undefined && {
          chunkSize: Settings.chunkSize,
        }),
        ...(Settings.chunkOverlap !== undefined && {
          chunkOverlap: Settings.chunkOverlap,
        }),
      });
    const nodes = await runTransformations([document], [nodeParser]);
    await this.insertNodes(nodes);
  }

  abstract insertNodes(nodes: BaseNode[]): Promise<void>;
  abstract deleteRefDoc(refDocId: string): Promise<void>;

  /**
   * Alias for asRetriever
   * @param options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retriever(options?: any): BaseRetriever {
    return this.asRetriever(options);
  }
}
