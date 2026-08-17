import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // The suite shares one database; parallel files would race on the fixtures
    // each one inserts.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});
