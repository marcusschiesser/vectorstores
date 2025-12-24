import {
  Document,
  MetadataMode,
  SimpleVectorStore,
  VectorStoreIndex,
  VectorStoreQueryMode,
  type TextEmbedFunc,
} from "@vectorstores/core";

const embedFunc: TextEmbedFunc = async (texts: string[]) => {
  return texts.map((text) => {
    const normalized = text.toLowerCase();
    return [
      normalized.includes("cat") ? 1 : 0,
      normalized.includes("dog") ? 1 : 0,
      normalized.includes("bird") ? 1 : 0,
    ];
  });
};

async function main() {
  const vectorStore = new SimpleVectorStore({ embedFunc });
  const index = await VectorStoreIndex.init({ vectorStore, embedFunc });

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

  await index.insertNodes(nodes);

  console.log("BM25 Search for 'dog':");
  const bm25Retriever = index.asRetriever({
    mode: VectorStoreQueryMode.BM25,
    similarityTopK: 2,
  });
  const bm25Result = await bm25Retriever.retrieve("dog");

  bm25Result.forEach((nodeWithScore) => {
    const node = nodeWithScore.node;
    console.log(
      `ID: ${node.id_}, Score: ${nodeWithScore.score.toFixed(4)}, Text: ${node.getContent(MetadataMode.NONE)}`,
    );
  });

  console.log("\nHybrid Search for 'bird' with vector [0, 0, 1]:");
  const hybridRetriever = index.asRetriever({
    mode: VectorStoreQueryMode.HYBRID,
    similarityTopK: 2,
    alpha: 0.5,
  });
  const hybridResult = await hybridRetriever.retrieve("bird");

  hybridResult.forEach((nodeWithScore) => {
    const node = nodeWithScore.node;
    console.log(
      `ID: ${node.id_}, Score: ${nodeWithScore.score.toFixed(4)}, Text: ${node.getContent(MetadataMode.NONE)}`,
    );
  });
}

main().catch(console.error);
