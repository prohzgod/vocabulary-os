import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startHighlightScheduler, type WatchPage } from "./highlight-scheduler.js";

const TIMING = { firstDelay: 800, minDelay: 600, maxDelay: 4800 };

/** A stand-in for the DOM watcher so page changes happen exactly when we say. */
function fakeWatcher() {
  let notify = () => {};
  let stopped = false;
  const watch: WatchPage = (onChange) => {
    notify = onChange;
    return {
      drain: () => {},
      stop: () => {
        stopped = true;
        notify = () => {}; // a disconnected observer delivers nothing
      }
    };
  };
  return { watch, pageChanged: () => notify(), get stopped() { return stopped; } };
}

describe("highlight scheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a first pass after the initial delay", async () => {
    const pass = vi.fn(async () => 1);
    const { watch } = fakeWatcher();
    startHighlightScheduler(pass, { ...TIMING, watch });

    await vi.advanceTimersByTimeAsync(799);
    expect(pass).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(pass).toHaveBeenCalledTimes(1);
  });

  it("runs again when the page adds content later", async () => {
    const pass = vi.fn(async () => 1);
    const page = fakeWatcher();
    startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800);

    page.pageChanged();
    await vi.advanceTimersByTimeAsync(599);
    expect(pass).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pass).toHaveBeenCalledTimes(2);
  });

  it("coalesces a burst of changes into one pass", async () => {
    const pass = vi.fn(async () => 1);
    const page = fakeWatcher();
    startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800);

    for (let i = 0; i < 10; i += 1) {
      page.pageChanged();
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(pass).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(pass).toHaveBeenCalledTimes(2);
  });

  it("waits longer while passes find nothing, and speeds up again when they do", async () => {
    const pass = vi.fn(async () => 0);
    const page = fakeWatcher();
    startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800); // pass 1 found nothing → wait 1200

    page.pageChanged();
    await vi.advanceTimersByTimeAsync(600);
    expect(pass).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(pass).toHaveBeenCalledTimes(2); // pass 2 found nothing → wait 2400

    pass.mockImplementation(async () => 3);
    page.pageChanged();
    await vi.advanceTimersByTimeAsync(2400);
    expect(pass).toHaveBeenCalledTimes(3); // words found → back to 600

    page.pageChanged();
    await vi.advanceTimersByTimeAsync(600);
    expect(pass).toHaveBeenCalledTimes(4);
  });

  it("never waits longer than maxDelay", async () => {
    const pass = vi.fn(async () => 0);
    const page = fakeWatcher();
    startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800);

    for (let i = 0; i < 8; i += 1) {
      page.pageChanged();
      await vi.advanceTimersByTimeAsync(TIMING.maxDelay);
    }
    expect(pass).toHaveBeenCalledTimes(9);
  });

  it("ignores page changes made while a pass is running", async () => {
    const page = fakeWatcher();
    const pass = vi.fn(async () => {
      page.pageChanged(); // what our own highlighting looks like to the watcher
      return 1;
    });
    startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800);

    await vi.advanceTimersByTimeAsync(5000);
    expect(pass).toHaveBeenCalledTimes(1);
  });

  it("refreshNow runs a pass immediately and stop ends the watch", async () => {
    const pass = vi.fn(async () => 0);
    const page = fakeWatcher();
    const scheduler = startHighlightScheduler(pass, { ...TIMING, watch: page.watch });
    await vi.advanceTimersByTimeAsync(800);

    scheduler.refreshNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(pass).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(page.stopped).toBe(true);
    page.pageChanged();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pass).toHaveBeenCalledTimes(2);
  });
});

describe("watchDom (real MutationObserver, real timers)", () => {
  it("reacts to content the page adds after load", async () => {
    document.body.innerHTML = "";
    const passes: number[] = [];
    const scheduler = startHighlightScheduler(
      async () => {
        passes.push(document.querySelectorAll("p").length);
        return 0;
      },
      { firstDelay: 10, minDelay: 10, maxDelay: 20 }
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(passes).toEqual([0]); // nothing on the page yet

    document.body.append(document.createElement("p"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(passes.length).toBeGreaterThan(1);
    expect(passes.at(-1)).toBe(1); // the late content was seen
    scheduler.stop();
  });
});
