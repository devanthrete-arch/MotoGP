import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseShowroomManifest } from "./showroomManifest";

describe("parseShowroomManifest", () => {
  it("reads the shipped manifest, with each car's own paints", () => {
    const manifest = parseShowroomManifest(JSON.parse(readFileSync("public/showroom/manifest.json", "utf8")));
    expect(manifest.cars.map((car) => car.id)).toEqual([
      "kia-sonet", "maruti-baleno", "vw-virtus", "honda-amaze", "honda-elevate", "mahindra-xuv700",
    ]);
    for (const car of manifest.cars) {
      expect(car.src).toBe(`/showroom/${car.id}.glb`);
      expect(car.paintMaterials).toEqual(["Paint"]);
      expect(car.swatches.length).toBeGreaterThan(3);
    }
  });

  it("drops entries that would load from another site or are malformed", () => {
    const manifest = parseShowroomManifest({
      cars: [
        { id: "ok", src: "/showroom/ok.glb", credit: { url: "javascript:alert(1)" }, lengthMetres: 400 },
        { id: "remote", src: "https://example.com/car.glb" },
        { id: "protocol-relative", src: "//example.com/car.glb" },
        { id: "ok", src: "/showroom/duplicate.glb" },
        { src: "/showroom/no-id.glb" },
        "not an object",
      ],
      swatches: [{ name: "Red", hex: "#C8102E" }, { name: "Bad", hex: "red" }],
    });
    expect(manifest.cars).toHaveLength(1);
    expect(manifest.cars[0]).toMatchObject({ id: "ok", name: "ok", lengthMetres: 4.2, credit: { url: "" } });
    expect(manifest.cars[0].swatches).toEqual([{ name: "Red", hex: "#c8102e" }]);
  });

  it("never throws on garbage", () => {
    for (const raw of [null, undefined, 3, "x", [], { cars: "no" }]) {
      expect(parseShowroomManifest(raw)).toEqual({ cars: [], swatches: [] });
    }
  });
});
