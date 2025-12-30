import {
  Document,
  IngestionPipeline,
  ModalityType,
  SentenceSplitter,
  VectorStoreIndex,
  calcEmbeddings,
} from "@vectorstores/core";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { getOpenAIEmbedding } from "../shared/utils/embedding";
import { formatRetrieverResponse } from "../shared/utils/format-response";
import { ensureOpenAIKey } from "../shared/utils/runtime";

async function main() {
  if (!ensureOpenAIKey()) return;

  // Load essay from abramov.txt in Node
  const filePath = fileURLToPath(
    new URL("../shared/data/abramov.txt", import.meta.url),
  );
  const essay = await fs.readFile(filePath, "utf-8");
  const embeddings = {
    [ModalityType.TEXT]: getOpenAIEmbedding("text-embedding-3-small"),
  };

  // Create Document object with essay
  const document = new Document({ text: essay, id_: filePath });
  const pipeline = new IngestionPipeline({
    transformations: [
      new SentenceSplitter({ chunkSize: 1024, chunkOverlap: 20 }),
      calcEmbeddings(embeddings),
    ],
  });

  console.time("Pipeline Run Time");
  const nodes = await pipeline.run({ documents: [document] });
  console.timeEnd("Pipeline Run Time");

  // initialize the VectorStoreIndex from nodes
  const index = await VectorStoreIndex.init({
    nodes,
    embeddings,
  });

  // Retrieve from the index
  const retriever = index.asRetriever();

  const response = await retriever.retrieve({
    query: "What did the author do in college?",
  });

  // Output response
  console.log(formatRetrieverResponse(response));
}

main().catch(console.error);
