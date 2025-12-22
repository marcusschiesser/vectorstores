import { BaseEmbedding, type TextEmbedFunc } from "../../embeddings/index.js";
import { DEFAULT_SIMILARITY_TOP_K } from "../../embeddings/utils.js";
import { Settings } from "../../global/index.js";
import {
  addNodesToVectorStores,
  runTransformations,
} from "../../ingestion/IngestionPipeline.js";
import {
  createDocStoreStrategy,
  DocStoreStrategy,
} from "../../ingestion/strategies/index.js";
import type { MessageContent } from "../../llms/index.js";
import { SentenceSplitter } from "../../node-parser/index.js";
import type { QueryBundle } from "../../retriever/index.js";
import { BaseRetriever } from "../../retriever/index.js";
import {
  type BaseNode,
  type Document,
  ImageNode,
  ModalityType,
  type NodeWithScore,
  splitNodesByType,
} from "../../schema/index.js";
import {
  type StorageContext,
  storageContextFromDefaults,
} from "../../storage/StorageContext.js";
import { extractText } from "../../utils/index.js";
import {
  type BaseVectorStore,
  type MetadataFilters,
  type VectorStoreByType,
  VectorStoreQueryMode,
  type VectorStoreQueryResult,
} from "../../vector-store/index.js";
import { BaseIndex, type BaseIndexInit } from "../BaseIndex.js";

export interface VectorIndexOptions {
  nodes?: BaseNode[] | undefined;
  storageContext?: StorageContext | undefined;
  vectorStores?: VectorStoreByType | undefined;
  logProgress?: boolean | undefined;
  progressCallback?: ((progress: number, total: number) => void) | undefined;
  // @deprecated: use embedFunc instead
  embedModel?: BaseEmbedding | undefined;
  embedFunc?: TextEmbedFunc | undefined;
}

export interface VectorIndexConstructorProps extends BaseIndexInit {
  vectorStores?: VectorStoreByType | undefined;
  // @deprecated: use embedFunc instead
  embedModel?: BaseEmbedding | undefined;
  embedFunc?: TextEmbedFunc | undefined;
}

export type VectorIndexChatEngineOptions = {
  retriever?: BaseRetriever;
  similarityTopK?: number;
  preFilters?: MetadataFilters;
  customParams?: unknown;
};

/**
 * The VectorStoreIndex, an index that stores the nodes only according to their vector embeddings.
 */
export class VectorStoreIndex extends BaseIndex {
  /** @deprecated: use embedFunc instead */
  embedModel?: BaseEmbedding | undefined;
  vectorStores: VectorStoreByType;

  private constructor(init: VectorIndexConstructorProps) {
    super(init);
    this.vectorStores = init.vectorStores ?? init.storageContext.vectorStores;
    if (init.embedFunc) {
      this.embedModel = new BaseEmbedding({ embedFunc: init.embedFunc });
    } else {
      this.embedModel = init.embedModel ?? new BaseEmbedding();
    }
  }

  /**
   * The async init function creates a new VectorStoreIndex.
   * @param options
   * @returns
   */
  public static async init(
    options: VectorIndexOptions,
  ): Promise<VectorStoreIndex> {
    const storageContext =
      options.storageContext ??
      (await storageContextFromDefaults({
        embedFunc: options.embedFunc,
      }));
    const docStore = storageContext.docStore;

    const index = new VectorStoreIndex({
      storageContext,
      docStore,
      vectorStores: options.vectorStores,
      embedModel: options.embedModel,
      embedFunc: options.embedFunc,
    });

    if (options.nodes) {
      // If nodes are passed in, then we need to update the index
      await index.buildIndexFromNodes(options.nodes, {
        logProgress: options.logProgress,
        progressCallback: options.progressCallback,
      });
    }
    return index;
  }

  /**
   * Calculates the embeddings for the given nodes.
   *
   * @param nodes - An array of BaseNode objects representing the nodes for which embeddings are to be calculated.
   * @param {Object} [options] - An optional object containing additional parameters.
   *   @param {boolean} [options.logProgress] - A boolean indicating whether to log progress to the console (useful for debugging).
   */
  async getNodeEmbeddingResults(
    nodes: BaseNode[],
    options?: {
      logProgress?: boolean | undefined;
      progressCallback?:
        | ((progress: number, total: number) => void)
        | undefined;
    },
  ): Promise<BaseNode[]> {
    const nodeMap = splitNodesByType(nodes);
    for (const type in nodeMap) {
      const nodes = nodeMap[type as ModalityType];
      const embedModel =
        this.vectorStores[type as ModalityType]?.embedModel ?? this.embedModel;
      if (embedModel && nodes) {
        await embedModel(nodes, {
          logProgress: options?.logProgress,
          progressCallback: options?.progressCallback,
        });
      }
    }
    return nodes;
  }

