import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/lib/**", "**/dist/**", "**/node_modules/**"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
