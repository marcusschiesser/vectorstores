import type { BaseNode } from "../schema/index.js";
import type { VectorStoreQueryResult } from "./index.js";

/**
 * Reciprocal Rank Fusion (RRF) constant.
 *
 * Standard value used by Elasticsearch, Weaviate, MongoDB Atlas, and other databases.
 * The constant k=60 was empirically found to work well across many datasets.
 *
 * It prevents the top-ranked result from having too high a score relative to others,
 * while still giving higher-ranked results more weight.
 *
 * Score for rank 1: 1/61 ≈ 0.0164
 * Score for rank 2: 1/62 ≈ 0.0161
 * Score for rank 10: 1/70 ≈ 0.0143
 */
export const RRF_K = 60;

/**
 * Calculates the RRF score for a given rank position.
 *
 * Formula: score = 1 / (k + rank)
 *
 * The rank is 1-indexed (first result has rank 1, not 0).
 *
 * @param rank - The 1-indexed rank position of the document
 * @param k - The RRF constant (default: 60)
 * @returns The RRF score for that rank
 *
 * @example
 * ```typescript
 * rrfScore(1);  // 0.01639... (rank 1)
 * rrfScore(2);  // 0.01613... (rank 2)
 * rrfScore(10); // 0.01429... (rank 10)
 * ```
 */
export const rrfScore = (rank: number, k: number = RRF_K): number => {
  return 1 / (k + rank);
};

/**
 * Combines vector search results and BM25 results using Reciprocal Rank Fusion (RRF).
 *
 * RRF is score-agnostic - it only considers the rank position of documents,
 * not their raw scores. This makes it robust when combining results from
 * different scoring systems (like cosine similarity and BM25) that have
 * incompatible score ranges.
 *
 * The formula for each document is:
 *   score = alpha × rrf(vectorRank) + (1 - alpha) × rrf(bm25Rank)
 *
 * Where:
 *   rrf(rank) = 1 / (k + rank)
 *
 * Documents appearing in both result sets get scores from both, giving them
 * a natural boost over documents appearing in only one result set.
 *
 * @param vectorResults - Results from vector similarity search
 * @param bm25Results - Results from BM25 keyword search
 * @param alpha - Weight for vector results (0 = pure BM25, 1 = pure vector, 0.5 = balanced)
 * @param similarityTopK - Number of results to return
 * @returns Combined results sorted by RRF score
 *
 * @example
 * ```typescript
 * const hybridResults = combineResults(
 *   vectorSearchResults,
 *   bm25SearchResults,
 *   0.5,  // Equal weight to both
 *   10    // Return top 10
 * );
 * ```
 */
export function combineResults(
  vectorResults: VectorStoreQueryResult,
  bm25Results: VectorStoreQueryResult,
  alpha: number,
  similarityTopK: number,
): VectorStoreQueryResult {
  const combinedScores: Record<
    string,
    { score: number; node: BaseNode; id: string }
  > = {};

  // Process vector results - rank is 1-indexed
  vectorResults.ids.forEach((id, i) => {
    const rank = i + 1; // 1-indexed rank
    const node = vectorResults.nodes?.[i];
    if (node) {
      combinedScores[id] = {
        score: rrfScore(rank) * alpha,
        node: node,
        id,
      };
    }
  });

  // Process BM25 results - rank is 1-indexed
  bm25Results.ids.forEach((id, i) => {
    const rank = i + 1; // 1-indexed rank
    const node = bm25Results.nodes?.[i];
    const existing = combinedScores[id];
    if (existing) {
      // Document appears in both result sets - add BM25 contribution
      existing.score += rrfScore(rank) * (1 - alpha);
    } else if (node) {
      // Document only in BM25 results
      combinedScores[id] = {
        score: rrfScore(rank) * (1 - alpha),
        node: node,
        id,
      };
    }
  });

  const sortedResults = Object.values(combinedScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, similarityTopK);

  return {
    ids: sortedResults.map((r) => r.id),
    similarities: sortedResults.map((r) => r.score),
    nodes: sortedResults.map((r) => r.node),
  };
}
