import { SimpleDocumentStore, SimpleKVStore } from "@vectorstores/core";
import { describe, expect, it } from "vitest";

describe("storage: lodash-removal coverage", () => {
  it("SimpleDocumentStore.toDict() works when backed by SimpleKVStore", () => {
    const docStore = new SimpleDocumentStore(new SimpleKVStore());
    expect(docStore.toDict()).toEqual({});
  });
});
