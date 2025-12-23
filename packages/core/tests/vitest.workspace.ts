import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      environment: "edge-runtime",
      exclude: ["**/lib/**", "**/dist/**", "**/node_modules/**"],
    },
  },
  {
    test: {
      environment: "happy-dom",
      exclude: ["**/lib/**", "**/dist/**", "**/node_modules/**"],
    },
  },
  {
    test: {
      environment: "node",
      exclude: ["**/lib/**", "**/dist/**", "**/node_modules/**"],
    },
  },
]);
