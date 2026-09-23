import { resolve } from "node:path";
import { defineConfig } from "vite";

/** Content scripts must be a single classic script (no `import`), so it is built alone as an IIFE. */
export default defineConfig({
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      formats: ["iife"],
      name: "vocabOsContent",
      fileName: () => "content.js"
    }
  }
});
