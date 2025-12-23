import { ChromaVectorStore } from "@vectorstores/chroma";
import {
  Document,
  MetadataFilters,
  VectorStoreIndex,
} from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

const collectionName = "dogs_with_color";

async function main() {
  try {
    const chromaVS = new ChromaVectorStore({ collectionName });
    const index = await VectorStoreIndex.fromVectorStore(chromaVS);

    const queryFn = async (filters?: MetadataFilters) => {
      console.log("\nQuerying dogs by filters: ", JSON.stringify(filters));
      const query = "List all colors of dogs";
      const retriever = index.asRetriever({
        filters,
        similarityTopK: 3,
      });
      const response = await retriever.retrieve({ query });
      console.log(formatRetrieverResponse(response));
    };

    await queryFn(); // red, brown, yellow
    await queryFn({ filters: [{ key: "dogId", value: "1", operator: "==" }] }); // brown
    await queryFn({ filters: [{ key: "dogId", value: "1", operator: "!=" }] }); // red, yellow
    await queryFn({
      filters: [
        { key: "dogId", value: "1", operator: "==" },
        { key: "dogId", value: "3", operator: "==" },
      ],
      condition: "or",
    }); // brown, yellow
    await queryFn({
      filters: [{ key: "dogId", value: ["1", "2"], operator: "in" }],
    }); // red, brown
  } catch (e) {
    console.error(e);
  }
}

async function generate() {
  const docs = [
    new Document({
      id_: "doc1",
      text: "The dog is brown",
      metadata: {
        dogId: "1",
      },
    }),
    new Document({
      id_: "doc2",
      text: "The dog is red",
      metadata: {
        dogId: "2",
      },
    }),
    new Document({
      id_: "doc3",
      text: "The dog is yellow",
      metadata: {
        dogId: "3",
      },
    }),
  ];

  console.log("Creating ChromaDB vector store");
  const chromaVS = new ChromaVectorStore({ collectionName });

  console.log("Embedding documents and adding to index");
  await VectorStoreIndex.fromDocuments(docs, {
    vectorStore: chromaVS,
  });
}

(async () => {
  await generate();
  await main();
})();
