import { describe, expect, test } from "vitest";
import { Document } from "../src/schema/index.js";
import { combineResults, RRF_K, rrfScore } from "../src/vector-store/rrf.js";

describe("Reciprocal Rank Fusion (RRF)", () => {
  describe("rrfScore", () => {
    test("calculates correct score for rank 1", () => {
      // 1 / (60 + 1) = 0.01639...
      expect(rrfScore(1)).toBeCloseTo(1 / 61, 6);
    });

    test("calculates correct score for rank 10", () => {
      // 1 / (60 + 10) = 0.01428...
      expect(rrfScore(10)).toBeCloseTo(1 / 70, 6);
    });

    test("higher ranks get lower scores", () => {
      expect(rrfScore(1)).toBeGreaterThan(rrfScore(2));
      expect(rrfScore(2)).toBeGreaterThan(rrfScore(10));
      expect(rrfScore(10)).toBeGreaterThan(rrfScore(100));
    });

    test("uses default k value of 60", () => {
      expect(RRF_K).toBe(60);
    });

    test("allows custom k value", () => {
      expect(rrfScore(1, 20)).toBeCloseTo(1 / 21, 6);
    });
  });

  describe("combineResults", () => {
    const createNode = (id: string, text: string) =>
      new Document({ text, id_: id });

    test("combines overlapping results correctly", () => {
      const vectorResults = {
        ids: ["a", "b"],
        similarities: [0.9, 0.8], // Raw scores don't matter for RRF
        nodes: [createNode("a", "doc a"), createNode("b", "doc b")],
      };

      const bm25Results = {
        ids: ["b", "a"],
        similarities: [1.5, 1.2], // Different order in BM25
        nodes: [createNode("b", "doc b"), createNode("a", "doc a")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);

      // Both documents appear in both result sets
      expect(result.ids).toHaveLength(2);

      // Doc A: vector rank 1, bm25 rank 2
      // Doc B: vector rank 2, bm25 rank 1
      // With alpha=0.5, both should have equal combined scores
      const scoreA = result.similarities[result.ids.indexOf("a")]!;
      const scoreB = result.similarities[result.ids.indexOf("b")]!;
      expect(scoreA).toBeCloseTo(scoreB, 6);
    });

    test("document appearing in only vector results", () => {
      const vectorResults = {
        ids: ["a", "b"],
        similarities: [0.9, 0.8],
        nodes: [createNode("a", "doc a"), createNode("b", "doc b")],
      };

      const bm25Results = {
        ids: ["a"],
        similarities: [1.5],
        nodes: [createNode("a", "doc a")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);

      expect(result.ids).toHaveLength(2);

      // Doc A is in both: 0.5 * rrf(1) + 0.5 * rrf(1)
      // Doc B is only in vector: 0.5 * rrf(2) + 0
      const scoreA = result.similarities[result.ids.indexOf("a")]!;
      const scoreB = result.similarities[result.ids.indexOf("b")]!;

      const expectedScoreA = 0.5 * rrfScore(1) + 0.5 * rrfScore(1);
      const expectedScoreB = 0.5 * rrfScore(2);

      expect(scoreA).toBeCloseTo(expectedScoreA, 6);
      expect(scoreB).toBeCloseTo(expectedScoreB, 6);
      expect(scoreA).toBeGreaterThan(scoreB);
    });

    test("document appearing in only BM25 results", () => {
      const vectorResults = {
        ids: ["a"],
        similarities: [0.9],
        nodes: [createNode("a", "doc a")],
      };

      const bm25Results = {
        ids: ["a", "b"],
        similarities: [1.5, 1.2],
        nodes: [createNode("a", "doc a"), createNode("b", "doc b")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);

      expect(result.ids).toHaveLength(2);

      // Doc A is in both: 0.5 * rrf(1) + 0.5 * rrf(1)
      // Doc B is only in BM25: 0 + 0.5 * rrf(2)
      const scoreA = result.similarities[result.ids.indexOf("a")]!;
      const scoreB = result.similarities[result.ids.indexOf("b")]!;

      const expectedScoreA = 0.5 * rrfScore(1) + 0.5 * rrfScore(1);
      const expectedScoreB = 0.5 * rrfScore(2);

      expect(scoreA).toBeCloseTo(expectedScoreA, 6);
      expect(scoreB).toBeCloseTo(expectedScoreB, 6);
    });

    test("respects alpha parameter for vector-heavy weighting", () => {
      const vectorResults = {
        ids: ["a"],
        similarities: [0.9],
        nodes: [createNode("a", "doc a")],
      };

      const bm25Results = {
        ids: ["b"],
        similarities: [1.5],
        nodes: [createNode("b", "doc b")],
      };

      // alpha = 1 means pure vector
      const resultVectorOnly = combineResults(
        vectorResults,
        bm25Results,
        1.0,
        2,
      );
      expect(resultVectorOnly.ids[0]).toBe("a");
      expect(resultVectorOnly.similarities[0]).toBeCloseTo(rrfScore(1), 6);
      // BM25 contribution is 0 when alpha=1
      expect(resultVectorOnly.similarities[1]).toBe(0);
    });

    test("respects alpha parameter for BM25-heavy weighting", () => {
      const vectorResults = {
        ids: ["a"],
        similarities: [0.9],
        nodes: [createNode("a", "doc a")],
      };

      const bm25Results = {
        ids: ["b"],
        similarities: [1.5],
        nodes: [createNode("b", "doc b")],
      };

      // alpha = 0 means pure BM25
      const resultBm25Only = combineResults(vectorResults, bm25Results, 0.0, 2);
      expect(resultBm25Only.ids[0]).toBe("b");
      expect(resultBm25Only.similarities[0]).toBeCloseTo(rrfScore(1), 6);
      // Vector contribution is 0 when alpha=0
      expect(resultBm25Only.similarities[1]).toBe(0);
    });

    test("limits results to similarityTopK", () => {
      const vectorResults = {
        ids: ["a", "b", "c"],
        similarities: [0.9, 0.8, 0.7],
        nodes: [
          createNode("a", "doc a"),
          createNode("b", "doc b"),
          createNode("c", "doc c"),
        ],
      };

      const bm25Results = {
        ids: ["d", "e"],
        similarities: [1.5, 1.2],
        nodes: [createNode("d", "doc d"), createNode("e", "doc e")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);
      expect(result.ids).toHaveLength(2);
    });

    test("results are sorted by score descending", () => {
      const vectorResults = {
        ids: ["a", "b", "c"],
        similarities: [0.9, 0.8, 0.7],
        nodes: [
          createNode("a", "doc a"),
          createNode("b", "doc b"),
          createNode("c", "doc c"),
        ],
      };

      const bm25Results = {
        ids: ["c", "b", "a"], // Reverse order
        similarities: [1.5, 1.2, 1.0],
        nodes: [
          createNode("c", "doc c"),
          createNode("b", "doc b"),
          createNode("a", "doc a"),
        ],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 3);

      // Scores should be in descending order
      for (let i = 0; i < result.similarities.length - 1; i++) {
        expect(result.similarities[i]).toBeGreaterThanOrEqual(
          result.similarities[i + 1]!,
        );
      }
    });

    test("documents in both lists get boosted over single-list documents", () => {
      // Doc A appears in both lists at rank 2
      // Doc B appears only in vector at rank 1
      // Doc C appears only in BM25 at rank 1
      const vectorResults = {
        ids: ["b", "a"],
        similarities: [0.9, 0.8],
        nodes: [createNode("b", "doc b"), createNode("a", "doc a")],
      };

      const bm25Results = {
        ids: ["c", "a"],
        similarities: [1.5, 1.2],
        nodes: [createNode("c", "doc c"), createNode("a", "doc a")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 3);

      // Doc A (rank 2 in both): 0.5 * rrf(2) + 0.5 * rrf(2)
      // Doc B (rank 1 in vector only): 0.5 * rrf(1)
      // Doc C (rank 1 in BM25 only): 0.5 * rrf(1)
      const scoreA = result.similarities[result.ids.indexOf("a")]!;
      const scoreB = result.similarities[result.ids.indexOf("b")]!;
      const scoreC = result.similarities[result.ids.indexOf("c")]!;

      // A appears in both at rank 2, which should beat single rank 1
      // 2 * 0.5 * rrf(2) vs 0.5 * rrf(1)
      // 2 * 0.5 * (1/62) vs 0.5 * (1/61)
      // (1/62) vs 0.5 * (1/61)
      // 0.0161 vs 0.0082
      expect(scoreA).toBeGreaterThan(scoreB);
      expect(scoreA).toBeGreaterThan(scoreC);
      expect(scoreB).toBeCloseTo(scoreC, 6); // Equal scores for single-list rank 1
    });

    test("handles empty vector results", () => {
      const vectorResults = {
        ids: [],
        similarities: [],
        nodes: [],
      };

      const bm25Results = {
        ids: ["a", "b"],
        similarities: [1.5, 1.2],
        nodes: [createNode("a", "doc a"), createNode("b", "doc b")],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);

      expect(result.ids).toEqual(["a", "b"]);
      expect(result.similarities[0]).toBeCloseTo(0.5 * rrfScore(1), 6);
    });

    test("handles empty BM25 results", () => {
      const vectorResults = {
        ids: ["a", "b"],
        similarities: [0.9, 0.8],
        nodes: [createNode("a", "doc a"), createNode("b", "doc b")],
      };

      const bm25Results = {
        ids: [],
        similarities: [],
        nodes: [],
      };

      const result = combineResults(vectorResults, bm25Results, 0.5, 2);

      expect(result.ids).toEqual(["a", "b"]);
      expect(result.similarities[0]).toBeCloseTo(0.5 * rrfScore(1), 6);
    });
  });
});
