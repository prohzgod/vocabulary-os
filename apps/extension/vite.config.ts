import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Extension pages, background worker and offscreen document.
 * The content script has its own config (vite.content.config.ts).
 * The ONNX Runtime .wasm used by transformers.js is emitted as an asset automatically.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    modulePreload: false,
    // The offscreen translator bundles transformers.js (~900 kB); that is expected.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        offscreen: resolve(__dirname, "offscreen.html")
      },
      output: {
        entryFileNames: "[name].js"
      }
    }
  }
});
