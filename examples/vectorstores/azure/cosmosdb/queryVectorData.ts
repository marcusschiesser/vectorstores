import { DefaultAzureCredential } from "@azure/identity";
import { AzureCosmosDBNoSQLConfig } from "@vectorstores/azure";
import {
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";
import * as dotenv from "dotenv";

import { useOpenAIEmbedding } from "../../../shared/utils/embedding";
import { formatRetrieverResponse } from "../../../shared/utils/format-response";
import {
  createStoresFromConnectionString,
  createStoresFromManagedIdentity,
} from "./utils";

// Load environment variables from local .env file
dotenv.config();

const cosmosEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ACCOUNT_ENDPOINT!;
const cosmosConnectionString =
  process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING!;
const databaseName =
  process.env.AZURE_COSMOSDB_DATABASE_NAME || "shortStoriesDatabase";
const containerName =
  process.env.AZURE_COSMOSDB_VECTOR_CONTAINER_NAME || "vectorContainer";

async function initializeStores() {
  // Create a configuration object for the Azure CosmosDB NoSQL Vector Store
  const dbConfig: AzureCosmosDBNoSQLConfig = {
    databaseName,
    containerName,
    flatMetadata: false,
  };

  if (cosmosConnectionString) {
    return createStoresFromConnectionString(cosmosConnectionString, dbConfig);
  } else {
    // Use managed identity to authenticate with Azure CosmosDB
    const credential = new DefaultAzureCredential();
    return createStoresFromManagedIdentity(
      cosmosEndpoint,
      credential,
      dbConfig,
    );
  }
}

async function query() {
  // Use OpenAI embeddings
  useOpenAIEmbedding();

  if (!cosmosConnectionString && !cosmosEndpoint) {
    throw new Error(
      "Azure CosmosDB connection string or endpoint must be set.",
    );
  }

  // use Azure CosmosDB as a vectorStore and docStore
  const { vectorStore, docStore } = await initializeStores();

  // Store the embeddings in the CosmosDB container
  const storageContext = await storageContextFromDefaults({
    vectorStore,
    docStore,
  });

  // create an index from the Azure CosmosDB NoSQL Vector Store
  const index = await VectorStoreIndex.init({ storageContext });

  // create a retriever from the index
  const retriever = index.asRetriever({ similarityTopK: 20 });

  const result = await retriever.retrieve({
    query: "Who all jog?", // Cosmo, Ludo, Maud, Hale, Constance, Garrison, Fergus, Rafe, Waverly, Rex, Loveday
  });
  console.log(formatRetrieverResponse(result));
}

void query();
