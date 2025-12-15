import {
  IndexList,
  KVIndexStore,
  SimpleDocumentStore,
  SimpleKVStore,
} from "@vectorstores/core";
import { describe, expect, it } from "vitest";

describe("storage: lodash-removal coverage", () => {
  it("KVIndexStore.getIndexStruct(undefined) returns the only stored struct", async () => {
    const kv = new SimpleKVStore();
    const store = new KVIndexStore(kv);

    const struct = new IndexList("test-index-id");
    struct.nodes = ["a", "b", "c"];
    await store.addIndexStruct(struct);

    // Runtime callers may pass undefined; the API accepts optional structId.
    const loaded = await store.getIndexStruct(undefined);
    expect(loaded).toBeDefined();
    expect(loaded!.indexId).toBe("test-index-id");
  });

  it("KVIndexStore.getIndexStructs() returns all structs via Object.values mapping", async () => {
    const kv = new SimpleKVStore();
    const store = new KVIndexStore(kv);

    const s1 = new IndexList("id-1");
    const s2 = new IndexList("id-2");
    await store.addIndexStruct(s1);
    await store.addIndexStruct(s2);

    const structs = await store.getIndexStructs();
    expect(structs.map((s) => s.indexId).sort()).toEqual(["id-1", "id-2"]);
  });

  it("SimpleDocumentStore.toDict() works when backed by SimpleKVStore", () => {
    const docStore = new SimpleDocumentStore(new SimpleKVStore());
    expect(docStore.toDict()).toEqual({});
  });
});
