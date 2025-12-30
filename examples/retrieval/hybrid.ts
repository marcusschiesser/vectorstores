/**
 * Hybrid Search Example
 *
 * Demonstrates how hybrid search combines the strengths of vector and BM25:
 * - Vector finds semantic matches (synonyms, concepts)
 * - BM25 finds exact keyword matches
 * - Hybrid boosts documents that appear in BOTH result sets
 */
import {
  Document,
  SimpleVectorStore,
  VectorStoreIndex,
} from "@vectorstores/core";
import { getOpenAIEmbedding } from "../shared/utils/embedding";
import { formatRetrieverResponse } from "../shared/utils/format-response";

// Documents designed to show hybrid's advantage:
// - Doc A: Has keyword "429" but less semantic relevance to retry
// - Doc B: Semantically about retry/backoff but no "429" keyword
// - Doc C: Has BOTH "429" keyword AND retry semantics → hybrid winner!
// - Doc D: Unrelated document
const documents = [
  new Document({ text: "The server returns HTTP 429 when rate limited." }),
  new Document({ text: "Implement retry logic with exponential backoff." }),
  new Document({ text: "Handle 429 errors by retrying with backoff." }),
  new Document({ text: "Database connections use connection pooling." }),
];

async function main() {
  const embedFunc = getOpenAIEmbedding();
  const vectorStore = new SimpleVectorStore();
  const index = await VectorStoreIndex.fromDocuments(documents, {
    vectorStore,
    embedFunc,
  });

  // Query with both a keyword ("429") and semantic meaning ("retry")
  const query = "429 retry";

  console.log(`Query: "${query}"\n`);
  console.log("Hybrid matches both keyword AND semantics.\n");

  // Vector search - scores by cosine similarity (0-1)
  console.log("🧠 Vector Search (cosine similarity score, 0-100%):");
  const vectorResults = await index
    .asRetriever({ similarityTopK: 3 })
    .retrieve(query);
  console.log(formatRetrieverResponse(vectorResults));

  // BM25 search - scores by TF-IDF (unbounded, can exceed 100%)
  console.log("📝 BM25 Search (TF-IDF score, unbounded):");
  const bm25Results = await index
    .asRetriever({ mode: "bm25", similarityTopK: 3 })
    .retrieve(query);
  console.log(formatRetrieverResponse(bm25Results));

  // Hybrid search - scores by RRF rank position: 1/(60+rank)
  console.log("⚡ Hybrid Search (RRF score, ~1.6% for rank 1):");
  const hybridResults = await index
    .asRetriever({ mode: "hybrid", similarityTopK: 3, alpha: 0.5 })
    .retrieve(query);
  console.log(formatRetrieverResponse(hybridResults));
}

main().catch(console.error);
