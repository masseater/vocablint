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
});
