import { VectorStoreIndex } from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";
import { getEmbeddings } from "./embeddings";

async function main() {
  // retrieve documents using the index
  const index = await VectorStoreIndex.init({
    persistDir: "storage",
    embeddings: getEmbeddings(),
  });
  const retriever = index.asRetriever({
    topK: { text: 1, image: 2 },
  });
  const results = await retriever.retrieve(
    "what are Vincent van Gogh's famous paintings",
  );

  console.log(formatRetrieverResponse(results));
}

main().catch(console.error);