  /**
   * Get embeddings for nodes and place them into the index.
   * @param nodes
   * @returns
   */
  async buildIndexFromNodes(
    nodes: BaseNode[],
    options?: {
      logProgress?: boolean | undefined;
      progressCallback?:
        | ((progress: number, total: number) => void)
        | undefined;
    },
  ) {
    await this.insertNodes(nodes, options);
  }

  /**
   * High level API: split documents, get embeddings, and build index.
   * @param documents
   * @param args
   * @returns
   */
  static async fromDocuments(
    documents: Document[],
    args: VectorIndexOptions & {
      docStoreStrategy?: DocStoreStrategy;
    } = {},
  ): Promise<VectorStoreIndex> {
    args.storageContext =
      args.storageContext ??
      (await storageContextFromDefaults({
        embedFunc: args.embedFunc,
      }));
    args.vectorStores = args.vectorStores ?? args.storageContext.vectorStores;
    args.docStoreStrategy =
      args.docStoreStrategy ??
      // set doc store strategy defaults to the same as for the IngestionPipeline
      (args.vectorStores
        ? DocStoreStrategy.UPSERTS
        : DocStoreStrategy.DUPLICATES_ONLY);
    const docStore = args.storageContext.docStore;

    if (args.logProgress) {
      console.log("Using node parser on documents...");
    }

    // use doc store strategy to avoid duplicates
    const vectorStores = Object.values(args.vectorStores ?? {});
    const docStoreStrategy = createDocStoreStrategy(
      args.docStoreStrategy,
      docStore,
      vectorStores,
    );
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
    args.nodes = await runTransformations(
      documents,
      [nodeParser],
      {},
      { docStoreStrategy },
    );
    if (args.logProgress) {
      console.log("Finished parsing documents.");
    }
    try {
      return await VectorStoreIndex.init(args);
    } catch (error) {
      await docStoreStrategy.rollback(args.storageContext.docStore, args.nodes);
      throw error;
    }
  }

  static async fromVectorStores(vectorStores: VectorStoreByType) {
    if (!vectorStores[ModalityType.TEXT]?.storesText) {
      throw new Error(
        "Cannot initialize from a vector store that does not store text",
      );
    }

    const storageContext = await storageContextFromDefaults({
      vectorStores,
    });

    const index = await VectorStoreIndex.init({
      nodes: [],
      storageContext,
    });

    return index;
  }

  static async fromVectorStore(vectorStore: BaseVectorStore) {
    return VectorStoreIndex.fromVectorStores({
      [ModalityType.TEXT]: vectorStore,
    });
  }

  asRetriever(
    options?: OmitIndex<VectorIndexRetrieverOptions>,
  ): VectorIndexRetriever {
    return new VectorIndexRetriever({ index: this, ...options });
  }

  async insertNodes(
    nodes: BaseNode[],
    options?: {
      logProgress?: boolean | undefined;
      progressCallback?:
        | ((progress: number, total: number) => void)
        | undefined;
    },
  ): Promise<void> {
    if (!nodes || nodes.length === 0) {
      return;
    }
    nodes = await this.getNodeEmbeddingResults(nodes, options);
    await addNodesToVectorStores(nodes, this.vectorStores);
  }

  async deleteRefDoc(
    refDocId: string,
    deleteFromDocStore: boolean = true,
  ): Promise<void> {
    for (const vectorStore of Object.values(this.vectorStores)) {
      await this.deleteRefDocFromStore(vectorStore, refDocId);
    }
    if (deleteFromDocStore) {
      await this.docStore.deleteDocument(refDocId, false);
    }
  }

  protected async deleteRefDocFromStore(
    vectorStore: BaseVectorStore,
    refDocId: string,
  ): Promise<void> {
    await vectorStore.delete(refDocId);
  }
}

