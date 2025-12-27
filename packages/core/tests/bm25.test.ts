import { describe, expect, test } from "vitest";
import { Document } from "../src/schema/index.js";
import { BM25 } from "../src/vector-store/bm25.js";

describe("BM25", () => {
  const createDoc = (id: string, text: string) =>
    new Document({ id_: id, text });

  describe("constructor", () => {
    test("initializes with documents", () => {
      const docs = [
        createDoc("1", "the quick brown fox"),
        createDoc("2", "the lazy dog"),
      ];
      const bm25 = new BM25(docs);

      expect(bm25.getDocumentCount()).toBe(2);
      expect(bm25.getAverageDocumentLength()).toBeGreaterThan(0);
    });

    test("handles empty document list", () => {
      const bm25 = new BM25([]);

      expect(bm25.getDocumentCount()).toBe(0);
      expect(bm25.getAverageDocumentLength()).toBe(0);
    });

    test("accepts custom k1 and b parameters", () => {
      const docs = [createDoc("1", "test document")];
      const bm25 = new BM25(docs, { k1: 2.0, b: 0.5 });

      // Should not throw
      expect(bm25.getDocumentCount()).toBe(1);
    });
  });

  describe("search", () => {
    test("finds exact keyword match", () => {
      const docs = [
        createDoc("1", "the cat sat on the mat"),
        createDoc("2", "the dog ran in the park"),
        createDoc("3", "birds fly in the sky"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("cat", 3);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("1");
      expect(results[0]?.score).toBeGreaterThan(0);
    });

    test("returns empty for no matches", () => {
      const docs = [
        createDoc("1", "the cat sat on the mat"),
        createDoc("2", "the dog ran in the park"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("elephant", 3);

      expect(results).toHaveLength(0);
    });

    test("ranks multiple matches by relevance", () => {
      const docs = [
        createDoc("1", "python programming language"),
        createDoc("2", "python snake in the zoo"),
        createDoc("3", "python python python tutorial"), // Higher term frequency
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("python", 3);

      expect(results).toHaveLength(3);
      // Doc 3 should rank highest due to higher term frequency
      expect(results[0]?.id).toBe("3");
    });

    test("respects topK limit", () => {
      const docs = [
        createDoc("1", "apple fruit"),
        createDoc("2", "apple pie"),
        createDoc("3", "apple tree"),
        createDoc("4", "apple juice"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("apple", 2);

      expect(results).toHaveLength(2);
    });

    test("handles multi-word queries", () => {
      const docs = [
        createDoc("1", "machine learning algorithms"),
        createDoc("2", "deep learning neural networks"),
        createDoc("3", "machine learning deep learning"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("machine learning", 3);

      // Doc 1 and 3 contain both terms
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Doc 3 should rank higher as it contains both query terms
      const doc3Rank = results.findIndex(
        (r: { id: string; score: number }) => r.id === "3",
      );
      const doc2Rank = results.findIndex(
        (r: { id: string; score: number }) => r.id === "2",
      );
      expect(doc3Rank).toBeLessThan(doc2Rank); // Lower rank = higher position
    });

    test("is case insensitive", () => {
      const docs = [createDoc("1", "The Quick Brown Fox")];
      const bm25 = new BM25(docs);

      const results1 = bm25.search("quick", 1);
      const results2 = bm25.search("QUICK", 1);
      const results3 = bm25.search("QuIcK", 1);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results3).toHaveLength(1);
      expect(results1[0]?.score).toBe(results2[0]?.score);
      expect(results2[0]?.score).toBe(results3[0]?.score);
    });

    test("ignores punctuation and special characters", () => {
      const docs = [createDoc("1", "Hello, world! How are you?")];
      const bm25 = new BM25(docs);

      const results = bm25.search("hello world", 1);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("1");
    });

    test("handles documents with varying lengths", () => {
      const docs = [
        createDoc("1", "short doc"),
        createDoc(
          "2",
          "this is a much longer document with many words that talks about various topics including cats",
        ),
        createDoc("3", "cats are great pets"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("cats", 3);

      // Doc 3 should rank higher than doc 2 for "cats" due to length normalization
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe("3"); // Shorter doc with cats
      expect(results[1]?.id).toBe("2"); // Longer doc with cats
    });
  });

  describe("IDF (Inverse Document Frequency)", () => {
    test("rare terms get higher scores than common terms", () => {
      const docs = [
        createDoc("1", "the cat"),
        createDoc("2", "the dog"),
        createDoc("3", "the bird"),
        createDoc("4", "the unique unicorn"), // "unicorn" appears only once
      ];
      const bm25 = new BM25(docs);

      // "the" appears in all docs, "unicorn" appears in only one
      const commonResults = bm25.search("the", 4);
      const rareResults = bm25.search("unicorn", 4);

      // The rare term should have a higher score
      expect(rareResults[0]?.score).toBeGreaterThan(commonResults[0]!.score);
    });
  });

  describe("edge cases", () => {
    test("handles empty query", () => {
      const docs = [createDoc("1", "test document")];
      const bm25 = new BM25(docs);

      const results = bm25.search("", 10);

      expect(results).toHaveLength(0);
    });

    test("handles query with only stopwords/common words", () => {
      const docs = [
        createDoc("1", "the quick brown fox"),
        createDoc("2", "a lazy dog"),
      ];
      const bm25 = new BM25(docs);

      // "the" appears in doc 1, should still return results
      const results = bm25.search("the", 10);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("1");
    });

    test("handles documents with repeated words", () => {
      const docs = [
        createDoc("1", "test test test test"),
        createDoc("2", "test"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("test", 2);

      expect(results).toHaveLength(2);
      // Doc with more occurrences should rank higher (before length normalization kicks in too much)
      expect(results[0]?.id).toBe("1");
    });

    test("handles unicode text", () => {
      const docs = [
        createDoc("1", "café résumé naïve"),
        createDoc("2", "hello world"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("café", 2);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("1");
    });

    test("handles numeric content", () => {
      const docs = [
        createDoc("1", "error code 404 not found"),
        createDoc("2", "error code 500 server error"),
        createDoc("3", "success code 200"),
      ];
      const bm25 = new BM25(docs);

      const results = bm25.search("404", 3);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("1");
    });
  });

  describe("BM25 parameters", () => {
    test("k1=0 gives binary term frequency", () => {
      const docs = [
        createDoc("1", "cat cat cat cat"), // Many cats
        createDoc("2", "cat"), // One cat
      ];

      // With k1=0, term frequency saturation is immediate
      const bm25 = new BM25(docs, { k1: 0, b: 0 });
      const results = bm25.search("cat", 2);

      // With k1=0 and b=0, both docs should have similar scores
      // (differences only from the formula structure)
      expect(results).toHaveLength(2);
    });

    test("b=0 disables length normalization", () => {
      const docs = [
        createDoc("1", "cat"),
        createDoc("2", "cat " + "word ".repeat(100)), // Same term, much longer doc
      ];

      const bm25NoNorm = new BM25(docs, { b: 0 });
      const results = bm25NoNorm.search("cat", 2);

      // With b=0, length shouldn't affect ranking much
      // (both have same tf for "cat")
      expect(results).toHaveLength(2);
    });
  });
});
