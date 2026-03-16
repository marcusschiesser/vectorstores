import type { BaseNode, Metadata } from "@vectorstores/core";
import {
  BaseVectorStore,
  FilterCondition,
  FilterOperator,
  metadataDictToNode,
  nodeToMetadata,
  type MetadataFilters,
  type VectorStoreQuery,
  type VectorStoreQueryResult,
} from "@vectorstores/core";
import { Endee, Precision, type Index } from "endee";

/**
 * Custom parameters for Endee queries
 */
export interface EndeeCustomParams {
  /** Search quality parameter (max 1024) */
  ef?: number;
  /** Sparse vector indices for hybrid search */
  sparseIndices?: number[];
  /** Sparse vector values for hybrid search */
  sparseValues?: number[];
  /** Filter tuning: prefilter cardinality threshold (1000-1000000) */
  prefilterCardinalityThreshold?: number;
  /** Filter tuning: filter boost percentage (0-100) */
  filterBoostPercentage?: number;
}

/**
 * Configuration parameters for EndeeVectorStore
 */
export interface EndeeVectorStoreParams {
  /** Name of the Endee index */
  indexName: string;
  /** Optional pre-configured Endee client */
  client?: Endee;
  /** Endee server URL (default: http://127.0.0.1:8080/api/v1) */
  url?: string;
  /** Authentication token for Endee server */
  authToken?: string;
  /** Batch size for uploads (default: 100) */
  batchSize?: number;
  /** Vector dimension for auto-creating index */
  dimension?: number;
  /** Sparse vector dimension for hybrid indexes */
  sparseDimension?: number;
  /** Distance metric (default: 'cosine') */
  spaceType?: "cosine" | "l2" | "ip";
  /** Vector precision (default: INT16) */
  precision?: Precision;
  /** HNSW parameter M */
  M?: number;
  /** HNSW parameter efCon */
  efCon?: number;
}

/**
 * Endee vector store implementation.
 *
 * Supports dense, sparse, and hybrid vector searches with advanced filtering capabilities.
 */
export class EndeeVectorStore extends BaseVectorStore<
  Endee,
  EndeeCustomParams
