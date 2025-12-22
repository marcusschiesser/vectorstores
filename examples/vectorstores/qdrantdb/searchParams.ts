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

dotenv.config();

const collectionName = "dog_colors";
const qdrantUrl = "http://127.0.0.1:6333";

async function main() {
  try {
    const vectorStore = new QdrantVectorStore({
      url: qdrantUrl,
      collectionName,
    });

    const docs = [
      new Document({
        text: "The dog is brown",
      }),
    ];

    const index = await VectorStoreIndex.fromDocuments(docs, {
      vectorStore,
    });

    const retriever = index.asRetriever();
    const response = await retriever.retrieve({
      query: "What is the color of the dog?",
    });
    console.log(formatRetrieverResponse(response));
  } catch (error) {
    console.error(error);
  }
}

void main();
