import { Document, Settings, VectorStoreIndex } from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

Settings.callbackManager.on("retrieve-end", (event) => {
  const { nodes } = event.detail;
  console.log("Number of retrieved nodes:", nodes.length);
});

async function getDataSource() {
  const docs = [
    new Document({
      text: "The dog is brown",
      metadata: {
        dogId: "1",
        private: true,
      },
    }),
    new Document({
      text: "The dog is yellow",
      metadata: {
        dogId: "2",
        private: false,
      },
    }),
    new Document({
      text: "The dog is red",
      metadata: {
        dogId: "3",
        private: false,
      },
    }),
  ];

  return await VectorStoreIndex.fromDocuments(docs, {
    persistDir: "./cache",
  });
}

async function main() {
  const index = await getDataSource();
  console.log(
    "=============\nQuerying index with no filters. The output should be any color.",
  );
  const retrieverNoFilters = index.asRetriever({
    similarityTopK: 3,
  });
  const noFilterResponse = await retrieverNoFilters.retrieve({
    query: "What is the color of the dog?",
  });
  console.log("No filter response:");
  console.log(formatRetrieverResponse(noFilterResponse));

  console.log(
    "\n=============\nQuerying index with dogId 2 and private false. The output always should be red.",
  );
  const retrieverEQ = index.asRetriever({
    filters: {
      filters: [
        {
          key: "private",
          value: "false",
          operator: "==",
        },
        {
          key: "dogId",
          value: "3",
          operator: "==",
        },
      ],
    },
    similarityTopK: 3,
  });
  const responseEQ = await retrieverEQ.retrieve({
    query: "What is the color of the dog?",
  });
  console.log("Filter with dogId 2 response:");
  console.log(formatRetrieverResponse(responseEQ));

  console.log(
    "\n=============\nQuerying index with dogId IN (1, 3). The output should be brown and red.",
  );
  const retrieverIN = index.asRetriever({
    filters: {
      filters: [
        {
          key: "dogId",
          value: ["1", "3"],
          operator: "in",
        },
      ],
    },
    similarityTopK: 3,
  });
  const responseIN = await retrieverIN.retrieve({
    query: "What is the color of the dog?",
  });
  console.log("Filter with dogId IN (1, 3) response:");
  console.log(formatRetrieverResponse(responseIN));

  console.log(
    "\n=============\nQuerying index with dogId IN (1, 3). The output should be any.",
  );
  const retrieverOR = index.asRetriever({
    filters: {
      filters: [
        {
          key: "private",
          value: "false",
          operator: "==",
        },
        {
          key: "dogId",
          value: ["1", "3"],
          operator: "in",
        },
      ],
      condition: "or",
    },
    similarityTopK: 3,
  });
  const responseOR = await retrieverOR.retrieve({
    query: "What is the color of the dog?",
  });
  console.log("Filter with dogId with OR operator response:");
  console.log(formatRetrieverResponse(responseOR));
}

void main();
