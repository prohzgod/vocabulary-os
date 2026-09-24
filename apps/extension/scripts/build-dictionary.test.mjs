// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_MEANINGS_PER_SENSE } from "./build-dictionary.mjs";

const script = fileURLToPath(new URL("./build-dictionary.mjs", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/kaikki-sample.jsonl", import.meta.url));

describe("build-dictionary", () => {
  it("turns a wiktextract dump into the bundled dictionary format", () => {
    const output = join(mkdtempSync(join(tmpdir(), "dict-")), "en-vi.json");
    const log = execFileSync(process.execPath, [script, fixture, output], { encoding: "utf8" });
    const dictionary = JSON.parse(readFileSync(output, "utf8"));

    expect(log).toContain("5 headwords");
    expect(dictionary.v).toBe(1);
    expect(dictionary.source).toContain("CC BY-SA 4.0");
    expect(Object.keys(dictionary.entries)).toEqual(["look up", "many", "massive", "paris", "run"]);
    expect(dictionary.entries.massive).toEqual([["adj", ["to lớn", "đồ sộ"]]]);
    expect(dictionary.entries.run).toEqual([["verb", ["chạy", "vận hành"]], ["noun", ["cuộc chạy"]]]);
    expect(dictionary.entries.paris).toEqual([["name", ["Pa-ri"]]]);
    expect(dictionary.entries.many[0][1]).toHaveLength(MAX_MEANINGS_PER_SENSE);
  });
});
