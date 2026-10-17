import { Document } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";
import { checkModel, countTriangles } from "./showroom-import.mjs";

// A box-shaped "car": a body, headlamps at the front and tail lamps at the back, each a box.
function boxCar({ length = 4, scale = 1, alongZ = false, facing = 1, paint = "Paint" } = {}) {
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene();
  document.getRoot().setDefaultScene(scene);
  const part = (materialName, [x0, x1], [y0, y1], [z0, z1]) => {
    const corners = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
      const [px, pz] = alongZ ? [z, x * facing] : [x * facing, z];
      corners.push(px * scale, y * scale, pz * scale);
    }
    const faces = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
    const primitive = document.createPrimitive()
      .setAttribute("POSITION", document.createAccessor().setType("VEC3").setArray(new Float32Array(corners)).setBuffer(buffer))
      .setIndices(document.createAccessor().setType("SCALAR").setArray(new Uint16Array(faces)).setBuffer(buffer))
      .setMaterial(document.createMaterial(materialName));
    scene.addChild(document.createNode(materialName).setMesh(document.createMesh().addPrimitive(primitive)));
  };
  part(paint, [-length / 2, length / 2], [0.2, 1.5], [-0.87, 0.87]);
  part("Headlamp", [length / 2 - 0.1, length / 2], [0.7, 0.8], [-0.7, 0.7]);
  part("Taillamp", [-length / 2, -length / 2 + 0.1], [0.8, 0.9], [-0.7, 0.7]);
  return document;
}

describe("checkModel", () => {
  it("passes a model built to the spec", () => {
    const result = checkModel(boxCar(), { lengthMetres: 4 });
    expect(result.problems).toEqual([]);
    expect(result.stats.triangles).toBe(36);
    expect(countTriangles(boxCar())).toBe(36);
  });

  it("needs a Paint material", () => {
    expect(checkModel(boxCar({ paint: "Body" }), { lengthMetres: 4 }).problems.join()).toMatch(/"Paint"/);
  });

  it("catches a model exported in centimetres", () => {
    expect(checkModel(boxCar({ scale: 100 }), { lengthMetres: 4 }).problems.join()).toMatch(/Length is 400\.000 m/);
  });

  it("catches a car lying along Z, and accepts it with a quarter turn", () => {
    expect(checkModel(boxCar({ alongZ: true }), { lengthMetres: 4 }).problems.join()).toMatch(/does not face \+X/);
    expect(checkModel(boxCar({ alongZ: true }), { lengthMetres: 4, yawDegrees: 90 }).problems).toEqual([]);
  });

  it("catches a car facing backwards, and accepts it turned round", () => {
    expect(checkModel(boxCar({ facing: -1 }), { lengthMetres: 4 }).problems.join()).toMatch(/--yaw 180/);
    expect(checkModel(boxCar({ facing: -1 }), { lengthMetres: 4, yawDegrees: 180 }).problems).toEqual([]);
  });

  it("holds the triangle budget", () => {
    expect(checkModel(boxCar(), { lengthMetres: 4, maxTriangles: 20 }).problems.join()).toMatch(/36 triangles, over the 20 budget/);
  });
});
