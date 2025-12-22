import "dotenv/config";

import {
  AzureCosmosDBNoSqlVectorStore,
  AzureCosmosNoSqlDocumentStore,
} from "@vectorstores/azure";
import {
  Document,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";

import { useOpenAIEmbedding } from "../../shared/utils/embedding";

/**
 * This example demonstrates how to use Azure CosmosDB with vectorstores.
 * It uses Azure CosmosDB as DocumentStore and VectorStore.
 *
 * To run this example, create an .env file under /examples and set the following environment variables:
 *
 * OPENAI_API_KEY= // OpenAI API key for embeddings.
 * AZURE_COSMOSDB_NOSQL_ACCOUNT_ENDPOINT = "https://DB-ACCOUNT.documents.azure.com:443/" // Sample CosmosDB account endpoint.
 *
 * This example uses managed identity to authenticate with Azure CosmosDB. Make sure to assign the required roles to the managed identity.
 * You can also use connectionString for Azure CosmosDB for authentication.
 */
(async () => {
  // Use OpenAI embeddings
  useOpenAIEmbedding();

  const docStore = AzureCosmosNoSqlDocumentStore.fromAadToken();
  console.log({ docStore });
  const vectorStore = AzureCosmosDBNoSqlVectorStore.fromUriAndManagedIdentity();
  console.log({ vectorStore });
  const storageContext = await storageContextFromDefaults({
    docStore,
    vectorStore,
  });
  console.log({ storageContext });

  const document = new Document({ text: "Test Text" });
  const index = await VectorStoreIndex.fromDocuments([document], {
    storageContext,
    logProgress: true,
  });

  console.log({ index });
})();
