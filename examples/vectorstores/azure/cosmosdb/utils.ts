import { TokenCredential } from "@azure/identity";
import {
  AzureCosmosDBNoSQLConfig,
  AzureCosmosDBNoSqlVectorStore,
} from "@vectorstores/azure";

/**
 * Util function to create AzureCosmosDB vectorStore from connection string.
 */
export const createStoresFromConnectionString = (
  connectionString: string,
  dbConfig: AzureCosmosDBNoSQLConfig,
) => {
  const vectorStore = AzureCosmosDBNoSqlVectorStore.fromConnectionString({
    connectionString,
    ...dbConfig,
  });
  return { vectorStore };
};

/**
 * Util function to create AzureCosmosDB vectorStore from managed identity.
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
  return { vectorStore };
};
