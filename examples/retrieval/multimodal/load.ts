import { VectorStoreIndex } from "@vectorstores/core";
import { SimpleDirectoryReader } from "@vectorstores/readers/directory";
import path from "path";
import { getEmbeddings } from "./embeddings";

async function main() {
  console.time(`Generate storage`);
  // Split documents, create embeddings and store them in the vector stores
  const documents = await new SimpleDirectoryReader().loadData({
    directoryPath: path.join("shared", "data", "multimodal"),
  });
  await VectorStoreIndex.fromDocuments(documents, {
    persistDir: "storage",
    embeddings: getEmbeddings(),
  });
  console.timeEnd(`Generate storage`);
}

main().catch(console.error);
