import { VectorStoreIndex } from "@vectorstores/core";
import { formatRetrieverResponse } from "../../shared/utils/format-response";
import { getEmbeddings, getVectorStores } from "./storage";

async function main() {
  // retrieve documents using the index
  const vectorStores = await getVectorStores();
  const index = await VectorStoreIndex.init({
    vectorStores,
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
