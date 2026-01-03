import {
  createClient,
  type Client,
  type InArgs,
  type InStatement,
  type Config as LibSQLClientConfig,
} from "@libsql/client";

import {
  BaseVectorStore,
  DEFAULT_COLLECTION,
  Document,
  FilterCondition,
  FilterOperator,
  MetadataMode,
  type BaseNode,
  type Metadata,
  type MetadataFilter,
  type VectorStoreBaseParams,
  type VectorStoreQuery,
  type VectorStoreQueryResult,
} from "@vectorstores/core";
import { getEnv } from "@vectorstores/env";

export const LIBSQL_TABLE = "libsql_vectorstores_embedding";
export const DEFAULT_DIMENSIONS = 1536;

type PositionalArgs = Extract<InArgs, readonly unknown[]>;

// Helper function to safely convert unknown array to InArgs
function toInArgs(params: unknown[]): InArgs {
  // Filter and validate parameters to ensure they match InArgs requirements
  return params.filter(
    (param): param is NonNullable<PositionalArgs[number]> =>
      param != null &&
      (typeof param === "string" ||
        typeof param === "number" ||
        typeof param === "boolean" ||
        param instanceof ArrayBuffer ||
        ArrayBuffer.isView(param) ||
        param instanceof Date),
  ) as PositionalArgs;
}

/**
 * Provides support for writing and querying vector data in libSQL/Turso.
 * Uses native libSQL vector operations for similarity search.
 */
export class LibSQLVectorStore extends BaseVectorStore {
  storesText: boolean = true;

  private collection: string = DEFAULT_COLLECTION;
  private readonly tableName: string = LIBSQL_TABLE;
  private readonly dimensions: number = DEFAULT_DIMENSIONS;
  private readonly clientUrl?: string | undefined;

  private clientInstance: Client;
  private initialized: boolean = false;

  constructor(
    init: Partial<{ client: Client }> &
      Partial<{
        tableName?: string;
        dimensions?: number;
        collection?: string;
        clientConfig?: LibSQLClientConfig;
      }> &
      VectorStoreBaseParams,
  ) {
    super(init);

    this.collection = init.collection ?? DEFAULT_COLLECTION;
    this.tableName = init.tableName ?? LIBSQL_TABLE;
    this.dimensions = init.dimensions ?? DEFAULT_DIMENSIONS;

    let clientConfig = init.clientConfig;

    if (init.client) {
      this.clientInstance = init.client;
    } else {
      clientConfig = clientConfig ?? this.getDefaultClientConfig();
      if (!clientConfig) {
        throw new Error(
          "LibSQL clientConfig is required when no client instance is provided.",
        );
      }
      this.clientInstance = createClient(clientConfig);
    }

    this.clientUrl = clientConfig?.url;
  }

  setCollection(coll: string) {
    this.collection = coll;
  }

  getCollection(): string {
    return this.collection;
  }

  client(): Client {
    return this.clientInstance;
  }

