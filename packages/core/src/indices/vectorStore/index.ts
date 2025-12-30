import {
  calcEmbeddings,
  type EmbeddingsByType,
  type TextEmbedFunc,
} from "../../embeddings/index.js";
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
  ModalityType,
  type NodeWithScore,
} from "../../schema/index.js";
import { createVectorStores } from "../../storage/stores.js";
import { extractSingleText } from "../../utils/llms.js";
import type {
  BaseVectorStore,
  MetadataFilters,
  VectorStoreByType,
  VectorStoreQuery,
  VectorStoreQueryMode,
  VectorStoreQueryResult,
} from "../../vector-store/index.js";
import { BaseIndex } from "../BaseIndex.js";

export type VectorIndexOptions = {
  nodes?: BaseNode[] | undefined;
  vectorStore?: BaseVectorStore | undefined;
  vectorStores?: VectorStoreByType | undefined;
  persistDir?: string | undefined;
  logProgress?: boolean | undefined;
  progressCallback?: ((progress: number, total: number) => void) | undefined;
  /** Text embedding function. Falls back to Settings.embedFunc if not provided. */
  embedFunc?: TextEmbedFunc | undefined;
  /** Map of modality to embedding function. Overrides embedFunc for specified modalities. */
  embeddings?: EmbeddingsByType | undefined;
};

/**
 * The VectorStoreIndex, an index that stores the nodes only according to their vector embeddings.
 */
export class VectorStoreIndex extends BaseIndex {
  /**
   * The async init function creates a new VectorStoreIndex.
   * @param options
   * @returns
   */
  public static async init(
    options: VectorIndexOptions = {},
  ): Promise<VectorStoreIndex> {
    const vectorStores =
      options.vectorStores ??
      (await createVectorStores({
        vectorStore: options.vectorStore,
        persistDir: options.persistDir,
      }));

    // Resolve embeddings: explicit embeddings > embedFunc > Settings.embedFunc
    const textEmbedFunc = options.embedFunc ?? Settings.embedFunc ?? undefined;
    const embeddings: EmbeddingsByType = options.embeddings ?? {
      ...(textEmbedFunc ? { [ModalityType.TEXT]: textEmbedFunc } : {}),
    };

    if (!embeddings[ModalityType.TEXT]) {
      throw new Error(
        "No text embedding function provided. Pass embedFunc, embeddings, or set Settings.embedFunc.",
      );
    }

    const index = new VectorStoreIndex({
      vectorStores,
      embeddings,
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
      }));
    const docStoreStrategy = args.docStoreStrategy ?? DocStoreStrategy.UPSERTS;

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
    const nodes = await runTransformations(documents, [nodeParser], {});

    if (args.logProgress) {
      console.log("Finished parsing documents.");
    }

    // Resolve embeddings: explicit embeddings > embedFunc > Settings.embedFunc
    const textEmbedFunc = args.embedFunc ?? Settings.embedFunc ?? undefined;
    const embeddings: EmbeddingsByType = args.embeddings ?? {
      ...(textEmbedFunc ? { [ModalityType.TEXT]: textEmbedFunc } : {}),
    };

    if (!embeddings[ModalityType.TEXT]) {
      throw new Error(
        "No text embedding function provided. Pass embedFunc, embeddings, or set Settings.embedFunc.",
      );
    }

    // Create the index - deduplication happens in insertNodes via addNodesToVectorStores
    const index = new VectorStoreIndex({
      vectorStores,
      embeddings,
    });

    // Insert nodes with embeddings and deduplication
    await index.insertNodes(nodes, {
      logProgress: args.logProgress,
      progressCallback: args.progressCallback,
      docStoreStrategy,
    });

    return index;
  }

  static async fromVectorStores(
    vectorStores: VectorStoreByType,
    embeddings: EmbeddingsByType,
  ) {
    if (!vectorStores[ModalityType.TEXT]?.storesText) {
      throw new Error(
        "Cannot initialize from a vector store that does not store text",
      );
    }

    const index = await VectorStoreIndex.init({
      nodes: [],
      vectorStores,
      embeddings,
    });

    return index;
  }

  static async fromVectorStore(
    vectorStore: BaseVectorStore,
    embeddings: EmbeddingsByType,
  ) {
    return VectorStoreIndex.fromVectorStores(
      {
        [ModalityType.TEXT]: vectorStore,
      },
      embeddings,
    );
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
    // Add embeddings to nodes using the embeddings transformation
    const embeddingsTransform = calcEmbeddings(this.embeddings);
    nodes = await embeddingsTransform(nodes);
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

function requiresQueryEmbedding(mode: VectorStoreQueryMode) {
  return mode !== "bm25";
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
    this.queryMode = options.mode ?? "default";
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
    if (typeof query === "string") {
      query = [{ type: "text", text: query }];
    }
    const queryMode = this.queryMode ?? "default";
    const needsEmbedding = requiresQueryEmbedding(queryMode);
    let nodes: NodeWithScore[] = [];
    // query each content item (e.g. text or image) separately
    for (const item of query) {
      let queryEmbedding: number[] | null = null;
      if (needsEmbedding) {
        // For text queries, always use TEXT embedFunc (required for CLIP multimodal search)
        if (item.type === "text" && "text" in item) {
          const textEmbedFunc = this.index.embeddings?.[ModalityType.TEXT];
          if (!textEmbedFunc) {
            throw new Error(
              "No TEXT embedding function provided. Pass embeddings option to VectorStoreIndex.",
            );
          }
          const embeddings = await textEmbedFunc([item.text]);
          queryEmbedding = embeddings[0] ?? null;
        } else if (item.type === "image_url" && "image_url" in item) {
          const imageEmbedFunc = this.index.embeddings?.[ModalityType.IMAGE];
          if (!imageEmbedFunc) {
            throw new Error(
              "No IMAGE embedding function provided. Pass embeddings option to VectorStoreIndex.",
            );
          }
          const embeddings = await imageEmbedFunc([item.image_url.url]);
          queryEmbedding = embeddings[0] ?? null;
        }

        if (!queryEmbedding) {
          continue;
        }
      }

      const vectorQuery: VectorStoreQuery = {
        similarityTopK: this.topK[type]!,
        mode: queryMode,
        filters: this.filters ?? filters ?? undefined,
        customParams: this.customParams ?? customParams ?? undefined,
        queryEmbedding: queryEmbedding ?? undefined,
        queryStr: extractSingleText(item) ?? undefined,
        alpha: this.alpha ?? undefined,
      };

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

      nodesWithScores.push({
        node: node,
        score: result.similarities[i]!,
      });
    }

    return nodesWithScores;
  }
}
