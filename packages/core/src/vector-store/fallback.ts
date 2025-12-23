import { MetadataMode } from "../index.js";
import { type BaseNode } from "../schema/index.js";
import {
  VectorStoreQueryMode,
  type VectorStoreQuery,
  type VectorStoreQueryResult,
} from "./index.js";

/**
 * A simple BM25 implementation for in-memory search.
 */
export class BM25 {
  private k1: number = 1.5;
  private b: number = 0.75;
  private avgdl: number = 0;
  private docCount: number = 0;
  private docLengths: Record<string, number> = {};
  private termFreqs: Record<string, Record<string, number>> = {};
  private docFreqs: Record<string, number> = {};

  constructor(nodes: BaseNode[]) {
    this.docCount = nodes.length;
    let totalLength = 0;

    for (const node of nodes) {
      const text = node.getContent(MetadataMode.NONE);
      const tokens = this.tokenize(text);
      const length = tokens.length;
      this.docLengths[node.id_] = length;
      totalLength += length;

      const freqs: Record<string, number> = {};
      for (const token of tokens) {
        freqs[token] = (freqs[token] || 0) + 1;
      }
      this.termFreqs[node.id_] = freqs;

      for (const token in freqs) {
        this.docFreqs[token] = (this.docFreqs[token] || 0) + 1;
      }
    }

    this.avgdl = totalLength / (this.docCount || 1);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(Boolean);
  }

  search(query: string, topK: number): { id: string; score: number }[] {
    const queryTokens = this.tokenize(query);
    const scores: { id: string; score: number }[] = [];

    for (const docId in this.termFreqs) {
      let score = 0;
      const docTermFreqs = this.termFreqs[docId];
      if (!docTermFreqs) continue;

      for (const token of queryTokens) {
        const docTermFreqs = this.termFreqs[docId];
        if (!docTermFreqs || !this.docFreqs[token]) continue;

        const idf = Math.log(
          (this.docCount - (this.docFreqs[token] ?? 0) + 0.5) /
            ((this.docFreqs[token] ?? 0) + 0.5) +
            1,
        );
        const tf = docTermFreqs[token] ?? 0;
        const numerator = tf * (this.k1 + 1);
        const docLength = this.docLengths[docId] ?? 0;
        const denominator =
          tf +
          this.k1 * (1 - this.b + (this.b * docLength) / this.avgdl);
        score += idf * (numerator / denominator);
      }
      if (score > 0) {
        scores.push({ id: docId, score });
      }
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

/**
 * Combines vector search results and BM25 results.
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

  // Normalize vector similarities to [0, 1] if they aren't already
  const vSimilarities = vectorResults.similarities;
  const maxVectorSim = vSimilarities.length > 0 ? Math.max(...vSimilarities) : 0;
  const minVectorSim = vSimilarities.length > 0 ? Math.min(...vSimilarities) : 0;
  const vectorRange = maxVectorSim - minVectorSim || 1;

  vectorResults.ids.forEach((id, i) => {
    const sim = vSimilarities[i] ?? 0;
    const normSim = (sim - minVectorSim) / vectorRange;
    const node = vectorResults.nodes?.[i];
    if (node) {
      combinedScores[id] = {
        score: normSim * alpha,
        node: node,
        id,
      };
    }
  });

  // Normalize BM25 scores to [0, 1]
  const bSimilarities = bm25Results.similarities;
  const maxBm25Score =
    bSimilarities.length > 0 ? Math.max(...bSimilarities) : 0;
  const minBm25Score =
    bSimilarities.length > 0 ? Math.min(...bSimilarities) : 0;
  const bm25Range = maxBm25Score - minBm25Score || 1;

  bm25Results.ids.forEach((id, i) => {
    const score = bSimilarities[i] ?? 0;
    const normScore = (score - minBm25Score) / bm25Range;
    const node = bm25Results.nodes?.[i];
    const existing = combinedScores[id];
    if (existing) {
      existing.score += normScore * (1 - alpha);
    } else if (node) {
      combinedScores[id] = {
        score: normScore * (1 - alpha),
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
