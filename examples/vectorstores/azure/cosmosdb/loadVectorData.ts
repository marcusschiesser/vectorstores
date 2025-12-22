import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import {
  type AzureCosmosDBNoSQLConfig,
  SimpleCosmosDBReader,
  type SimpleCosmosDBReaderLoaderConfig,
} from "@vectorstores/azure";
import {
  storageContextFromDefaults,
  VectorStoreIndex,
} from "@vectorstores/core";
import * as dotenv from "dotenv";

import { useOpenAIEmbedding } from "../../../shared/utils/embedding";
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
const collectionName =
  process.env.AZURE_COSMOSDB_CONTAINER_NAME || "shortStoriesContainer";
const vectorCollectionName =
  process.env.AZURE_COSMOSDB_VECTOR_CONTAINER_NAME || "vectorContainer";

// Initialize the CosmosDB client
async function initializeCosmosClient() {
  if (cosmosConnectionString) {
    return new CosmosClient(cosmosConnectionString);
  } else {
    const credential = new DefaultAzureCredential();
    return new CosmosClient({
      endpoint: cosmosEndpoint,
      aadCredentials: credential,
    });
  }
}

// Initialize CosmosDB to be used as a vectorStore
async function initializeStores() {
  // Create a configuration object for the Azure CosmosDB NoSQL Vector Store
  const dbConfig: AzureCosmosDBNoSQLConfig = {
    databaseName,
    containerName: vectorCollectionName,
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

async function loadVectorData() {
  // Use OpenAI embeddings
  useOpenAIEmbedding();

  if (!cosmosConnectionString && !cosmosEndpoint) {
    throw new Error(
      "Azure CosmosDB connection string or endpoint must be set.",
    );
  }
  const cosmosClient = await initializeCosmosClient();
  const reader = new SimpleCosmosDBReader(cosmosClient);
  // create a configuration object for the reader
  const simpleCosmosReaderConfig: SimpleCosmosDBReaderLoaderConfig = {
    databaseName,
    containerName: collectionName,
    fields: ["text"],
    query: "SELECT c.id, c.text as text, c.metadata as metadata FROM c",
    metadataFields: ["metadata"],
  };

  // load objects from cosmos and convert them into Document objects
  const documents = await reader.loadData(simpleCosmosReaderConfig);

  // use Azure CosmosDB as a vectorStore
  const { vectorStore } = await initializeStores();
  // Store the embeddings in the CosmosDB container
  const storageContext = await storageContextFromDefaults({
    vectorStore,
  });
  await VectorStoreIndex.fromDocuments(documents, { storageContext });
  console.log(
    `Successfully created embeddings in the CosmosDB container ${vectorCollectionName}.`,
  );
}

loadVectorData().catch(console.error);
