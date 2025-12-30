import { Settings, VectorStoreIndex } from "@vectorstores/core";
import { SimpleDirectoryReader } from "@vectorstores/readers/directory";
import path from "path";
import { getEmbeddings, getVectorStores } from "./storage";

// Update chunk size and overlap
Settings.chunkSize = 512;
Settings.chunkOverlap = 20;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRuntime(func: any) {
  const start = Date.now();
  await func();
  const end = Date.now();
  return end - start;
}

async function generateDatasource() {
  console.log(`Generating storage...`);
  // Split documents, create embeddings and store them in the vector stores
  const ms = await getRuntime(async () => {
    const documents = await new SimpleDirectoryReader().loadData({
      directoryPath: path.join("shared", "data", "multimodal"),
    });
    await VectorStoreIndex.fromDocuments(documents, {
      vectorStores: await getVectorStores(),
      embeddings: getEmbeddings(),
    });
  });
  console.log(`Storage successfully generated in ${ms / 1000}s.`);
}

async function main() {
  await generateDatasource();
  console.log("Finished generating storage.");
}

main().catch(console.error);