/**
 * VectorIndexRetriever retrieves nodes from a VectorIndex.
 */

// TopKMap type now only includes TEXT and IMAGE modalities
type TopKMap = { [P in ModalityType]: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OmitIndex<T> = T extends { index: any } ? Omit<T, "index"> : never;

export type VectorIndexRetrieverOptions = {
  index: VectorStoreIndex;
  filters?: MetadataFilters | undefined;
  mode?: VectorStoreQueryMode;
  customParams?: unknown | undefined;
} & (
  | {
      topK?: TopKMap | undefined;
    }
  | {
      similarityTopK?: number | undefined;
    }
);

export class VectorIndexRetriever extends BaseRetriever {
  index: VectorStoreIndex;
  topK: TopKMap;

  filters?: MetadataFilters | undefined;
  queryMode?: VectorStoreQueryMode | undefined;
  customParams?: unknown | undefined;
  constructor(options: VectorIndexRetrieverOptions) {
    super();
    this.index = options.index;
    this.queryMode = options.mode ?? VectorStoreQueryMode.DEFAULT;
    if ("topK" in options && options.topK) {
      this.topK = options.topK;
    } else {
      this.topK = {
        [ModalityType.TEXT]:
          "similarityTopK" in options && options.similarityTopK
            ? options.similarityTopK
            : DEFAULT_SIMILARITY_TOP_K,
        [ModalityType.IMAGE]: DEFAULT_SIMILARITY_TOP_K,
        [ModalityType.AUDIO]: DEFAULT_SIMILARITY_TOP_K,
      };
    }
    this.filters = options.filters;
    this.customParams = options.customParams;
  }

  /**
   * @deprecated, pass similarityTopK or topK in constructor instead or directly modify topK
   */
  set similarityTopK(similarityTopK: number) {
    this.topK[ModalityType.TEXT] = similarityTopK;
  }

  async _retrieve(params: QueryBundle): Promise<NodeWithScore[]> {
    const { query } = params;
    const vectorStores = this.index.vectorStores;
    let nodesWithScores: NodeWithScore[] = [];

    for (const type in vectorStores) {
      const vectorStore: BaseVectorStore = vectorStores[type as ModalityType]!;
      nodesWithScores = nodesWithScores.concat(
        await this.retrieveQuery(query, type as ModalityType, vectorStore),
      );
    }
    return nodesWithScores;
  }

  protected async retrieveQuery(
    query: MessageContent,
    type: ModalityType,
    vectorStore: BaseVectorStore,
    filters?: MetadataFilters,
    customParams?: unknown,
  ): Promise<NodeWithScore[]> {
    // convert string message to multi-modal format

    let queryStr = query;
    if (typeof query === "string") {
      queryStr = query;
      query = [{ type: "text", text: queryStr }];
    } else {
      queryStr = extractText(query);
    }
    // overwrite embed model if specified, otherwise use the one from the vector store
    const embedModel = this.index.embedModel ?? vectorStore.embedModel;
    let nodes: NodeWithScore[] = [];
    // query each content item (e.g. text or image) separately
    for (const item of query) {
      const queryEmbedding = await embedModel.getQueryEmbedding(item);
      if (queryEmbedding) {
        const result = await vectorStore.query({
          queryStr,
          queryEmbedding,
          mode: this.queryMode ?? VectorStoreQueryMode.DEFAULT,
          similarityTopK: this.topK[type]!,
          filters: this.filters ?? filters ?? undefined,
          customParams: this.customParams ?? customParams ?? undefined,
        });
        nodes = nodes.concat(this.buildNodeListFromQueryResult(result));
      }
    }
    return nodes;
  }

  protected buildNodeListFromQueryResult(result: VectorStoreQueryResult) {
    const nodesWithScores: NodeWithScore[] = [];
    for (let i = 0; i < result.ids.length; i++) {
      const node = result.nodes?.[i];
      if (!node) {
        throw new Error(
          `Node not found in query result for id ${result.ids[i]}`,
        );
      }

      // XXX: Hack, if it's an image node, we reconstruct the image from the URL
      // Alternative: Store image in doc store and retrieve it here
      if (node instanceof ImageNode) {
        node.image = node.getUrl();
      }

      nodesWithScores.push({
        node: node,
        score: result.similarities[i]!,
      });
    }

    return nodesWithScores;
  }
}
