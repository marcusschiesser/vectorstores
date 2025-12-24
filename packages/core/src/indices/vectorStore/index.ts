import { BaseEmbedding, type TextEmbedFunc } from "../../embeddings/index.js";
import { DEFAULT_SIMILARITY_TOP_K } from "../../embeddings/utils.js";
import { Settings } from "../../global/index.js";
import {
  addNodesToVectorStores,
  runTransformations,
} from "../../ingestion/IngestionPipeline.js";
import { DocStoreStrategy } from "../../ingestion/strategies/index.js";
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
import { createVectorStores } from "../../storage/stores.js";
import { extractText } from "../../utils/index.js";
import {
  type BaseVectorStore,
  type MetadataFilters,
  type VectorStoreByType,
  type VectorStoreQuery,
  VectorStoreQueryMode,
  type VectorStoreQueryResult,
} from "../../vector-store/index.js";
import { BaseIndex, type BaseIndexInit } from "../BaseIndex.js";

export interface VectorIndexOptions {
  nodes?: BaseNode[] | undefined;
  vectorStore?: BaseVectorStore | undefined;
  vectorStores?: VectorStoreByType | undefined;
  persistDir?: string | undefined;
  logProgress?: boolean | undefined;
  progressCallback?: ((progress: number, total: number) => void) | undefined;
  // @deprecated: use embedFunc instead
  embedModel?: BaseEmbedding | undefined;
  embedFunc?: TextEmbedFunc | undefined;
}

export interface VectorIndexConstructorProps extends BaseIndexInit {
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

  private constructor(init: VectorIndexConstructorProps) {
    super(init);
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
    const vectorStores =
      options.vectorStores ??
      (await createVectorStores({
        vectorStore: options.vectorStore,
        persistDir: options.persistDir,
        embedFunc: options.embedFunc,
      }));

    const index = new VectorStoreIndex({
      vectorStores,
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
    const vectorStores =
      args.vectorStores ??
      (await createVectorStores({
        vectorStore: args.vectorStore,
        persistDir: args.persistDir,
        embedFunc: args.embedFunc,
      }));
    args.docStoreStrategy = args.docStoreStrategy ?? DocStoreStrategy.UPSERTS;

    if (args.logProgress) {
      console.log("Using node parser on documents...");
    }

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

    // Parse documents into nodes (no deduplication here)
    args.nodes = await runTransformations(documents, [nodeParser], {});

    if (args.logProgress) {
      console.log("Finished parsing documents.");
    }

    // Create the index - deduplication happens in insertNodes via addNodesToVectorStores
    const index = new VectorStoreIndex({
      vectorStores,
      embedModel: args.embedModel,
      embedFunc: args.embedFunc,
    });

    // Insert nodes with embeddings and deduplication
    await index.insertNodes(args.nodes, {
      logProgress: args.logProgress,
      progressCallback: args.progressCallback,
      docStoreStrategy: args.docStoreStrategy,
    });

    return index;
  }

  static async fromVectorStores(vectorStores: VectorStoreByType) {
    if (!vectorStores[ModalityType.TEXT]?.storesText) {
      throw new Error(
        "Cannot initialize from a vector store that does not store text",
      );
    }

    const index = await VectorStoreIndex.init({
      nodes: [],
      vectorStores,
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
      docStoreStrategy?: DocStoreStrategy;
    },
  ): Promise<void> {
    if (!nodes || nodes.length === 0) {
      return;
    }
    nodes = await this.getNodeEmbeddingResults(nodes, options);
    await addNodesToVectorStores(
      nodes,
      this.vectorStores,
      options?.docStoreStrategy ?? DocStoreStrategy.NONE,
    );
  }

  async deleteRefDoc(refDocId: string): Promise<void> {
    for (const vectorStore of Object.values(this.vectorStores)) {
      await this.deleteRefDocFromStore(vectorStore, refDocId);
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

const modesRequiringQueryString = new Set<VectorStoreQueryMode>([
  VectorStoreQueryMode.BM25,
  VectorStoreQueryMode.HYBRID,
  VectorStoreQueryMode.SEMANTIC_HYBRID,
]);

function requiresQueryEmbedding(mode: VectorStoreQueryMode) {
  return mode !== VectorStoreQueryMode.BM25;
}

function requiresQueryString(mode: VectorStoreQueryMode) {
  return modesRequiringQueryString.has(mode);
}

export type VectorIndexRetrieverOptions = {
  index: VectorStoreIndex;
  filters?: MetadataFilters | undefined;
  mode?: VectorStoreQueryMode;
  customParams?: unknown | undefined;
  alpha?: number | undefined;
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
  alpha?: number | undefined;
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
    this.alpha = options.alpha;
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
    const queryMode = this.queryMode ?? VectorStoreQueryMode.DEFAULT;
    const needsEmbedding = requiresQueryEmbedding(queryMode);
    const needsQueryString = requiresQueryString(queryMode);
    let nodes: NodeWithScore[] = [];
    // query each content item (e.g. text or image) separately
    for (const item of query) {
      let queryEmbedding: number[] | null = null;
      if (needsEmbedding) {
        if (!embedModel) {
          throw new Error(
            "VectorIndexRetriever requires an embedding model for this query mode.",
          );
        }
        queryEmbedding = await embedModel.getQueryEmbedding(item);
        if (!queryEmbedding) {
          continue;
        }
      }

      const vectorQuery: VectorStoreQuery = {
        similarityTopK: this.topK[type]!,
        mode: queryMode,
        filters: this.filters ?? filters ?? undefined,
        customParams: this.customParams ?? customParams ?? undefined,
      };

      if (needsEmbedding && queryEmbedding) {
        vectorQuery.queryEmbedding = queryEmbedding;
      }
      if (needsQueryString) {
        vectorQuery.queryStr = queryStr;
      }
      if (this.alpha !== undefined) {
        vectorQuery.alpha = this.alpha;
      }

      const result = await vectorStore.query(vectorQuery);
      nodes = nodes.concat(this.buildNodeListFromQueryResult(result));
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
