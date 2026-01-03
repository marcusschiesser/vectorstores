import { AstraDBVectorStore } from "@vectorstores/astra";
import {
  Document,
  type MetadataFilters,
  VectorStoreIndex,
} from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

const collectionName = "test_collection";

async function main() {
  try {
    const docs = [
      new Document({
        text: "AstraDB is built on Apache Cassandra",
        metadata: {
          id: 123,
          foo: "bar",
        },
      }),
      new Document({
        text: "AstraDB is a NoSQL DB",
        metadata: {
          id: 456,
          foo: "baz",
        },
      }),
      new Document({
        text: "AstraDB supports vector search",
        metadata: {
          id: 789,
          foo: "qux",
        },
      }),
    ];

    const astraVS = new AstraDBVectorStore();
    await astraVS.createAndConnect(collectionName, {
      vector: { dimension: 1536, metric: "cosine" },
    });

    const index = await VectorStoreIndex.fromDocuments(docs, {
      vectorStore: astraVS,
    });
    const filters: MetadataFilters = {
      filters: [{ key: "id", operator: "in", value: [123, 789] }],
    }; // try changing the filters to see the different results
    const retriever = index.asRetriever({ filters });
    const response = await retriever.retrieve({
      query: "Describe AstraDB.",
    });

    console.log(formatRetrieverResponse(response));
  } catch (e) {
    console.error(e);
  }
}

void main();
