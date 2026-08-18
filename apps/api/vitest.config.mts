import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // One shared database; parallel files would race on fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
  // No transform overrides: Vitest 4 transforms with oxc, which reads the
  // decorator settings from tsconfig.json. An esbuild block here is silently
  // ignored and only produces a warning.
});
