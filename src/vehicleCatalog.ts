export const vehicleBrands = [
  "Tata",
  "Honda",
  "Kia",
  "Mahindra",
  "Maruti Suzuki",
  "MG",
  "Hyundai",
  "Toyota",
  "Skoda",
  "Volkswagen",
] as const;

const vehicleModelsByBrand: Partial<Record<(typeof vehicleBrands)[number], readonly string[]>> = {
  MG: ["Hector", "Hector Plus", "Astor", "Gloster", "Comet EV", "ZS EV"],
};

export function modelsForBrand(brand: string): readonly string[] {
  return vehicleModelsByBrand[brand as keyof typeof vehicleModelsByBrand] ?? [];
}
