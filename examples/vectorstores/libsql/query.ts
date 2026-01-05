import { VectorStoreIndex } from "@vectorstores/core";
import { LibSQLVectorStore } from "@vectorstores/libsql";
import { getOpenAIEmbedding } from "../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../shared/utils/format-response";

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const vectorStore = new LibSQLVectorStore({
      clientConfig: {
        url: process.env.LIBSQL_URL ?? ":memory:",
        authToken: process.env.LIBSQL_AUTH_TOKEN,
      },
    });
    // Optional - set your collection name, default is no filter on this field.
    // vectorStore.setCollection("my-collection");

    const index = await VectorStoreIndex.fromVectorStore(vectorStore, {
      text: getOpenAIEmbedding(),
    });

    // Create retriever
    const retriever = index.asRetriever();

    let question = "";
    while (!isQuit(question)) {
      question = await getUserInput(readline);

      if (isQuit(question)) {
        readline.close();
        process.exit(0);
      }

      try {
        const response = await retriever.retrieve({ query: question });
        console.log(formatRetrieverResponse(response));
      } catch (error) {
        console.error("Error:", error);
      }
    }
  } catch (err) {
    console.error(err);
    console.log(
      "If your LibSQLVectorStore init failed, make sure to set LIBSQL_URL and LIBSQL_AUTH_TOKEN env vars.",
    );
    process.exit(1);
  }
}

function isQuit(question: string) {
  return ["q", "quit", "exit"].includes(question.trim().toLowerCase());
}

// Function to get user input as a promise
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserInput(readline: any): Promise<string> {
  return new Promise((resolve) => {
    readline.question(
      "What would you like to know?\n>",
      (userInput: string) => {
        resolve(userInput);
      },
    );
  });
}

main()
  .catch(console.error)
  .finally(() => {
    process.exit(1);
  });
