import { describe, expect, it } from "vitest";
import { readStoredJson, safeJsonParse, type StorageLike, writeStoredJson } from "./storage";

describe("Autoflex storage safety", () => {
  it("falls back when stored JSON is missing or corrupt", () => {
    expect(safeJsonParse(null, ["fallback"])).toEqual(["fallback"]);
    expect(safeJsonParse("{not-json", { ready: false })).toEqual({ ready: false });
  });

  it("reads stored JSON through a safe adapter", () => {
    const storage: StorageLike = {
      getItem: () => JSON.stringify({ displayName: "GarageNomad" }),
      setItem: () => undefined,
    };

    expect(readStoredJson("profile", { displayName: "" }, storage)).toEqual({ displayName: "GarageNomad" });
  });

  it("does not crash when browser storage throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(readStoredJson("profile", { displayName: "" }, storage)).toEqual({ displayName: "" });
    expect(() => writeStoredJson("profile", { displayName: "Owner" }, storage)).not.toThrow();
  });
});
