import { describe, expect, it } from "vitest";
import { comparisonFields, legacyVariantSourceFor, verifiedComparisonFor } from "./comparisonCatalog";

describe("manufacturer comparison catalog", () => {
  it("keeps all requested categories and practical spec fields", () => {
    expect(comparisonFields).toHaveLength(12);
    expect(comparisonFields.every((section) => section.fields.length > 0)).toBe(true);
  });

  it("uses the selected transmission for Elevate mileage", () => {
    expect(verifiedComparisonFor("Honda", "Elevate", "SV Petrol MT")?.values.mileage).toBe("15.31 km/l");
    expect(verifiedComparisonFor("Honda", "Elevate", "ZX CVT")?.values.mileage).toBe("16.92 km/l");
  });

  it("keeps Elevate safety and comfort equipment specific to SV and ZX", () => {
    const base = verifiedComparisonFor("Honda", "Elevate", "SV Petrol MT");
    const top = verifiedComparisonFor("Honda", "Elevate", "ZX CVT");
    expect(base?.source.url).toContain("hondacarindia.com/web-data/brochures/");
    expect(base?.values.displacement).toBe("1,498 cc");
    expect(base?.values.airbags).toBe("6");
    expect(base?.values.collisionAssist).toBe("No");
    expect(top?.values.collisionAssist).toBe("Honda SENSING CMBS");
    expect(top?.values.sunroof).toBe("Electric");
    expect(base?.values.drive).toBeUndefined();
  });

  it("does not borrow specs from another trim", () => {
    expect(verifiedComparisonFor("Hyundai", "Creta", "EX Petrol MT")?.values.sunroof).toBe("No");
    expect(verifiedComparisonFor("Hyundai", "Creta", "SX Petrol CVT")).toBeUndefined();
    expect(verifiedComparisonFor("Tata", "Nexon", "XZ+ Diesel MT")).toBeUndefined();
  });

  it("uses official Tata brochures for the exact Nexon and Punch base trims", () => {
    const nexon = verifiedComparisonFor("Tata", "Nexon", "Smart Petrol MT");
    const punch = verifiedComparisonFor("Tata", "Punch", "Pure Petrol MT");
    expect(nexon?.source.url).toContain("cars.tatamotors.com/content/dam/");
    expect(punch?.source.url).toContain("cars.tatamotors.com/content/dam/");
    expect(nexon?.values.transmission).toBe("5-speed manual");
    expect(nexon?.values.boot).toBe("382 L (ISO V215)");
    expect(nexon?.values.mileage).toBeUndefined();
    expect(punch?.values.torque).toBe("115 Nm @ 3,250 +/- 100 rpm");
    expect(punch?.values.boot).toBe("366 L (ISO V215)");
    expect(punch?.values.mileage).toBeUndefined();
  });

  it("keeps Brezza automatic and Baleno Sigma facts tied to their brochure columns", () => {
    const brezza = verifiedComparisonFor("Maruti Suzuki", "Brezza", "ZXi+ Petrol AT");
    const baleno = verifiedComparisonFor("Maruti Suzuki", "Baleno", "Sigma Petrol MT");
    expect(brezza?.source.url).toContain("marutisuzuki.com/content/dam/");
    expect(baleno?.source.url).toContain("nexaexperience.com/content/dam/");
    expect(brezza?.values.engine).toBe("1.5L K15C petrol ISG");
    expect(brezza?.values.mileage).toBe("20.17 km/l");
    expect(brezza?.values.touchscreen).toBe("10.1-inch");
    expect(brezza?.values.boot).toBeUndefined();
    expect(baleno?.values.mileage).toBe("22.35 km/l");
    expect(baleno?.values.touchscreen).toBe("No");
    expect(baleno?.values.rearAc).toBe("No");
  });

  it("keeps current Creta IVT separate from the unsupported SX CVT label", () => {
    const current = verifiedComparisonFor("Hyundai", "Creta", "SX Premium Petrol IVT");
    expect(current?.source.url).toContain("hyundai.com/content/dam/");
    expect(current?.values.transmission).toBe("IVT");
    expect(current?.values.sunroof).toBe("Voice-enabled panoramic");
    expect(current?.values.collisionAssist).toBe("No");
    expect(verifiedComparisonFor("Hyundai", "Creta", "SX Petrol CVT")).toBeUndefined();
    expect(legacyVariantSourceFor("Hyundai", "Creta", "SX Petrol CVT")?.url).toBe(current?.source.url);
  });

  it("uses Mahindra's exact seven-seat diesel automatic 4WD variant page", () => {
    const scorpio = verifiedComparisonFor("Mahindra", "Scorpio N", "Z8L Diesel AT 4WD");
    expect(scorpio?.source.url).toContain("auto.mahindra.com/suv/scorpio-n-z8-l-diesel/");
    expect(scorpio?.values.drive).toBe("4WD");
    expect(scorpio?.values.torque).toBe("400 Nm @ 1,750-2,750 rpm");
    expect(scorpio?.values.seats).toBe("7");
    expect(scorpio?.values.mileage).toBeUndefined();
  });

  it("keeps current Kia IVT and DCT selections tied to their exact trims", () => {
    const seltos = verifiedComparisonFor("Kia", "Seltos", "HTX Petrol IVT");
    const sonet = verifiedComparisonFor("Kia", "Sonet", "GTX+ DCT");
    expect(seltos?.source.url).toBe("https://www.kia.com/in/our-vehicles/seltos/specs.html");
    expect(sonet?.source.url).toBe("https://www.kia.com/in/our-vehicles/sonet/specs.html");
    expect(seltos?.values.transmission).toBe("IVT");
    expect(seltos?.values.fuelTank).toBe("47 L");
    expect(seltos?.values.touchscreen).toBe("12.3-inch");
    expect(sonet?.values.transmission).toBe("7-speed DCT");
    expect(sonet?.values.boot).toBe("385 L");
    expect(sonet?.values.mileage).toBeUndefined();
  });

  it("separates Grand Vitara petrol and strong-hybrid trim values", () => {
    const sigma = verifiedComparisonFor("Maruti Suzuki", "Grand Vitara", "Sigma Smart Hybrid MT");
    const alpha = verifiedComparisonFor("Maruti Suzuki", "Grand Vitara", "Alpha+ Hybrid e-CVT");
    expect(sigma?.source.url).toContain("nexaexperience.com/content/dam/");
    expect(alpha?.source.url).toBe(sigma?.source.url);
    expect(sigma?.values.displacement).toBe("1,462 cc");
    expect(alpha?.values.displacement).toBe("1,490 cc");
    expect(sigma?.values.mileage).toBe("21.11 km/l");
    expect(alpha?.values.mileage).toBe("27.97 km/l");
    expect(sigma?.values.touchscreen).toBe("No");
    expect(alpha?.values.touchscreen).toBe("9-inch");
    expect(sigma?.values.boot).toBeUndefined();
    expect(alpha?.values.boot).toBeUndefined();
  });

  it("uses Toyota's seven-seat GX and ZX(O) brochure columns", () => {
    const gx = verifiedComparisonFor("Toyota", "Innova Hycross", "GX 7S Petrol CVT");
    const zx = verifiedComparisonFor("Toyota", "Innova Hycross", "ZX(O) Hybrid");
    expect(gx?.source.url).toBe("https://www.toyotabharat.com/documents/brochures/e-brochure-hycross-spec.pdf");
    expect(zx?.source.url).toBe(gx?.source.url);
    expect(gx?.values.seats).toBe("7");
    expect(zx?.values.seats).toBe("7");
    expect(gx?.values.transmission).toBe("Direct Shift CVT with sequential shift");
    expect(zx?.values.transmission).toBe("e-Drive with sequential shift");
    expect(gx?.values.collisionAssist).toBe("No");
    expect(zx?.values.collisionAssist).toBe("Toyota Safety Sense pre-collision system");
    expect(gx?.values.mileage).toBeUndefined();
    expect(zx?.values.mileage).toBeUndefined();
  });

  it("keeps brake and mileage differences between Taigun engines", () => {
    const base = verifiedComparisonFor("Volkswagen", "Taigun", "Comfortline 1.0 TSI MT");
    const gt = verifiedComparisonFor("Volkswagen", "Taigun", "GT Plus 1.5 DSG");
    expect(base?.values.rearBrakes).toBe("Drum");
    expect(gt?.values.rearBrakes).toBe("Disc");
    expect(base?.values.mileage).not.toBe(gt?.values.mileage);
  });

  it("uses separate certified Virtus mileage for manual and DSG", () => {
    const base = verifiedComparisonFor("Volkswagen", "Virtus", "Comfortline 1.0 TSI MT");
    const gt = verifiedComparisonFor("Volkswagen", "Virtus", "GT Plus 1.5 DSG");
    expect(base?.values.mileage).toBe("20.19 km/l");
    expect(gt?.values.mileage).toBe("19.62 km/l");
    expect(base?.values.fuelTank).toBe("45 L");
    expect(gt?.values.wheels).toBe("16-inch (205/55 R16)");
  });

  it("distinguishes base and top Exter equipment", () => {
    const base = verifiedComparisonFor("Hyundai", "Exter", "HX 2 Petrol MT");
    const top = verifiedComparisonFor("Hyundai", "Exter", "HX 10 Petrol AMT");
    expect(base?.values.connectedCar).toBe("No");
    expect(top?.values.connectedCar).toBe("Hyundai Bluelink");
    expect(base?.values.airbags).toBe(top?.values.airbags);
    expect(base?.source.url).toContain("hyundai.com/content/dam/");
    expect(base?.values.length).toBe("3,830 mm");
    expect(top?.values.length).toBe(base?.values.length);
    expect(base?.values.height).toBeUndefined();
    expect(top?.values.height).toBe("1,643 mm (with roof rails)");
    expect(base?.values.wheels).toBe("14-inch steel");
    expect(top?.values.wheels).toBe("15-inch diamond-cut alloy");
    expect(top?.values.smartphone).toContain("via adaptor");
  });

  it("uses the current Kushaq brochure for chassis and trim safety", () => {
    const base = verifiedComparisonFor("Skoda", "Kushaq", "Classic+ 1.0 TSI MT");
    const top = verifiedComparisonFor("Skoda", "Kushaq", "Prestige 1.5 TSI DSG");
    expect(base?.source.url).toContain("skoda-auto.co.in/_doc/");
    expect(base?.values.length).toBe("4,229 mm");
    expect(top?.values.length).toBe(base?.values.length);
    expect(base?.values.tpms).toBe("No");
    expect(top?.values.tpms).toBe("Yes");
    expect(base?.values.rearBrakes).toBe("Drum");
    expect(top?.values.rearBrakes).toBe("Disc");
    expect(base?.values.wirelessCharger).toBe("No");
    expect(top?.values.wirelessCharger).toBe("Yes");
    expect(top?.values.touchscreen).toBe("10.1-inch");
  });

  it("leaves unverified variant fields blank", () => {
    expect(verifiedComparisonFor("Renault", "Kiger", "Authentic 1.0 MT")?.values.mileage).toBeUndefined();
    expect(verifiedComparisonFor("Volkswagen", "Taigun", "GT Plus 1.5 DSG")?.values.ota).toBeUndefined();
  });

  it("flags legacy labels without pretending that old stock is impossible", () => {
    expect(legacyVariantSourceFor("Mahindra", "XUV 3XO", "AX7L Diesel AT")?.url).toContain("mahindra.com");
    expect(legacyVariantSourceFor("Skoda", "Kushaq", "Onyx 1.0 TSI MT")?.url).toContain("skoda-auto.co.in");
    expect(legacyVariantSourceFor("Skoda", "Kushaq", "Classic+ 1.0 TSI MT")).toBeUndefined();
  });
});
