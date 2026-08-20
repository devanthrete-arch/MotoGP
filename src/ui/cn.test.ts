import { describe, expect, it } from "vitest";
import { cn, focusRing, touchTarget } from "./cn";

describe("cn", () => {
  it("joins fragments with exactly one space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops every falsy conditional instead of printing it", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("never welds two fragments together when one is conditional", () => {
    // The bug this replaces: "base " + (flag ? "x" : "") + "y" -> "base xy".
    const flag = false;
    expect(cn("base", flag && "x", "y")).toBe("base y");
  });

  it("flattens arrays and object maps", () => {
    expect(cn(["a", ["b"]], { c: true, d: false })).toBe("a b c");
  });

  it("collapses duplicate tokens so merged class strings stay readable", () => {
    expect(cn("rounded p-2", "rounded")).toBe("rounded p-2");
  });

  it("normalises whitespace inside a fragment", () => {
    expect(cn("  a   b  ")).toBe("a b");
  });

  it("keys focus off :focus-visible and never bare :focus", () => {
    expect(focusRing).toContain("focus-visible:ring-2");
    expect(focusRing).not.toMatch(/(^|\s)focus:ring/);
  });

  it("states the touch-target floor once", () => {
    expect(touchTarget).toBe("min-h-[44px]");
  });
});
