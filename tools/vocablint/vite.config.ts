import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts", "src/oxlint.ts"],
    platform: "node",
    sourcemap: true,
    dts: {
      generator: "tsgo",
    },
  },
});
