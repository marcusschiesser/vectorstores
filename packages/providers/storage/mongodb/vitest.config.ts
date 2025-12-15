import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run test files sequentially to prevent mongodb-memory-server race conditions
    // when downloading MongoDB binaries (lockfile conflicts)
    fileParallelism: false,
  },
});