> {
  storesText: boolean = true;

  // Private fields
  private db?: Endee;
  private indexInstance?: Index;
  private indexInitialized: boolean = false;

  // Configuration
  indexName: string;
  url: string;
  authToken?: string;
  batchSize: number;
  dimension?: number;
  sparseDimension?: number;
  spaceType: "cosine" | "l2" | "ip";
  precision: Precision;
  M?: number;
  efCon?: number;

  /**
   * Creates a new EndeeVectorStore instance.
   */
  constructor(params: EndeeVectorStoreParams) {
    super();

    if (!params.indexName) {
      throw new Error("EndeeVectorStore requires indexName");
    }

    this.indexName = params.indexName;
    this.url = params.url ?? "http://127.0.0.1:8080/api/v1";
    if (params.authToken !== undefined) {
      this.authToken = params.authToken;
    }
    this.batchSize = params.batchSize ?? 100;
    if (params.dimension !== undefined) {
      this.dimension = params.dimension;
    }
    if (params.sparseDimension !== undefined) {
      this.sparseDimension = params.sparseDimension;
    }
    this.spaceType = params.spaceType ?? "cosine";
    this.precision = params.precision ?? Precision.INT16;
    if (params.M !== undefined) {
      this.M = params.M;
    }
    if (params.efCon !== undefined) {
      this.efCon = params.efCon;
    }

    // If client is provided, use it directly
    if (params.client) {
      this.db = params.client;
    }
  }

  /**
   * Returns the Endee client, lazily initializing if needed.
   */
  client(): Endee {
    if (!this.db) {
      this.db = new Endee(this.authToken ?? null);
      this.db.setBaseUrl(this.url);
    }
    return this.db;
  }

  /**
   * Ensures the index exists, creating it if necessary and dimension is provided.
   * @returns The Endee Index instance
   * @throws Error if index doesn't exist and dimension is not provided
   */
  private async ensureIndex(): Promise<Index> {
    if (this.indexInitialized && this.indexInstance) {
      return this.indexInstance;
    }

    const client = this.client();

    try {
      // Try to get existing index
      this.indexInstance = await client.getIndex(this.indexName);
      this.indexInitialized = true;
      return this.indexInstance;
    } catch (error) {
      // Index doesn't exist, try to create it
      if (!this.dimension) {
        throw new Error(
          `Index "${this.indexName}" does not exist and dimension is not provided. ` +
            `Either create the index manually or provide dimension parameter.`,
        );
      }

      // Create index with provided parameters
      const createParams: {
        name: string;
        dimension: number;
        spaceType: "cosine" | "l2" | "ip";
        precision: Precision;
        sparseDimension?: number;
        M?: number;
        efCon?: number;
      } = {
        name: this.indexName,
        dimension: this.dimension,
        spaceType: this.spaceType,
        precision: this.precision,
      };

      if (this.sparseDimension) {
        createParams.sparseDimension = this.sparseDimension;
      }
      if (this.M) {
        createParams.M = this.M;
      }
      if (this.efCon) {
        createParams.efCon = this.efCon;
      }

      // createIndex returns a string, need to get the index after
      await client.createIndex(createParams);
      this.indexInstance = await client.getIndex(this.indexName);
      this.indexInitialized = true;
      return this.indexInstance;
    }
  }

  /**
   * Adds nodes to the vector store.
   * @param embeddingResults The nodes to be inserted
   * @returns Array of node IDs that were added
   */
  async add(embeddingResults: BaseNode<Metadata>[]): Promise<string[]> {
    if (embeddingResults.length === 0) {
      return [];
    }

    // Auto-detect dimension from first node if not set
    if (!this.dimension && embeddingResults[0]) {
      this.dimension = embeddingResults[0].getEmbedding().length;
    }

    // Ensure index exists
    const index = await this.ensureIndex();

    // Convert nodes to Endee format
    const vectors = embeddingResults.map((node) => {
      const embedding = node.getEmbedding();
      const metadata = nodeToMetadata(node);

      // Extract ref_doc_id for filtering
      const refDocId = metadata.ref_doc_id;

      // Build filter object with primitive values for searching
      const filter: Record<string, string | number | boolean | undefined> = {
        ref_doc_id: refDocId,
      };

      // Add other primitive metadata to filter
      for (const [key, value] of Object.entries(metadata)) {
        if (
          key !== "_node_content" &&
          key !== "_node_type" &&
          (typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean")
        ) {
          filter[key] = value;
        }
      }

      return {
        id: node.id_,
        vector: embedding,
        meta: metadata, // Full metadata for node reconstruction
        filter: filter, // Searchable primitives
      };
    });

    // Batch upsert
    const ids: string[] = [];
    for (let i = 0; i < vectors.length; i += this.batchSize) {
      const chunk = vectors.slice(i, i + this.batchSize);
      await index.upsert(chunk);
      ids.push(...chunk.map((v) => v.id));
    }

    return ids;
  }

  /**
   * Deletes all nodes associated with a document reference ID.
   * @param refDocId The document reference ID
   */
  async delete(refDocId: string): Promise<void> {
    const index = await this.ensureIndex();

    // Delete all vectors with matching ref_doc_id
    await index.deleteWithFilter([{ ref_doc_id: { $eq: refDocId } }]);
  }

  /**
   * Checks if any nodes exist for the given document reference ID.
   * @param refDocId The document reference ID to check
   * @returns true if any nodes with this ref_doc_id exist
   */
  async exists(refDocId: string): Promise<boolean> {
    const index = await this.ensureIndex();

    // Query with a dummy vector and filter on ref_doc_id
    // Use topK=1 for efficiency
    const dimension = this.dimension ?? 1536; // fallback dimension
    const dummyVector = new Array(dimension).fill(0);

    const results = await index.query({
      vector: dummyVector,
      topK: 1,
      filter: [{ ref_doc_id: { $eq: refDocId } }],
    });

    return results.length > 0;
  }

  /**
   * Queries the vector store for the closest matching data.
   * @param query The VectorStoreQuery to be used
   * @param _options Additional options (currently unused)
   * @returns Query results with nodes, similarities, and IDs
   */
  async query(
    query: VectorStoreQuery<EndeeCustomParams>,
    _options?: object,
  ): Promise<VectorStoreQueryResult> {
    if (!query.queryEmbedding) {
      throw new Error(
        "Endee vector search requires a dense query embedding (queryEmbedding)",
      );
    }

    const index = await this.ensureIndex();

    // Build query options
    const queryOptions: {
      vector: number[];
      topK: number;
      filter?: Array<Record<string, unknown>>;
      ef?: number;
      sparseIndices?: number[];
      sparseValues?: number[];
      prefilterCardinalityThreshold?: number;
      filterBoostPercentage?: number;
    } = {
      vector: query.queryEmbedding,
      topK: query.similarityTopK,
    };

    // Add filters
    const filter = this.buildEndeeFilter(query.filters, query.docIds);
    if (filter && filter.length > 0) {
      queryOptions.filter = filter;
    }

    // Apply custom parameters
    if (query.customParams) {
      const {
        ef,
        sparseIndices,
        sparseValues,
        prefilterCardinalityThreshold,
        filterBoostPercentage,
      } = query.customParams;

      if (ef !== undefined) {
        queryOptions.ef = ef;
      }

      // Hybrid search support
      if (sparseIndices && sparseValues) {
        queryOptions.sparseIndices = sparseIndices;
        queryOptions.sparseValues = sparseValues;
      }

      // Filter tuning parameters
      if (prefilterCardinalityThreshold !== undefined) {
        queryOptions.prefilterCardinalityThreshold =
          prefilterCardinalityThreshold;
      }
      if (filterBoostPercentage !== undefined) {
        queryOptions.filterBoostPercentage = filterBoostPercentage;
      }
    }

    // Execute query
    const results = await index.query(queryOptions);

    // Convert results to VectorStoreQueryResult
    const nodes: BaseNode[] = [];
    const similarities: number[] = [];
    const ids: string[] = [];

    for (const result of results) {
      // Reconstruct node from metadata
      const node = metadataDictToNode(result.meta as Metadata);
      nodes.push(node);
      similarities.push(result.similarity);
      ids.push(result.id);
    }

    return {
      nodes,
      similarities,
      ids,
    };
  }

  /**
   * Builds Endee-compatible filter from MetadataFilters and docIds.
   * @param filters MetadataFilters to convert
   * @param docIds Optional document IDs to filter by
   * @returns Endee filter array
   */
  private buildEndeeFilter(
    filters?: MetadataFilters,
    docIds?: string[],
  ): Array<Record<string, unknown>> {
    const endeeFilters: Array<Record<string, unknown>> = [];

    // Add docIds filter
    if (docIds && docIds.length > 0) {
      endeeFilters.push({ ref_doc_id: { $in: docIds } });
    }

    // Convert metadata filters
    if (filters?.filters) {
      // Check for OR condition and warn
      if (filters.condition === FilterCondition.OR) {
        console.warn(
          "Endee only supports AND conditions. OR filters will be treated as AND.",
        );
      }

      for (const filter of filters.filters) {
        const { key, value, operator } = filter;

        switch (operator) {
          case FilterOperator.EQ:
            endeeFilters.push({ [key]: { $eq: value } });
            break;

          case FilterOperator.IN:
            if (Array.isArray(value)) {
              endeeFilters.push({ [key]: { $in: value } });
            } else {
              console.warn(
                `IN operator requires array value for key "${key}". Skipping filter.`,
              );
            }
            break;

          case FilterOperator.GT:
            if (typeof value === "number") {
              if (value >= 999) {
                console.warn(
                  `GT filter value ${value} exceeds Endee's range limit (0-999). Skipping filter.`,
                );
              } else {
                endeeFilters.push({ [key]: { $range: [value + 1, 999] } });
              }
            }
            break;

          case FilterOperator.GTE:
            if (typeof value === "number") {
              if (value > 999) {
                console.warn(
                  `GTE filter value ${value} exceeds Endee's range limit (0-999). Skipping filter.`,
                );
              } else {
                endeeFilters.push({ [key]: { $range: [value, 999] } });
              }
            }
            break;

          case FilterOperator.LT:
            if (typeof value === "number") {
              if (value <= 0) {
                console.warn(
                  `LT filter value ${value} is below Endee's range limit (0-999). Skipping filter.`,
                );
              } else {
                endeeFilters.push({ [key]: { $range: [0, value - 1] } });
              }
            }
            break;

          case FilterOperator.LTE:
            if (typeof value === "number") {
              if (value < 0) {
                console.warn(
                  `LTE filter value ${value} is below Endee's range limit (0-999). Skipping filter.`,
                );
              } else {
                endeeFilters.push({
                  [key]: { $range: [0, Math.min(value, 999)] },
                });
              }
            }
            break;

          case FilterOperator.NE:
          case FilterOperator.NIN:
            console.warn(
              `Endee does not support ${operator} operator. Skipping filter for key "${key}".`,
            );
            break;

          case FilterOperator.ANY:
          case FilterOperator.ALL:
          case FilterOperator.TEXT_MATCH:
          case FilterOperator.CONTAINS:
          case FilterOperator.IS_EMPTY:
            console.warn(
              `Endee does not support ${operator} operator. Skipping filter for key "${key}".`,
            );
            break;

          default:
            console.warn(
              `Unsupported filter operator "${operator}" for key "${key}". Skipping filter.`,
            );
        }
      }
    }

    return endeeFilters;
  }
}
