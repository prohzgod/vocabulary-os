import { beforeEach, describe, expect, it } from "vitest";
import { PASSIVE_HIGHLIGHT_CLASS } from "./dom-safety.js";
import { highlightWords } from "./highlighter.js";

const words = [
  { word: "massive", translation: "to lớn", state: "new" as const },
  { word: "C++", translation: "C++", state: "review" as const }
];

describe("highlightWords", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("wraps whole-word matches case-insensitively", () => {
    document.body.innerHTML = "<p>A Massive change, massively different. C++ too.</p>";
    expect(highlightWords(words)).toBe(2);
    const marks = [...document.querySelectorAll(`.${PASSIVE_HIGHLIGHT_CLASS}`)].map((element) => element.textContent);
    expect(marks).toEqual(["Massive", "C++"]);
    expect(document.body.textContent).toBe("A Massive change, massively different. C++ too.");
  });

  it("never touches links, inputs or code", () => {
    document.body.innerHTML = `<a href="#">massive</a><code>massive</code><textarea>massive</textarea>`;
    expect(highlightWords(words)).toBe(0);
  });
});
