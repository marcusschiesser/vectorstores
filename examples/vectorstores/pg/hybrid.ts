import {
  Document,
  MetadataMode,
  VectorStoreQueryMode,
} from "@vectorstores/core";
import { PGVectorStore } from "@vectorstores/postgres";

async function main() {
  const vectorStore = new PGVectorStore({
    clientConfig: {
      connectionString: process.env.POSTGRES_URL,
    },
    schemaName: "public",
    tableName: "hybrid_test",
    dimensions: 3,
  });

  const nodes = [
    new Document({
      text: "The cat is on the mat.",
      id_: "1",
      embedding: [1, 0, 0],
    }),
    new Document({
      text: "The dog is in the house.",
      id_: "2",
      embedding: [0, 1, 0],
    }),
  ];

  await vectorStore.add(nodes);

  console.log("Hybrid Search for 'dog':");
  const result = await vectorStore.query({
    queryStr: "dog",
    queryEmbedding: [0, 1, 0],
    similarityTopK: 2,
    mode: VectorStoreQueryMode.HYBRID,
    alpha: 0.5,
  });

  result.nodes?.forEach((node, i) => {
    console.log(
      `ID: ${node.id_}, Score: ${result.similarities[i].toFixed(4)}, Text: ${node.getContent(MetadataMode.NONE)}`,
    );
  });
}

main().catch(console.error);
