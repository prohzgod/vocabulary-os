// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { MAX_MEANINGS_PER_SENSE } from "./build-dictionary.mjs";

const script = fileURLToPath(new URL("./build-dictionary.mjs", import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

function build(args) {
  const dir = mkdtempSync(join(tmpdir(), "dict-"));
  const output = join(dir, "en-vi.json");
  const log = execFileSync(process.execPath, [script, ...args(dir), "--out", output], { encoding: "utf8" });
  return { log, dictionary: JSON.parse(readFileSync(output, "utf8")) };
}

describe("build-dictionary", () => {
  it("reads English Wiktionary translations", () => {
    const { log, dictionary } = build(() => ["--en", fixture("kaikki-en-sample.jsonl")]);
    expect(log).toContain("5 headwords");
    expect(dictionary.v).toBe(1);
    expect(dictionary.source).toContain("CC BY-SA 4.0");
    expect(Object.keys(dictionary.entries)).toEqual(["look up", "many", "massive", "paris", "run"]);
    expect(dictionary.entries.massive).toEqual([["adj", ["to lớn", "đồ sộ"]]]);
    expect(dictionary.entries.run).toEqual([["verb", ["chạy", "vận hành"]], ["noun", ["cuộc chạy"]]]);
    expect(dictionary.entries.many[0][1]).toHaveLength(MAX_MEANINGS_PER_SENSE);
  });

  it("puts Vietnamese Wiktionary glosses first, adds English translations, and points forms at base words", () => {
    const { log, dictionary } = build((dir) => {
      // Also covers gzipped input.
      const gz = join(dir, "vi.jsonl.gz");
      writeFileSync(gz, gzipSync(readFileSync(fixture("kaikki-vi-sample.jsonl"))));
      return ["--vi", gz, "--en", fixture("kaikki-en-sample.jsonl")];
    });
    const { entries } = dictionary;
    expect(log).toContain("2 form pointers");
    // Glosses: first letter lowercased (not all-caps words), trailing period dropped; English translations
    // already said inside a gloss ("to lớn", "đồ sộ") are not repeated.
    expect(entries.massive).toEqual([["adj", ["to lớn, đồ sộ; chắc nặng", "thô", "ồ ạt", "TV"]]]);
    expect(entries.run).toEqual([["verb", ["chạy", "vận hành"]], ["noun", ["cuộc chạy"]]]);
    // Pure inflections become pointers; a base word missing from the dictionary gives no entry.
    expect(entries.went).toBe("go");
    expect(entries.children).toBe("child");
    expect(entries.studies).toBeUndefined();
    // Mixed entry: its own meanings, then the base word's.
    expect(entries.running).toEqual([["noun", ["cuộc chạy đua", "cuộc chạy"]], ["verb", ["chạy", "vận hành"]]]);
    // Proper nouns keep inner capitals; over-long glosses and other languages are dropped.
    expect(entries.paris).toEqual([["name", ["thủ đô và thành phố lớn nhất của Pháp", "Pa-ri"]]]);
    expect(entries.long).toEqual([["adj", ["dài"]]]);
    expect(entries.chat).toBeUndefined();
    expect(entries["look up"]).toEqual([["verb", ["tra cứu"]]]);
  });
});
