import { ChromaVectorStore } from "@vectorstores/chroma";
import { VectorStoreIndex } from "@vectorstores/core";
import { CSVReader } from "@vectorstores/readers/csv";
import { fileURLToPath } from "node:url";
import { useOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";
import { ensureOpenAIKey } from "../../shared/utils/runtime";

const collectionName = "movie_reviews";

async function main() {
  if (!ensureOpenAIKey()) return;
  useOpenAIEmbedding();

  const sourceFile: string = fileURLToPath(
    new URL("../../shared/data/movie_reviews.csv", import.meta.url),
  );

  try {
    console.log(`Loading data from ${sourceFile}`);
    const reader = new CSVReader(false, ", ", "\n");
    const docs = await reader.loadData(sourceFile);

    console.log("Creating ChromaDB vector store");
    const chromaVS = new ChromaVectorStore({ collectionName });

    console.log("Embedding documents and adding to index");
    const index = await VectorStoreIndex.fromDocuments(docs, {
      vectorStore: chromaVS,
    });

    console.log("Querying index");
    const retriever = index.asRetriever();
    const response = await retriever.retrieve({
      query: "Tell me about Godfrey Cheshire's rating of La Sapienza.",
    });
    console.log(formatRetrieverResponse(response));
  } catch (e) {
    console.error(e);
  }
}

void main();
