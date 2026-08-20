import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  outDir: "dist",
  // Dual package with "type": "module": ESM as .js/.d.ts, CJS as .cjs/.d.cts
  fixedExtension: false,
  platform: "neutral",
  target: "es2022",
});
