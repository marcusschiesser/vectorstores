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

    const struct = new IndexList("00000000-0000-0000-0000-000000000001");
    struct.nodes = ["a", "b", "c"];
    await store.addIndexStruct(struct);

    // Runtime callers may pass undefined; the API accepts optional structId.
    const loaded = await store.getIndexStruct(undefined);
    expect(loaded).toBeDefined();
    expect(loaded!.indexId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("KVIndexStore.getIndexStructs() returns all structs via Object.values mapping", async () => {
    const kv = new SimpleKVStore();
    const store = new KVIndexStore(kv);

    const s1 = new IndexList("00000000-0000-0000-0000-000000000002");
    const s2 = new IndexList("00000000-0000-0000-0000-000000000003");
    await store.addIndexStruct(s1);
    await store.addIndexStruct(s2);

    const structs = await store.getIndexStructs();
    expect(structs.map((s) => s.indexId).sort()).toEqual([
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ]);
  });

  it("SimpleDocumentStore.toDict() works when backed by SimpleKVStore", () => {
    const docStore = new SimpleDocumentStore(new SimpleKVStore());
    expect(docStore.toDict()).toEqual({});
  });
});
