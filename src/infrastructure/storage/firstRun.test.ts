import { describe, expect, it } from "vitest";
import { loadGarage, loadTimeline } from "./localStore";
import { seedGarage } from "../../core/entities";

/**
 * A genuinely new visitor must start with an empty garage.
 *
 * The seed vehicle used to be the storage default, so every first-time user
 * appeared to own a Tata Nexon they had never entered, and `garage.length === 0`
 * was never true — which is why first-run detection could not work.
 */
describe("first run", () => {
  it("starts with no vehicles", () => {
    expect(loadGarage()).toEqual([]);
  });

  it("starts with no timeline entries, so no record points at a car that does not exist", () => {
    expect(loadTimeline()).toEqual([]);
  });

  it("does not ship the demo vehicle to real visitors", () => {
    const garage = loadGarage();
    expect(garage.some((vehicle) => vehicle.id === seedGarage[0]?.id)).toBe(false);
  });

});
