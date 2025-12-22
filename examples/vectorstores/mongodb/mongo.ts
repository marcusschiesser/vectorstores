import { Document, VectorStoreIndex } from "@vectorstores/core";
import { SimpleMongoReader } from "@vectorstores/mongodb";
import { MongoClient } from "mongodb";

import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

async function main() {
  //Dummy test code
  const filterQuery = {};
  const limit: number = Infinity;
  const uri: string = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
  const client: MongoClient = new MongoClient(uri);

  //Where the real code starts
  const MR = new SimpleMongoReader(client);
  const documents: Document[] = await MR.loadData(
    "db",
    "collection",
    ["text"],
    "",
    filterQuery,
    limit,
  );

  //
  // Making Vector Store from documents
  //

  const index = await VectorStoreIndex.fromDocuments(documents);
  // Create retriever
  const retriever = index.asRetriever();

  const rl = readline.createInterface({ input, output });
  while (true) {
    const query = await rl.question("Query: ");

    if (!query) {
      break;
    }

    const response = await retriever.retrieve({ query });

    // Output response
    console.log(formatRetrieverResponse(response));
  }
}

void main();
