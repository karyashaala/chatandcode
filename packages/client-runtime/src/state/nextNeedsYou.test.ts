import { describe, expect, it } from "vite-plus/test";

import { resolveNextNeedsYouKey } from "./nextNeedsYou.ts";

type Row = { readonly key: string; readonly tier: number | null };

function next(rows: readonly Row[], currentKey: string | null) {
  return resolveNextNeedsYouKey({
    threads: rows,
    currentKey,
    keyOf: (row) => row.key,
    rank: (row) => row.tier,
  });
}

describe("resolveNextNeedsYouKey", () => {
  it("puts a blocked thread lower down ahead of finished work higher up", () => {
    const rows = [
      { key: "done", tier: 1 },
      { key: "idle", tier: null },
      { key: "approval", tier: 0 },
    ];
    expect(next(rows, null)).toBe("approval");
    expect(next(rows, "approval")).toBe("done");
  });

  it("moves to the candidate after the current thread and wraps around", () => {
    const rows = [
      { key: "a", tier: 0 },
      { key: "b", tier: 1 },
      { key: "c", tier: 1 },
    ];
    expect(next(rows, "b")).toBe("c");
    expect(next(rows, "c")).toBe("a");
  });

  it("starts from the first candidate when the current thread needs nothing", () => {
    const rows = [
      { key: "current", tier: null },
      { key: "b", tier: 1 },
      { key: "a", tier: 0 },
    ];
    expect(next(rows, "current")).toBe("a");
  });

  it("returns null when nothing else needs you", () => {
    expect(next([{ key: "idle", tier: null }], null)).toBeNull();
    expect(next([{ key: "only", tier: 0 }], "only")).toBeNull();
  });
});
