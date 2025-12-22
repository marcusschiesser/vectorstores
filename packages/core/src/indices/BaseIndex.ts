import { Settings } from "../global/settings.js";
import { runTransformations } from "../ingestion/IngestionPipeline.js";
import { SentenceSplitter } from "../node-parser/index.js";
import type { BaseRetriever } from "../retriever/index.js";
import type { BaseNode, Document } from "../schema/node.js";
import type { StorageContext } from "../storage/StorageContext.js";

export interface BaseIndexInit {
  storageContext: StorageContext;
}

/**
 * Indexes are the data structure that we store our nodes and embeddings in so
 * they can be retrieved for our queries.
 */
export abstract class BaseIndex {
  storageContext: StorageContext;

  constructor(init: BaseIndexInit) {
    this.storageContext = init.storageContext;
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
