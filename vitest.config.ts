import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/schemas/**/*.ts"],
      exclude: ["src/schemas/__tests__/**"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
  resolve: {
    // Allow TypeScript files to be imported with .js extension (NodeNext module style)
    alias: [
      {
        find: /^(\.\.?\/.*?)\.js$/,
        replacement: "$1.ts",
      },
    ],
    extensions: [".ts", ".js"],
  },
});
