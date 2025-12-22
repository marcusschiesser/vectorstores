import { Document, VectorStoreIndex } from "@vectorstores/core";
import essay from "../shared/data/essay";
import { useOpenAIEmbedding } from "../shared/utils/embedding";
import { formatRetrieverResponse } from "../shared/utils/format-response";
import { ensureOpenAIKey } from "../shared/utils/runtime";

async function main() {
  if (!ensureOpenAIKey()) return;
  useOpenAIEmbedding();
  // Create Document object with essay
  const document = new Document({ text: essay, id_: "essay" });

  // Split text and create embeddings. Store them in a VectorStoreIndex
  // persist the vector store automatically with persistDir
  const index = await VectorStoreIndex.fromDocuments([document], {
    persistDir: "./storage",
  });

  // Retrieve from the index
  const retriever = index.asRetriever();
  const response = await retriever.retrieve({
    query: "What did the author do in college?",
  });

  // Output response
  console.log(formatRetrieverResponse(response));

  // load the index from persistence
  const loadedIndex = await VectorStoreIndex.init({
    persistDir: "./storage",
  });
  const loadedRetriever = loadedIndex.asRetriever();
  const loadedResponse = await loadedRetriever.retrieve({
    query: "What did the author do growing up?",
  });
  console.log(formatRetrieverResponse(loadedResponse));
}

main().catch(console.error);
