import { cohere } from "@ai-sdk/cohere";
import { openai } from "@ai-sdk/openai";
import { Document, MetadataMode, VectorStoreIndex } from "@vectorstores/core";
import { vercelEmbedding } from "@vectorstores/vercel";
import { rerank } from "ai";
import essay from "../shared/data/essay";
import { formatRetrieverResponse } from "../shared/utils/format-response";

async function main() {
  const document = new Document({ text: essay });

  const index = await VectorStoreIndex.fromDocuments([document], {
    embedFunc: vercelEmbedding(openai.embedding("text-embedding-3-small")),
  });
  console.log("Successfully created index");

  const retriever = index.asRetriever({
    similarityTopK: 5,
  });

  const query = "What did the author do growing up?";

  // Retrieve nodes
  const nodes = await retriever.retrieve({
    query,
  });

  // Rerank using Vercel AI SDK
  const { ranking } = await rerank({
    model: cohere.reranking("rerank-v3.5"),
    query,
    documents: nodes.map((n) => n.node.getContent(MetadataMode.ALL)),
    topN: 2,
  });

  // Map reranked results back to NodeWithScore format
  const rerankedNodes = ranking.map((r) => ({
    node: nodes[r.originalIndex].node,
    score: r.score,
  }));

  // Show original results
  console.log("\nWithout Cohere reranking:");
  console.log(formatRetrieverResponse(nodes));

  // Show reranked results
  console.log("With Cohere reranking:");
  console.log(formatRetrieverResponse(rerankedNodes));
}

main().catch(console.error);
