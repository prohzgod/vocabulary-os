import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, isOwnSurface, isSiteDisabled } from "./settings.js";

const settings = { ...DEFAULT_SETTINGS, dashboardUrl: "https://vocabulary-os-api.vercel.app" };

describe("isSiteDisabled", () => {
  it("matches the site and its subdomains only", () => {
    const withSites = { ...settings, disabledSites: ["mail.google.com", "example.com"] };
    expect(isSiteDisabled(withSites, "mail.google.com")).toBe(true);
    expect(isSiteDisabled(withSites, "www.example.com")).toBe(true);
    expect(isSiteDisabled(withSites, "notexample.com")).toBe(false);
    expect(isSiteDisabled(withSites, "google.com")).toBe(false);
  });
});

describe("isOwnSurface", () => {
  it("covers the dashboard, whatever the path", () => {
    expect(isOwnSurface(settings, "https://vocabulary-os-api.vercel.app/#/words")).toBe(true);
    expect(isOwnSurface(settings, "https://vocabulary-os-api.vercel.app")).toBe(true);
  });

  it("covers extension pages", () => {
    expect(isOwnSurface(settings, "chrome-extension://abcdefghijklmnop/options.html")).toBe(true);
  });

  it("leaves ordinary pages alone, including look-alike hosts", () => {
    expect(isOwnSurface(settings, "https://en.wikipedia.org/wiki/Vocabulary")).toBe(false);
    // The article a word was saved from keeps its highlights, however you reach it.
    expect(isOwnSurface(settings, "https://www.bbc.com/news/articles/abc123")).toBe(false);
    // The API is a different origin from the dashboard and is not a browsing surface anyway.
    expect(isOwnSurface(settings, "https://vocabulary-os-api.onrender.com/health")).toBe(false);
    expect(isOwnSurface(settings, "https://vocabulary-os-api.vercel.app.evil.test/")).toBe(false);
    expect(isOwnSurface(settings, "http://vocabulary-os-api.vercel.app/")).toBe(false);
  });

  it("does not throw on an empty or broken dashboard URL", () => {
    expect(isOwnSurface({ ...settings, dashboardUrl: "" }, "https://example.com")).toBe(false);
    expect(isOwnSurface({ ...settings, dashboardUrl: "not a url" }, "https://example.com")).toBe(false);
    expect(isOwnSurface(settings, "not a url")).toBe(false);
  });
});
