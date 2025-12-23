import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BaseVectorStore,
  metadataDictToNode,
  MetadataMode,
  nodeToMetadata,
  type BaseNode,
  type MetadataFilters,
  type VectorStoreBaseParams,
  type VectorStoreQuery,
  VectorStoreQueryMode,
  type VectorStoreQueryResult,
  combineResults,
} from "@vectorstores/core";
import { getEnv } from "@vectorstores/env";

export interface SupabaseVectorStoreInit extends VectorStoreBaseParams {
  client?: SupabaseClient;
  supabaseUrl?: string;
  supabaseKey?: string;
  table: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseFilter = Record<string, any>;

interface SearchEmbeddingsResponse {
  id: string;
  content: string;
  metadata: object;
  embedding: number[];
  similarity: number;
}

export class SupabaseVectorStore extends BaseVectorStore {
  storesText: boolean = true;
  private flatMetadata: boolean = false;
  private supabaseClient: SupabaseClient;
  private table: string;

  /**
   * Creates a new instance of SupabaseVectorStore
   * @param init Configuration object containing either a Supabase client or URL/key pair, and table name
   * @throws Error if neither client nor valid URL/key pair is provided
   */
  constructor(init: SupabaseVectorStoreInit) {
    super(init);
    this.table = init.table;
    if (init.client) {
      this.supabaseClient = init.client;
    } else {
      const supabaseUrl = init.supabaseUrl || getEnv("SUPABASE_URL");
      const supabaseKey = init.supabaseKey || getEnv("SUPABASE_KEY");
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          "Must specify SUPABASE_URL and SUPABASE_KEY via env variable if not directly passing in client.",
        );
      }
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Returns the Supabase client instance used by this vector store
   * @returns The configured Supabase client
   */
  public client() {
    return this.supabaseClient;
  }

  /**
   * Adds an array of nodes to the vector store
   * @param nodes Array of BaseNode objects to store
   * @returns Array of node IDs that were successfully stored
   * @throws Error if the insertion fails
   */
  public async add(nodes: BaseNode[]): Promise<string[]> {
    if (!nodes.length) {
      return [];
    }

    const dataToInsert = nodes.map((node) => {
      const metadata = nodeToMetadata(node, true, "text", this.flatMetadata);

      return {
        id: node.id_,
        content: node.getContent(MetadataMode.NONE),
        embedding: node.getEmbedding(),
        metadata,
      };
    });

    const { data, error } = await this.supabaseClient
      .from(this.table)
      .insert(dataToInsert);

    if (error) {
      throw new Error(
        `Error inserting documents: ${JSON.stringify(error, null, 2)}`,
      );
    }

    return nodes.map((node) => node.id_);
  }

  /**
   * Deletes documents from the vector store based on the reference document ID
   * @param refDocId The reference document ID to delete
   * @param deleteOptions Optional parameters for the delete operation
   * @throws Error if the deletion fails
   */
  public async delete(refDocId: string, deleteOptions?: object): Promise<void> {
    const { error } = await this.supabaseClient
      .from(this.table)
      .delete()
      .eq("metadata->>ref_doc_id", refDocId);
    if (error) {
      throw new Error(
        `Error deleting document with id ${refDocId}: ${JSON.stringify(
          error,
          null,
          2,
        )}`,
      );
    }
  }

  /**
   * Queries the vector store for similar documents
   * @param query Query parameters including the query embedding and number of results to return
   * @param options Optional parameters for the query operation
   * @returns Object containing matched nodes, similarity scores, and document IDs
   * @throws Error if query embedding is not provided or if the query fails
   */
  public async query(
    query: VectorStoreQuery,
    options?: object,
  ): Promise<VectorStoreQueryResult> {
    switch (query.mode) {
      case VectorStoreQueryMode.BM25:
        return this.bm25Search(query);
      case VectorStoreQueryMode.HYBRID:
        const vectorResult = await this.vectorSearch(query);
        const bm25Result = await this.bm25Search(query);
        return combineResults(
          vectorResult,
          bm25Result,
          query.alpha ?? 0.5,
          query.similarityTopK,
        );
      default:
        return this.vectorSearch(query);
    }
  }

  private async vectorSearch(
    query: VectorStoreQuery,
  ): Promise<VectorStoreQueryResult> {
    if (!query.queryEmbedding) {
      throw new Error("Query embedding is required");
    }

    const { data, error } = await this.supabaseClient.rpc("match_documents", {
      query_embedding: query.queryEmbedding,
      match_count: query.similarityTopK,
      filter: this.toSupabaseFilter(query.filters),
    });

    if (error) {
      throw new Error(
        `Error querying vector store: ${JSON.stringify(error, null, 2)}`,
      );
    }

    const searchedEmbeddingResponses = data || [];
    const nodes = searchedEmbeddingResponses.map(
      (item: SearchEmbeddingsResponse) => {
        const node = metadataDictToNode(item.metadata ?? {}, {
          fallback: {
            id: item.id,
            text: item.content,
            metadata: item.metadata,
          },
        });
        node.embedding = item.embedding;
        node.setContent(item.content);
        return node;
      },
    );

    const similarities = searchedEmbeddingResponses.map(
      (item: SearchEmbeddingsResponse) => {
        return item.similarity;
      },
    );

    return {
      nodes,
      similarities,
      ids: searchedEmbeddingResponses.map(
        (item: SearchEmbeddingsResponse) => item.id,
      ),
    };
  }

  private async bm25Search(
    query: VectorStoreQuery,
  ): Promise<VectorStoreQueryResult> {
    if (!query.queryStr) {
      throw new Error("Query string is required for BM25 search");
    }

    const { data, error } = await this.supabaseClient
      .from(this.table)
      .select("*")
      .textSearch("content", query.queryStr)
      .limit(query.similarityTopK);

    if (error) {
      throw new Error(
        `Error querying vector store: ${JSON.stringify(error, null, 2)}`,
      );
    }

    const nodes = (data || []).map((item) => {
      const node = metadataDictToNode(item.metadata ?? {}, {
        fallback: {
          id: item.id,
          text: item.content,
          metadata: item.metadata,
        },
      });
      node.embedding = item.embedding;
      node.setContent(item.content);
      return node;
    });

    return {
      nodes,
      similarities: nodes.map(() => 1.0),
      ids: (data || []).map((item) => item.id),
    };
  }

  /**
   * Converts metadata filters to supabase query filter format
   * @param queryFilters - Metadata filters to convert
   * @returns supabase query filter object
   * @private
   */
  private toSupabaseFilter(queryFilters: MetadataFilters | undefined) {
    if (queryFilters?.filters && queryFilters.filters.length > 0) {
      return queryFilters.filters.reduce<SupabaseFilter>((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
    }
    return {};
  }

  async exists(refDocId: string): Promise<boolean> {
    const { count } = await this.supabaseClient
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .eq("metadata->>ref_doc_id", refDocId);
    return (count ?? 0) > 0;
  }
}
