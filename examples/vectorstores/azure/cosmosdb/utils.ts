import { TokenCredential } from "@azure/identity";
import {
  AzureCosmosDBNoSQLConfig,
  AzureCosmosDBNoSqlVectorStore,
  AzureCosmosNoSqlDocumentStore,
} from "@vectorstores/azure";

/**
 * Util function to create AzureCosmosDB vectorStore and docStore from connection string.
 */
export const createStoresFromConnectionString = (
  connectionString: string,
  dbConfig: AzureCosmosDBNoSQLConfig,
) => {
  const vectorStore = AzureCosmosDBNoSqlVectorStore.fromConnectionString({
    connectionString,
    ...dbConfig,
  });
  const docStore = AzureCosmosNoSqlDocumentStore.fromConnectionString({
    connectionString,
  });
  return { vectorStore, docStore };
};

/**
 * Util function to create AzureCosmosDB vectorStore and docStore from managed identity.
 */
export const createStoresFromManagedIdentity = (
  endpoint: string,
  credential: TokenCredential,
  dbConfig: AzureCosmosDBNoSQLConfig,
) => {
  const vectorStore = AzureCosmosDBNoSqlVectorStore.fromUriAndManagedIdentity({
    endpoint,
    credential,
    ...dbConfig,
  });
  const docStore = AzureCosmosNoSqlDocumentStore.fromAadToken({
    endpoint,
    credential,
  });
  return { vectorStore, docStore };
};
