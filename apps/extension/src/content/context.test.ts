import { describe, expect, it } from "vitest";
import { extractContextAround, extractContextSentence } from "./context.js";

describe("extractContextSentence", () => {
  it("returns the sentence containing the selected word", () => {
    const result = extractContextSentence(
      "First sentence. Smartphones have become ubiquitous in modern society. Final sentence.",
      "ubiquitous"
    );

    expect(result).toBe("Smartphones have become ubiquitous in modern society.");
  });

  it("clamps very long context around the selected word", () => {
    const result = extractContextSentence(
      `Intro. ${"a".repeat(180)} selected ${"b".repeat(180)}.`,
      "selected"
    );

    expect(result?.length).toBeLessThanOrEqual(256);
    expect(result).toContain("selected");
  });
});

describe("extractContextAround", () => {
  it("uses the occurrence that was selected, not the first one on the page", () => {
    const result = extractContextAround(
      "Skip to content Menu Java Interview Questions\nRead all the Java interview questions. Or is an ",
      "interview",
      " scheduled in the coming days? Then start below."
    );

    expect(result).toBe("Or is an interview scheduled in the coming days?");
  });
});
