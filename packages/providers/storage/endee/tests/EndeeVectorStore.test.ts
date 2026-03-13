import type { BaseNode, MetadataFilters } from "@vectorstores/core";
import { FilterCondition, FilterOperator, TextNode } from "@vectorstores/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the endee module before any imports that might use it
const mockIndex = {
  upsert: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  deleteWithFilter: vi.fn().mockResolvedValue(undefined),
};

const mockEndeeClient = {
  setBaseUrl: vi.fn(),
  getIndex: vi.fn().mockResolvedValue(mockIndex),
  createIndex: vi.fn().mockResolvedValue("test-index"),
};

vi.mock("endee", () => ({
  Endee: vi.fn(() => mockEndeeClient),
  Precision: {
    INT16: "INT16",
    INT8: "INT8",
    FLOAT32: "FLOAT32",
  },
}));

// Import after mocking
import { EndeeVectorStore } from "../src/EndeeVectorStore";

describe("EndeeVectorStore", () => {
  let store: EndeeVectorStore;
  let nodes: BaseNode[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockEndeeClient.getIndex.mockResolvedValue(mockIndex);
    mockIndex.upsert.mockResolvedValue(undefined);
    mockIndex.query.mockResolvedValue([]);
    mockIndex.deleteWithFilter.mockResolvedValue(undefined);

    store = new EndeeVectorStore({
      indexName: "test-index",
      dimension: 128,
    });

    nodes = [
      new TextNode({
        id_: "node-1",
        embedding: [0.1, 0.2, 0.3],
        text: "The quick brown fox",
        metadata: {
          category: "animals",
          priority: 1,
          active: true,
        },
      }),
      new TextNode({
        id_: "node-2",
        embedding: [0.4, 0.5, 0.6],
        text: "The lazy dog",
        metadata: {
          category: "animals",
          priority: 2,
          active: false,
        },
      }),
      new TextNode({
        id_: "node-3",
        embedding: [0.7, 0.8, 0.9],
        text: "A jumping cat",
        metadata: {
          category: "pets",
          priority: 3,
          active: true,
        },
      }),
    ];
  });

  describe("[EndeeVectorStore] constructor", () => {
    it("should throw error when indexName is not provided", () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        new EndeeVectorStore({});
      }).toThrow("EndeeVectorStore requires indexName");
    });

    it("should create store with default values", () => {
      const store = new EndeeVectorStore({ indexName: "my-index" });
      expect(store.indexName).toBe("my-index");
      expect(store.url).toBe("http://127.0.0.1:8080/api/v1");
      expect(store.batchSize).toBe(100);
      expect(store.spaceType).toBe("cosine");
    });

    it("should create store with custom parameters", () => {
      const store = new EndeeVectorStore({
        indexName: "custom-index",
        url: "http://custom:9000/api/v1",
        authToken: "secret-token",
        batchSize: 50,
        dimension: 256,
        spaceType: "l2",
        M: 16,
        efCon: 200,
      });

      expect(store.indexName).toBe("custom-index");
      expect(store.url).toBe("http://custom:9000/api/v1");
      expect(store.batchSize).toBe(50);
      expect(store.dimension).toBe(256);
      expect(store.spaceType).toBe("l2");
      expect(store.M).toBe(16);
      expect(store.efCon).toBe(200);
    });
  });

  describe("[EndeeVectorStore] add", () => {
    it("should add nodes and return their IDs", async () => {
      const ids = await store.add(nodes);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("node-1");
      expect(ids).toContain("node-2");
      expect(ids).toContain("node-3");
      expect(mockIndex.upsert).toHaveBeenCalled();
    });

    it("should return empty array for empty input", async () => {
      const ids = await store.add([]);
      expect(ids).toHaveLength(0);
      expect(mockIndex.upsert).not.toHaveBeenCalled();
    });

    it("should auto-detect dimension from first node", async () => {
      const storeWithoutDim = new EndeeVectorStore({
        indexName: "auto-dim-index",
      });

      // Simulate index creation on first add
      mockEndeeClient.getIndex.mockRejectedValueOnce(new Error("Not found"));

      await storeWithoutDim.add(nodes);

      expect(mockEndeeClient.createIndex).toHaveBeenCalledWith(
        expect.objectContaining({
          dimension: 3, // nodes have 3-dimensional embeddings
        }),
      );
    });

    it("should batch upsert when nodes exceed batch size", async () => {
      const smallBatchStore = new EndeeVectorStore({
        indexName: "small-batch",
        dimension: 3,
        batchSize: 2,
      });

      await smallBatchStore.add(nodes);

      // Should have 2 upsert calls: one for first 2 nodes, one for last node
      expect(mockIndex.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("[EndeeVectorStore] delete", () => {
    it("should call deleteWithFilter with correct ref_doc_id", async () => {
      await store.delete("doc-1");

      expect(mockIndex.deleteWithFilter).toHaveBeenCalledWith([
        { ref_doc_id: { $eq: "doc-1" } },
      ]);
    });
  });

  describe("[EndeeVectorStore] exists", () => {
    it("should return true when vectors exist", async () => {
      mockIndex.query.mockResolvedValueOnce([{ id: "1", similarity: 0.9 }]);

      const exists = await store.exists("doc-1");

      expect(exists).toBe(true);
      expect(mockIndex.query).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: 1,
          filter: [{ ref_doc_id: { $eq: "doc-1" } }],
        }),
      );
    });

    it("should return false when no vectors exist", async () => {
      mockIndex.query.mockResolvedValueOnce([]);

      const exists = await store.exists("doc-1");

      expect(exists).toBe(false);
    });
  });

  describe("[EndeeVectorStore] query", () => {
    it("should throw error when queryEmbedding is not provided", async () => {
      await expect(
        // @ts-expect-error Testing invalid input without queryEmbedding
        store.query({
          similarityTopK: 10,
          mode: "default",
        }),
      ).rejects.toThrow("requires a dense query embedding");
    });

    it("should query with embedding and return results", async () => {
      mockIndex.query.mockResolvedValueOnce([
        {
          id: "node-1",
          similarity: 0.95,
          meta: {
            _node_content: JSON.stringify({ text: "The quick brown fox" }),
            _node_type: "TextNode",
          },
        },
      ]);

      const result = await store.query({
        queryEmbedding: [0.1, 0.2, 0.3],
        similarityTopK: 10,
        mode: "default",
      });

      expect(result.ids).toContain("node-1");
      expect(result.similarities).toContain(0.95);
      expect(mockIndex.query).toHaveBeenCalledWith(
        expect.objectContaining({
          vector: [0.1, 0.2, 0.3],
          topK: 10,
        }),
      );
    });

    it("should pass custom params to query", async () => {
      mockIndex.query.mockResolvedValueOnce([]);

      await store.query({
        queryEmbedding: [0.1, 0.2, 0.3],
        similarityTopK: 5,
        mode: "default",
        customParams: {
          ef: 100,
          sparseIndices: [1, 2, 3],
          sparseValues: [0.5, 0.3, 0.2],
          prefilterCardinalityThreshold: 5000,
          filterBoostPercentage: 50,
        },
      });

      expect(mockIndex.query).toHaveBeenCalledWith(
        expect.objectContaining({
          ef: 100,
          sparseIndices: [1, 2, 3],
          sparseValues: [0.5, 0.3, 0.2],
          prefilterCardinalityThreshold: 5000,
          filterBoostPercentage: 50,
        }),
      );
    });
  });

  describe("[EndeeVectorStore] buildEndeeFilter", () => {
    // Access private method for testing
    const callBuildEndeeFilter = (
      store: EndeeVectorStore,
      filters?: MetadataFilters,
      docIds?: string[],
    ): Array<Record<string, unknown>> => {
      return (
        store as unknown as {
          buildEndeeFilter: (
            filters?: MetadataFilters,
            docIds?: string[],
          ) => Array<Record<string, unknown>>;
        }
      ).buildEndeeFilter(filters, docIds);
    };

    describe("docIds filter", () => {
      it("should create $in filter for docIds", () => {
        const result = callBuildEndeeFilter(store, undefined, [
          "doc-1",
          "doc-2",
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ ref_doc_id: { $in: ["doc-1", "doc-2"] } });
      });

      it("should return empty array when no docIds provided", () => {
        const result = callBuildEndeeFilter(store, undefined, undefined);
        expect(result).toHaveLength(0);
      });
    });

    describe("EQ operator", () => {
      it("should convert EQ filter to $eq", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.EQ },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ category: { $eq: "animals" } });
      });
    });

    describe("IN operator", () => {
      it("should convert IN filter to $in", () => {
        const filters: MetadataFilters = {
          filters: [
            {
              key: "category",
              value: ["animals", "pets"],
              operator: FilterOperator.IN,
            },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ category: { $in: ["animals", "pets"] } });
      });

      it("should warn and skip IN filter with non-array value", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.IN },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("IN operator requires array value"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("GT operator", () => {
      it("should convert GT filter to $range", () => {
        const filters: MetadataFilters = {
          filters: [{ key: "priority", value: 5, operator: FilterOperator.GT }],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ priority: { $range: [6, 999] } });
      });

      it("should warn and skip GT filter when value >= 999", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: 999, operator: FilterOperator.GT },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("exceeds Endee's range limit"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("GTE operator", () => {
      it("should convert GTE filter to $range", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: 5, operator: FilterOperator.GTE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ priority: { $range: [5, 999] } });
      });

      it("should warn and skip GTE filter when value > 999", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: 1000, operator: FilterOperator.GTE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("exceeds Endee's range limit"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("LT operator", () => {
      it("should convert LT filter to $range", () => {
        const filters: MetadataFilters = {
          filters: [{ key: "priority", value: 5, operator: FilterOperator.LT }],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ priority: { $range: [0, 4] } });
      });

      it("should warn and skip LT filter when value <= 0", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [{ key: "priority", value: 0, operator: FilterOperator.LT }],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("is below Endee's range limit"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("LTE operator", () => {
      it("should convert LTE filter to $range", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: 5, operator: FilterOperator.LTE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ priority: { $range: [0, 5] } });
      });

      it("should cap LTE value at 999", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: 1500, operator: FilterOperator.LTE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ priority: { $range: [0, 999] } });
      });

      it("should warn and skip LTE filter when value < 0", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "priority", value: -1, operator: FilterOperator.LTE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("is below Endee's range limit"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("unsupported operators", () => {
      it("should warn for NE operator", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.NE },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("does not support"),
        );

        warnSpy.mockRestore();
      });

      it("should warn for NIN operator", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            {
              key: "category",
              value: ["animals"],
              operator: FilterOperator.NIN,
            },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("does not support"),
        );

        warnSpy.mockRestore();
      });

      it("should warn for TEXT_MATCH operator", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            {
              key: "category",
              value: "ani",
              operator: FilterOperator.TEXT_MATCH,
            },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("does not support"),
        );

        warnSpy.mockRestore();
      });

      it("should warn for CONTAINS operator", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            {
              key: "tags",
              value: "important",
              operator: FilterOperator.CONTAINS,
            },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("does not support"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("OR condition", () => {
      it("should warn when OR condition is used", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.EQ },
            { key: "priority", value: 1, operator: FilterOperator.EQ },
          ],
          condition: FilterCondition.OR,
        };

        callBuildEndeeFilter(store, filters);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("OR filters will be treated as AND"),
        );

        warnSpy.mockRestore();
      });
    });

    describe("combined filters", () => {
      it("should combine docIds and metadata filters", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.EQ },
          ],
        };

        const result = callBuildEndeeFilter(store, filters, ["doc-1", "doc-2"]);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
          ref_doc_id: { $in: ["doc-1", "doc-2"] },
        });
        expect(result).toContainEqual({ category: { $eq: "animals" } });
      });

      it("should handle multiple metadata filters", () => {
        const filters: MetadataFilters = {
          filters: [
            { key: "category", value: "animals", operator: FilterOperator.EQ },
            { key: "priority", value: 5, operator: FilterOperator.GTE },
            {
              key: "status",
              value: ["active", "pending"],
              operator: FilterOperator.IN,
            },
          ],
        };

        const result = callBuildEndeeFilter(store, filters);

        expect(result).toHaveLength(3);
        expect(result).toContainEqual({ category: { $eq: "animals" } });
        expect(result).toContainEqual({ priority: { $range: [5, 999] } });
        expect(result).toContainEqual({
          status: { $in: ["active", "pending"] },
        });
      });
    });
  });

  describe("[EndeeVectorStore] storesText", () => {
    it("should have storesText set to true", () => {
      expect(store.storesText).toBe(true);
    });
  });

  describe("[EndeeVectorStore] client", () => {
    it("should return the Endee client", () => {
      const client = store.client();
      expect(client).toBeDefined();
    });
  });
});
