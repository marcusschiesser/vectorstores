import {
  Document,
  MetadataMode,
  SimpleVectorStore,
  VectorStoreQueryMode,
} from "@vectorstores/core";

async function main() {
  const vectorStore = new SimpleVectorStore();

  const nodes = [
    new Document({
      text: "The cat is on the mat.",
      id_: "1",
    }),
    new Document({
      text: "The dog is in the house.",
      id_: "2",
    }),
    new Document({
      text: "The bird is in the sky.",
      id_: "3",
    }),
  ];

  // For SimpleVectorStore, we need to provide embeddings for vector search
  // In a real scenario, you'd use an embedding model
  nodes[0].embedding = [1, 0, 0];
  nodes[1].embedding = [0, 1, 0];
  nodes[2].embedding = [0, 0, 1];

  await vectorStore.add(nodes);

  console.log("BM25 Search for 'dog':");
  const bm25Result = await vectorStore.query({
    queryStr: "dog",
    similarityTopK: 2,
    mode: VectorStoreQueryMode.BM25,
  });

  bm25Result.nodes?.forEach((node, i) => {
    console.log(
      `ID: ${node.id_}, Score: ${bm25Result.similarities[i].toFixed(4)}, Text: ${node.getContent(MetadataMode.NONE)}`,
    );
  });

  console.log("\nHybrid Search for 'bird' with vector [0, 0, 1]:");
  const hybridResult = await vectorStore.query({
    queryStr: "bird",
    queryEmbedding: [0, 0, 1],
    similarityTopK: 2,
    mode: VectorStoreQueryMode.HYBRID,
    alpha: 0.5,
  });

  hybridResult.nodes?.forEach((node, i) => {
    console.log(
      `ID: ${node.id_}, Score: ${hybridResult.similarities[i].toFixed(4)}, Text: ${node.getContent(MetadataMode.NONE)}`,
    );
  });
}

main().catch(console.error);
