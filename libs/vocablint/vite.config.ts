import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    dedupe: ["vitest"],
  },
  test: {
    testTimeout: 30_000,
    server: {
      deps: {
        inline: ["@effect/vitest"],
      },
    },
  },
  pack: {
    entry: ["src/index.ts", "src/cli.ts", "src/oxlint.ts"],
    platform: "node",
    sourcemap: true,
    dts: {
      generator: "tsgo",
    },
  },
});
