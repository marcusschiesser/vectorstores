import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/lib/**", "**/dist/**", "**/node_modules/**"],
  },
});
