// Builds the extension into dist/: pages + background + offscreen, then the content script.
// Usage: node build.mjs [--watch]
import { rmSync } from "node:fs";
import { build } from "vite";

const watch = process.argv.includes("--watch") ? {} : null;

rmSync("dist", { recursive: true, force: true });
await build({ configFile: "vite.config.ts", build: { watch } });
await build({ configFile: "vite.content.config.ts", build: { watch } });

if (watch) {
  console.log("Watching for changes. Reload the extension in chrome://extensions after edits.");
}
