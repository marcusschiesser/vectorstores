import type { BaseNode } from "@vectorstores/core";
import type { Endee } from "endee";
import { EndeeVectorStore } from "../src/EndeeVectorStore";

/**
 * Testable version of EndeeVectorStore that tracks nodes locally
 * and exposes internal methods for testing.
 */
export class TestableEndeeVectorStore extends EndeeVectorStore {
  public nodes: BaseNode[] = [];

  constructor(client?: Endee) {
    super({
      indexName: "test-index",
      client: client,
      url: "http://localhost:8080/api/v1",
      batchSize: 100,
      dimension: 128,
    });
  }

  public getNodes(): BaseNode[] {
    return this.nodes;
  }

  /**
   * Expose the private buildEndeeFilter method for testing
   */
  public testBuildEndeeFilter(
    filters?: Parameters<EndeeVectorStore["query"]>[0]["filters"],
    docIds?: string[],
  ): Array<Record<string, unknown>> {
    return (
      this as unknown as { buildEndeeFilter: typeof this.testBuildEndeeFilter }
    ).buildEndeeFilter(filters, docIds);
  }
}
