import type { DictionaryFile } from "@vocab-os/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const EN_VI = { sourceLanguage: "en", targetLanguage: "vi" };
const FIXTURE: DictionaryFile = {
  v: 1,
  source: "test",
  entries: {
    massive: [["adj", ["to lớn", "đồ sộ"]]],
    run: [["verb", ["chạy"]], ["noun", ["cuộc chạy"]]]
  }
};

async function load(response: () => Promise<Response>) {
  vi.resetModules();
  const fetchMock = vi.fn(response);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
  return { ...(await import("./dictionary.js")), fetchMock };
}

describe("offscreen dictionary", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns every meaning for a word in the dictionary", async () => {
    const { lookup, fetchMock } = await load(async () => Response.json(FIXTURE));
    expect(await lookup("Massive", EN_VI)).toEqual({
      translation: "to lớn; đồ sộ",
      engine: "dictionary",
      senses: FIXTURE.entries.massive
    });
    await lookup("massive", EN_VI);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("chrome-extension://test/dict/en-vi.json");
  });

  it("names the base form it fell back to", async () => {
    const { lookup } = await load(async () => Response.json(FIXTURE));
    expect(await lookup("running", EN_VI)).toMatchObject({ translation: "chạy; cuộc chạy", headword: "run" });
  });

  it("falls through for misses, sentences and pairs without a dictionary", async () => {
    const { lookup, fetchMock } = await load(async () => Response.json(FIXTURE));
    expect(await lookup("gigantic", EN_VI)).toBeNull();
    expect(await lookup("the run was massive and long today", EN_VI)).toBeNull();
    expect(await lookup("massive", { sourceLanguage: "en", targetLanguage: "fr" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls through when the file is missing or broken", async () => {
    const missing = await load(async () => new Response("", { status: 404 }));
    expect(await missing.lookup("massive", EN_VI)).toBeNull();
    expect(await missing.dictionaryStatus(EN_VI)).toBeNull();

    const broken = await load(async () => Response.json({ hello: "world" }));
    expect(await broken.lookup("massive", EN_VI)).toBeNull();
  });

  it("keeps at most 3 parts of speech and 5 meanings each, and saves what it shows", async () => {
    const many: DictionaryFile = {
      ...FIXTURE,
      entries: { set: ["noun", "verb", "adj", "adv"].map((pos) => [pos, Array.from({ length: 7 }, (_, i) => `${pos}${i}`)]) }
    };
    const { lookup } = await load(async () => Response.json(many));
    const result = await lookup("set", EN_VI);
    expect(result?.senses?.map(([pos, meanings]) => [pos, meanings.length])).toEqual([["noun", 5], ["verb", 5], ["adj", 5]]);
    expect(result?.translation.split("; ")).toHaveLength(15);
  });

  it("reports the dictionary size", async () => {
    const { dictionaryStatus } = await load(async () => Response.json(FIXTURE));
    expect(await dictionaryStatus(EN_VI)).toEqual({ entries: 2, source: "test" });
  });
});
