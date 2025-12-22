import { Settings } from "../global/settings.js";
import { runTransformations } from "../ingestion/IngestionPipeline.js";
import { SentenceSplitter } from "../node-parser/index.js";
import type { BaseRetriever } from "../retriever/index.js";
import type { BaseNode, Document } from "../schema/node.js";
import type { BaseDocumentStore } from "../storage/doc-store/base-document-store.js";
import type { StorageContext } from "../storage/StorageContext.js";

export interface BaseIndexInit {
  storageContext: StorageContext;
  docStore: BaseDocumentStore;
}

/**
 * Indexes are the data structure that we store our nodes and embeddings in so
 * they can be retrieved for our queries.
 */
export abstract class BaseIndex {
  storageContext: StorageContext;
  docStore: BaseDocumentStore;

  constructor(init: BaseIndexInit) {
    this.storageContext = init.storageContext;
    this.docStore = init.docStore;
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
    await this.docStore.setDocumentHash(document.id_, document.hash);
  }

  abstract insertNodes(nodes: BaseNode[]): Promise<void>;
  abstract deleteRefDoc(
    refDocId: string,
    deleteFromDocStore?: boolean,
  ): Promise<void>;

  /**
   * Alias for asRetriever
   * @param options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retriever(options?: any): BaseRetriever {
    return this.asRetriever(options);
  }
}