  private getDefaultClientConfig(): LibSQLClientConfig {
    const envUrl = getEnv("LIBSQL_URL");
    const url = envUrl ?? ":memory:";

    if (!envUrl) {
      console.warn(
        "LIBSQL_URL not set. Falling back to in-memory libSQL (non-persistent). Set LIBSQL_URL for a persistent database.",
      );
    }

    const authToken = getEnv("LIBSQL_AUTH_TOKEN");

    return authToken ? { url, authToken } : { url };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.checkSchema(this.clientInstance);
      this.initialized = true;
    }
  }

  private async checkSchema(client: Client) {
    const createTableStatement: InStatement = {
      sql: `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          external_id TEXT,
          collection TEXT,
          document TEXT,
          metadata JSON DEFAULT '{}',
          embeddings F32_BLOB(${this.dimensions})
        )
      `,
      args: [],
    };
    await client.execute(createTableStatement);

    try {
      const indexStatement: InStatement = {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_${this.tableName}_external_id
          ON ${this.tableName} (external_id)
        `,
        args: [],
      };
      await client.execute(indexStatement);
    } catch {
      // Index might already exist, ignore
    }

    try {
      const collectionIndexStatement: InStatement = {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_${this.tableName}_collection
          ON ${this.tableName} (collection)
        `,
        args: [],
      };
      await client.execute(collectionIndexStatement);
    } catch {
      // Index might already exist, ignore
    }
    try {
      const vectorIndexStatement: InStatement = {
        sql: `
            CREATE INDEX IF NOT EXISTS idx_${this.tableName}_vector
            ON ${this.tableName} (libsql_vector_idx(embeddings, 'metric=cosine'))
          `,
        args: [],
      };
      await client.execute(vectorIndexStatement);
    } catch (e) {
      console.warn("Failed to create vector index:", e);
    }
  }

  async clearCollection(): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE collection = ?`;
    await this.ensureInitialized();
    const validParams = toInArgs([this.collection]);
    const statement: InStatement = { sql, args: validParams };
    await this.clientInstance.execute(statement);
  }

  private getDataToInsert(embeddingResults: BaseNode<Metadata>[]) {
    return embeddingResults.map((node) => {
      const id = node.id_.length ? node.id_ : null;
      const meta = node.metadata || {};
      if (!meta.create_date) {
        meta.create_date = new Date();
      }

      let embedding: Float32Array;
      try {
        embedding = this.normalizeEmbedding(node.getEmbedding());
      } catch {
        console.warn(
          `Embedding missing for node ${id ?? "<auto-id>"}, using zero vector.`,
        );
        embedding = new Float32Array(this.dimensions);
      }

      // Convert embedding to JSON string for vector() function
      const embeddingJson = `[${Array.from(embedding).join(",")}]`;

      return [
        id!,
        "",
        this.collection,
        node.getContent(MetadataMode.NONE),
        JSON.stringify(meta),
        embeddingJson,
      ];
    });
  }

  async add(embeddingResults: BaseNode<Metadata>[]): Promise<string[]> {
    if (embeddingResults.length === 0) {
      console.warn("Empty list sent to LibSQLVectorStore::add");
      return [];
    }

    await this.ensureInitialized();
    const data = this.getDataToInsert(embeddingResults);

    const placeholders = data
      .map(
        (_, index) =>
          `(?${index * 6 + 1}, ?${index * 6 + 2}, ?${index * 6 + 3}, ?${index * 6 + 4}, ?${index * 6 + 5}, vector32(?${index * 6 + 6}))`,
      )
      .join(", ");

    const sql = `
      INSERT INTO ${this.tableName}
        (id, external_id, collection, document, metadata, embeddings)
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        external_id = excluded.external_id,
        collection = excluded.collection,
        document = excluded.document,
        metadata = excluded.metadata,
        embeddings = excluded.embeddings
    `;

    const flattenedParams = data.flat();
    const validParams = toInArgs(flattenedParams);
    const statement: InStatement = { sql, args: validParams };
    await this.clientInstance.execute(statement);
    return data.map((row) => String(row[0]));
  }

  async delete(refDocId: string, _deleteKwargs?: object): Promise<void> {
    await this.ensureInitialized();

    const collectionCriteria = this.collection.length
      ? "AND collection = ?"
      : "";
    const sql = `DELETE FROM ${this.tableName} WHERE id = ? ${collectionCriteria}`;

    const args = this.collection.length
      ? [refDocId, this.collection]
      : [refDocId];
    const validParams = toInArgs(args);
    const statement: InStatement = { sql, args: validParams };
    await this.clientInstance.execute(statement);
  }

  private normalizeEmbedding(embedding?: number[]): Float32Array {
    if (!embedding || embedding.length === 0) {
      return new Float32Array(this.dimensions);
    }

    if (embedding.length === this.dimensions) {
      return new Float32Array(embedding);
    }

    const normalized = new Float32Array(this.dimensions);
    normalized.set(embedding.slice(0, this.dimensions));
    return normalized;
  }

  private deserializeEmbedding(raw: unknown): number[] {
    if (!raw) return [];

    if (raw instanceof Float32Array) {
      return Array.from(raw);
    }

    if (raw instanceof ArrayBuffer) {
      return Array.from(new Float32Array(raw));
    }

    if (ArrayBuffer.isView(raw)) {
      const view = raw as ArrayBufferView;
      return Array.from(
        new Float32Array(
          view.buffer,
          view.byteOffset,
          view.byteLength / Float32Array.BYTES_PER_ELEMENT,
        ),
      );
    }

    if (Array.isArray(raw)) {
      return raw.map((value) => Number(value));
    }

    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i += 1) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dot += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    if (normA === 0 || normB === 0) return 0;

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private toLibSQLCondition(condition: `${FilterCondition}`) {
    switch (condition) {
      case FilterCondition.AND:
        return "AND";
      case FilterCondition.OR:
        return "OR";
      default:
        return "AND";
    }
  }

  private buildFilterClause(filter: MetadataFilter): {
    clause: string;
    params: unknown[];
  } {
    const key = filter.key;

    switch (filter.operator) {
      case FilterOperator.EQ:
        return {
          clause: `json_extract(metadata, '$.${key}') = ?`,
          params: [filter.value],
        };
      case FilterOperator.GT:
        return {
          clause: `CAST(json_extract(metadata, '$.${key}') AS REAL) > ?`,
          params: [filter.value],
        };
      case FilterOperator.LT:
        return {
          clause: `CAST(json_extract(metadata, '$.${key}') AS REAL) < ?`,
          params: [filter.value],
        };
      case FilterOperator.GTE:
        return {
          clause: `CAST(json_extract(metadata, '$.${key}') AS REAL) >= ?`,
          params: [filter.value],
        };
      case FilterOperator.LTE:
        return {
          clause: `CAST(json_extract(metadata, '$.${key}') AS REAL) <= ?`,
          params: [filter.value],
        };
      case FilterOperator.NE:
        return {
          clause: `json_extract(metadata, '$.${key}') != ?`,
          params: [filter.value],
        };
      case FilterOperator.IN:
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => "?").join(", ");
          return {
            clause: `json_extract(metadata, '$.${key}') IN (${placeholders})`,
            params: filter.value,
          };
        }
        return {
          clause: `json_extract(metadata, '$.${key}') IN (?)`,
          params: [filter.value],
        };
      case FilterOperator.NIN:
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => "?").join(", ");
          return {
            clause: `json_extract(metadata, '$.${key}') NOT IN (${placeholders})`,
            params: filter.value,
          };
        }
        return {
          clause: `json_extract(metadata, '$.${key}') NOT IN (?)`,
          params: [filter.value],
        };
      case FilterOperator.CONTAINS:
        return {
          clause: `json_extract(metadata, '$.${key}') LIKE '%' || ? || '%'`,
          params: [filter.value],
        };
      case FilterOperator.IS_EMPTY:
        return {
          clause: `(json_extract(metadata, '$.${key}') IS NULL OR json_extract(metadata, '$.${key}') = '' OR json_extract(metadata, '$.${key}') = '[]')`,
          params: [],
        };
      case FilterOperator.TEXT_MATCH:
        return {
          clause: `LOWER(json_extract(metadata, '$.${key}')) LIKE LOWER('%' || ? || '%')`,
          params: [filter.value],
        };
      default:
        return {
          clause: `json_extract(metadata, '$.${key}') = ?`,
          params: [filter.value],
        };
    }
  }

  async query(
    query: VectorStoreQuery,
    _options?: object,
  ): Promise<VectorStoreQueryResult> {
    const max = query.similarityTopK ?? 2;
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (this.collection.length) {
      whereClauses.push("collection = ?");
      params.push(this.collection);
    }

    const filterClauses: string[] = [];
    query.filters?.filters.forEach((filter: MetadataFilter) => {
      const { clause, params: filterParams } = this.buildFilterClause(filter);
      filterClauses.push(clause);
      if (filterParams.length > 0) {
        params.push(...filterParams);
      }
    });

    if (filterClauses.length > 0) {
      const condition = this.toLibSQLCondition(
        query.filters?.condition ?? FilterCondition.AND,
      );
      whereClauses.push(`(${filterClauses.join(` ${condition} `)})`);
    }

    const where =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    await this.ensureInitialized();

    const queryEmbedding = query.queryEmbedding ?? [];
    const hasQueryEmbedding = queryEmbedding.length > 0;

    if (hasQueryEmbedding) {
      const vectorJson = `[${queryEmbedding.join(",")}]`;
      const vectorArgs = toInArgs([vectorJson, ...params]);
      const vectorStatement: InStatement = {
        sql: `
          SELECT *, vector_distance_cos(embeddings, vector32(?)) as distance
          FROM ${this.tableName}
          ${where}
          ORDER BY distance
          LIMIT ${max}
        `,
        args: vectorArgs,
      };

      try {
        const vectorResults =
          await this.clientInstance.execute(vectorStatement);
        return this.mapQueryResult(vectorResults.rows, queryEmbedding, max);
      } catch (err) {
        console.warn(
          "libSQL vector_distance_cos unavailable, falling back to JS similarity:",
          err,
        );
      }
    }

    const baseStatement: InStatement = {
      sql: `
        SELECT *
        FROM ${this.tableName}
        ${where}
      `,
      args: toInArgs(params),
    };
    const results = await this.clientInstance.execute(baseStatement);

    const mapped = this.mapQueryResult(results.rows, queryEmbedding, max);

    return mapped;
  }

  persist(_persistPath: string): Promise<void> {
    return Promise.resolve();
  }

  private mapQueryResult(
    rows: Record<string, unknown>[],
    queryEmbedding: number[],
    max: number,
  ): VectorStoreQueryResult {
    const scored = rows.map((row: Record<string, unknown>) => {
      const embedding = this.deserializeEmbedding(row.embeddings);
      const distance = row.distance;
      const similarity =
        distance !== undefined
          ? 1 - Number(distance)
          : queryEmbedding.length && embedding.length
            ? this.cosineSimilarity(queryEmbedding, embedding)
            : 0;
      const node = new Document({
        id_: String(row.id),
        text: String(row.document || ""),
        metadata:
          typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : (row.metadata as Metadata),
        embedding,
      });
      return {
        node,
        similarity,
        id: String(row.id),
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, max);

    return {
      nodes: top.map((row) => row.node),
      similarities: top.map((row) => row.similarity),
      ids: top.map((row) => row.id),
    };
  }
}
