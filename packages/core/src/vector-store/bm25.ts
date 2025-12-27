import type { BaseNode } from "../schema/index.js";
import { MetadataMode } from "../schema/index.js";

/**
 * A simple BM25 (Best Matching 25) implementation for in-memory search.
 *
 * BM25 is a bag-of-words retrieval function that ranks documents based on
 * the query terms appearing in each document. It's an improvement over TF-IDF
 * that includes document length normalization.
 *
 * Key parameters:
 * - k1 (default 1.5): Controls term frequency saturation. Higher values
 *   give more weight to term frequency.
 * - b (default 0.75): Controls document length normalization. 0 = no
 *   normalization, 1 = full normalization.
 *
 * @example
 * ```typescript
 * const bm25 = new BM25(documents);
 * const results = bm25.search("search query", 10);
 * // Returns top 10 documents with their BM25 scores
 * ```
 */
export class BM25 {
  private k1: number;
  private b: number;
  private avgdl: number = 0;
  private docCount: number = 0;
  private docLengths: Record<string, number> = {};
  private termFreqs: Record<string, Record<string, number>> = {};
  private docFreqs: Record<string, number> = {};

  /**
   * Creates a new BM25 index from the given nodes.
   *
   * @param nodes - Array of nodes to index
   * @param options - Optional BM25 parameters
   * @param options.k1 - Term frequency saturation parameter (default: 1.5)
   * @param options.b - Document length normalization parameter (default: 0.75)
   */
  constructor(nodes: BaseNode[], options?: { k1?: number; b?: number }) {
    this.k1 = options?.k1 ?? 1.5;
    this.b = options?.b ?? 0.75;
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

  /**
   * Tokenizes text into lowercase words, removing non-word characters.
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(Boolean);
  }

  /**
   * Calculates the IDF (Inverse Document Frequency) for a term.
   *
   * Uses the Robertson-Sparck Jones formula:
   * IDF = log((N - df + 0.5) / (df + 0.5) + 1)
   *
   * @param term - The term to calculate IDF for
   * @returns The IDF score
   */
  private idf(term: string): number {
    const df = this.docFreqs[term] ?? 0;
    return Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Searches the index for documents matching the query.
   *
   * @param query - The search query string
   * @param topK - Maximum number of results to return
   * @returns Array of document IDs with their BM25 scores, sorted by score descending
   */
  search(query: string, topK: number): { id: string; score: number }[] {
    const queryTokens = this.tokenize(query);
    const scores: { id: string; score: number }[] = [];

    for (const docId in this.termFreqs) {
      let score = 0;
      const docTermFreqs = this.termFreqs[docId];
      if (!docTermFreqs) continue;

      for (const token of queryTokens) {
        if (!this.docFreqs[token]) continue;

        const idf = this.idf(token);
        const tf = docTermFreqs[token] ?? 0;
        const docLength = this.docLengths[docId] ?? 0;

        // BM25 scoring formula
        const numerator = tf * (this.k1 + 1);
        const denominator =
          tf + this.k1 * (1 - this.b + (this.b * docLength) / this.avgdl);
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({ id: docId, score });
      }
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Returns the number of documents in the index.
   */
  getDocumentCount(): number {
    return this.docCount;
  }

  /**
   * Returns the average document length in the index.
   */
  getAverageDocumentLength(): number {
    return this.avgdl;
  }
}
