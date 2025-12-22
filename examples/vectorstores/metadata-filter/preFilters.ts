import {
  Document,
  MetadataFilters,
  Settings,
  VectorStoreIndex,
  storageContextFromDefaults,
} from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

async function getDataSource() {
  const docs = [
    new Document({ text: "The dog is brown", metadata: { dogId: "1" } }),
    new Document({ text: "The dog is yellow", metadata: { dogId: "2" } }),
  ];
  const storageContext = await storageContextFromDefaults({
    persistDir: "./cache",
  });

  return await VectorStoreIndex.fromDocuments(docs, { storageContext });
}

Settings.callbackManager.on("retrieve-end", (event) => {
  const { nodes, query } = event.detail;
  console.log(`${query.query} - Number of retrieved nodes:`, nodes.length);
});

async function main() {
  const index = await getDataSource();
  const filters: MetadataFilters = {
    filters: [{ key: "dogId", value: "2", operator: "==" }],
  };

  const retriever = index.asRetriever({ similarityTopK: 3, filters });

  console.log("Retriever should only retrieve 1 node:");
  const response = await retriever.retrieve({ query: "Retriever: get dog" });
  console.log(formatRetrieverResponse(response));
}

void main();
