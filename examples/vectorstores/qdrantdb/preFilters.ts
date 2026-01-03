import {
  Document,
  MetadataMode,
  type NodeWithScore,
  Settings,
  VectorStoreIndex,
} from "@vectorstores/core";
import { QdrantVectorStore } from "@vectorstores/qdrant";
import * as dotenv from "dotenv";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

// Update callback manager
Settings.callbackManager.on("retrieve-end", (event) => {
  const { nodes } = event.detail;
  console.log(
    "The retrieved nodes are:",
    nodes.map((node: NodeWithScore) => node.node.getContent(MetadataMode.NONE)),
  );
});

// Load environment variables from local .env file
dotenv.config();

const collectionName = "dog_colors";
const qdrantUrl = "http://127.0.0.1:6333";

async function main() {
  try {
    const docs = [
      new Document({
        text: "The dog is brown",
        metadata: {
          dogId: "1",
        },
      }),
      new Document({
        text: "The dog is red",
        metadata: {
          dogId: "2",
        },
      }),
      new Document({
        text: "The dog is black",
        metadata: {
          dogId: "3",
        },
      }),
    ];
    console.log("Creating QdrantDB vector store");
    const qdrantVs = new QdrantVectorStore({ url: qdrantUrl, collectionName });

    console.log("Embedding documents and adding to index");
    const index = await VectorStoreIndex.fromDocuments(docs, {
      vectorStore: qdrantVs,
    });

    console.log(
      "Querying index with no filters: Expected output: Brown probably",
    );
    const retrieverNoFilters = index.asRetriever();
    const noFilterResponse = await retrieverNoFilters.retrieve({
      query: "What is the color of the dog?",
    });
    console.log("No filter response:");
    console.log(formatRetrieverResponse(noFilterResponse));
    console.log("Querying index with dogId 2: Expected output: Red");
    const retrieverDogId2 = index.asRetriever({
      filters: {
        filters: [
          {
            key: "dogId",
            value: "2",
            operator: "==",
          },
        ],
      },
    });
    const response = await retrieverDogId2.retrieve({
      query: "What is the color of the dog?",
    });
    console.log("Filter with dogId 2 response:");
    console.log(formatRetrieverResponse(response));

    console.log("Querying index with dogId !=2: Expected output: Not red");
    const retrieverNotDogId2 = index.asRetriever({
      filters: {
        filters: [
          {
            key: "dogId",
            value: "2",
            operator: "!=",
          },
        ],
      },
    });
    const responseNotDogId2 = await retrieverNotDogId2.retrieve({
      query: "What is the color of the dog?",
    });
    console.log(formatRetrieverResponse(responseNotDogId2));

    console.log(
      "Querying index with dogId 2 or 3: Expected output: Red, Black",
    );
    const retrieverIn = index.asRetriever({
      filters: {
        filters: [
          {
            key: "dogId",
            value: ["2", "3"],
            operator: "in",
          },
        ],
      },
    });
    const responseIn = await retrieverIn.retrieve({
      query: "List all dogs",
    });
    console.log(formatRetrieverResponse(responseIn));
  } catch (e) {
    console.error(e);
  }
}

void main();
