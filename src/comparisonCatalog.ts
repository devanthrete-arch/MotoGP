export const comparisonFields = [
  { title: "Basic Information", fields: [["bodyType", "Body type"], ["seats", "Seating capacity"]] },
  { title: "Engine & Transmission", fields: [["engine", "Engine"], ["displacement", "Displacement"], ["power", "Max power"], ["torque", "Max torque"], ["transmission", "Transmission"], ["drive", "Drive type"]] },
  { title: "Fuel & Performance", fields: [["fuel", "Fuel type"], ["mileage", "Certified mileage"], ["fuelTank", "Fuel tank capacity"]] },
  { title: "Suspension, Steering & Brakes", fields: [["frontSuspension", "Front suspension"], ["rearSuspension", "Rear suspension"], ["frontBrakes", "Front brakes"], ["rearBrakes", "Rear brakes"], ["steering", "Steering"]] },
  { title: "Dimensions & Capacity", fields: [["length", "Length"], ["width", "Width"], ["height", "Height"], ["wheelbase", "Wheelbase"], ["groundClearance", "Ground clearance"], ["boot", "Boot space"]] },
  { title: "Comfort & Convenience", fields: [["climate", "Climate control"], ["cruise", "Cruise control"], ["sunroof", "Sunroof"], ["rearAc", "Rear AC vents"], ["wirelessCharger", "Wireless phone charging"]] },
  { title: "Interior", fields: [["upholstery", "Seat upholstery"], ["instrumentCluster", "Instrument cluster"], ["rearArmrest", "Rear centre armrest"]] },
  { title: "Exterior", fields: [["headlamps", "Headlamps"], ["wheels", "Wheels"], ["mirrors", "Outside mirrors"]] },
  { title: "Safety", fields: [["airbags", "Airbags"], ["abs", "ABS with EBD"], ["esc", "Electronic stability control"], ["isofix", "ISOFIX anchors"], ["tpms", "Tyre pressure monitoring"]] },
  { title: "ADAS", fields: [["collisionAssist", "Forward collision assist"], ["laneAssist", "Lane keeping assist"], ["adaptiveCruise", "Adaptive cruise control"], ["highBeamAssist", "High-beam assist"]] },
  { title: "Advanced Internet", fields: [["connectedCar", "Connected-car service"], ["ota", "Over-the-air updates"], ["remoteStart", "Remote start"]] },
  { title: "Entertainment & Communication", fields: [["touchscreen", "Touchscreen"], ["smartphone", "Android Auto / Apple CarPlay"], ["speakers", "Speakers"], ["bluetooth", "Bluetooth"]] },
] as const;

type Source = { label: string; url: string };
type SpecKey = (typeof comparisonFields)[number]["fields"][number][0];
type SpecRecord = { source: Source; values: Partial<Record<SpecKey, string>> };

const elevateSource: Source = { label: "Honda India", url: "https://www.hondacarindia.com/honda-elevate" };
const cretaSource: Source = { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/creta/features" };
const taigunSource: Source = { label: "Volkswagen India", url: "https://www.volkswagen.co.in/en/models/taigun.html/__layer/layers/specifications/taigun/master.layer" };
const virtusSource: Source = { label: "Volkswagen India", url: "https://www.volkswagen.co.in/en/models/virtus.html/__layer/layers/specifications/virtus/virtus-chrome-technical-specifications.layer" };
const kushaqSource: Source = { label: "Skoda India", url: "https://www.skoda-auto.co.in/news/news-detail/skoda-auto-india-redefines-value-performance-and-safety-with-launch-of-the-easy-to-love-new-kushaq" };
const slaviaSource: Source = { label: "Skoda India", url: "https://www.skoda-auto.co.in/news/news-detail/the-new-skoda-slavia-says-it-all-with-confidence" };
const exterSource: Source = { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/exter/features" };
const kigerSource: Source = { label: "Renault India", url: "https://www.renault.co.in/cars/renault-kiger/configurator.html" };
const taigunCommon = {
  fuel: "Petrol", steering: "Electromechanical power steering", frontBrakes: "Disc", frontSuspension: "McPherson strut with stabiliser bar",
  rearSuspension: "Twist beam axle", length: "4,221 mm", width: "1,760 mm", height: "1,612 mm", wheelbase: "2,651 mm",
  boot: "385 L", fuelTank: "50 L",
};
const virtusCommon = {
  fuel: "Petrol", steering: "Electromechanical power steering", frontBrakes: "Disc", rearBrakes: "Drum",
  frontSuspension: "McPherson strut with stabiliser bar", rearSuspension: "Twist beam axle",
  length: "4,561 mm", width: "1,752 mm", height: "1,507 mm", wheelbase: "2,651 mm", boot: "521 L", groundClearance: "179 mm (unladen)",
};

// Only facts supported for these exact selections are included. A blank means unverified, not absent.
const verifiedVariants: Record<string, SpecRecord> = {
  "Honda|Elevate|SV Petrol MT": {
    source: elevateSource,
    values: { engine: "1.5L i-VTEC petrol", transmission: "6-speed manual", fuel: "Petrol", mileage: "15.31 km/l", groundClearance: "220 mm", boot: "458 L" },
  },
  "Honda|Elevate|ZX CVT": {
    source: elevateSource,
    values: { engine: "1.5L i-VTEC petrol", transmission: "CVT", fuel: "Petrol", mileage: "16.92 km/l", groundClearance: "220 mm", boot: "458 L" },
  },
  "Hyundai|Creta|EX Petrol MT": {
    source: cretaSource,
    values: {
      engine: "1.5L MPi petrol", transmission: "Manual", fuel: "Petrol", airbags: "6", abs: "Yes", esc: "Yes", tpms: "Yes",
      rearBrakes: "Disc", climate: "Manual AC", rearAc: "Yes", sunroof: "No", cruise: "No", wirelessCharger: "No",
      upholstery: "Fabric", instrumentCluster: "Colour TFT MID", rearArmrest: "Yes", touchscreen: "8-inch", smartphone: "Wireless Android Auto and Apple CarPlay",
      bluetooth: "Yes", connectedCar: "No", ota: "No", collisionAssist: "No", laneAssist: "No", adaptiveCruise: "No", highBeamAssist: "No",
    },
  },
  "Volkswagen|Taigun|Comfortline 1.0 TSI MT": {
    source: taigunSource,
    values: { ...taigunCommon, engine: "1.0L TSI", displacement: "999 cc", power: "115 PS @ 5,000-5,500 rpm", torque: "178 Nm @ 1,850-4,000 rpm", transmission: "6-speed manual", rearBrakes: "Drum", mileage: "19.98 km/l" },
  },
  "Volkswagen|Taigun|GT Plus 1.5 DSG": {
    source: taigunSource,
    values: { ...taigunCommon, engine: "1.5L TSI Evo with ACT", displacement: "1,498 cc", power: "150 PS @ 5,000-6,000 rpm", torque: "250 Nm @ 1,600-3,500 rpm", transmission: "7-speed DSG", rearBrakes: "Disc", mileage: "18.85 km/l" },
  },
  "Volkswagen|Virtus|Comfortline 1.0 TSI MT": {
    source: virtusSource,
    values: { ...virtusCommon, engine: "1.0L TSI", displacement: "999 cc", power: "115 PS @ 5,000-5,500 rpm", torque: "178 Nm @ 1,750-4,000 rpm", transmission: "6-speed manual" },
  },
  "Volkswagen|Virtus|GT Plus 1.5 DSG": {
    source: virtusSource,
    values: { ...virtusCommon, engine: "1.5L TSI Evo with ACT", displacement: "1,498 cc", power: "150 PS @ 5,000-6,000 rpm", torque: "250 Nm @ 1,600-3,500 rpm", transmission: "7-speed DSG" },
  },
  "Skoda|Kushaq|Classic+ 1.0 TSI MT": {
    source: kushaqSource,
    values: { engine: "1.0L TSI turbo petrol", power: "85 kW", torque: "178 Nm", transmission: "6-speed manual", fuel: "Petrol", mileage: "19.66 km/l (ARAI)", airbags: "6", climate: "Automatic", sunroof: "Electric", headlamps: "LED", wheels: "16-inch alloy", touchscreen: "7-inch", speakers: "6" },
  },
  "Skoda|Kushaq|Prestige 1.5 TSI DSG": {
    source: kushaqSource,
    values: { engine: "1.5L TSI turbo petrol", power: "110 kW", torque: "250 Nm", transmission: "7-speed DSG", fuel: "Petrol", mileage: "18.72 km/l (ARAI)", airbags: "6", frontBrakes: "Disc", rearBrakes: "Disc", sunroof: "Panoramic", instrumentCluster: "10.25-inch digital", upholstery: "Leatherette", wheels: "17-inch alloy" },
  },
  "Skoda|Slavia|Classic 1.0 TSI MT": {
    source: slaviaSource,
    values: { engine: "1.0L TSI turbo petrol", transmission: "6-speed manual", fuel: "Petrol", airbags: "6", climate: "Automatic", touchscreen: "7-inch", wheels: "15-inch steel" },
  },
  "Skoda|Slavia|Prestige 1.5 TSI DSG": {
    source: slaviaSource,
    values: { engine: "1.5L TSI turbo petrol", transmission: "7-speed DSG", fuel: "Petrol", airbags: "6", rearBrakes: "Disc", instrumentCluster: "10.25-inch digital", touchscreen: "10.1-inch", smartphone: "Wireless Android Auto and Apple CarPlay", wheels: "16-inch alloy" },
  },
  "Hyundai|Exter|HX 2 Petrol MT": {
    source: exterSource,
    values: { engine: "1.2L Kappa petrol", transmission: "Manual", fuel: "Petrol", airbags: "6", abs: "Yes", esc: "Yes", isofix: "Yes", tpms: "No", sunroof: "No", cruise: "No", rearAc: "No", wirelessCharger: "No", climate: "Manual AC", upholstery: "Fabric", instrumentCluster: "Colour TFT MID", connectedCar: "No", ota: "No", touchscreen: "No", smartphone: "No", speakers: "No" },
  },
  "Hyundai|Exter|HX 10 Petrol AMT": {
    source: exterSource,
    values: { engine: "1.2L Kappa petrol", transmission: "AMT", fuel: "Petrol", airbags: "6", abs: "Yes", esc: "Yes", isofix: "Yes", tpms: "Yes", sunroof: "Electric", cruise: "Yes", rearAc: "Yes", wirelessCharger: "Yes", climate: "Automatic", instrumentCluster: "Colour TFT MID", connectedCar: "Hyundai Bluelink", ota: "Maps and infotainment", touchscreen: "8-inch navigation", smartphone: "Wireless Android Auto and Apple CarPlay", speakers: "Front and rear" },
  },
  "Renault|Kiger|Authentic 1.0 MT": {
    source: kigerSource,
    values: {
      engine: "1.0L petrol, 3 cylinders", displacement: "1.0 L", power: "72 PS", torque: "96 Nm", transmission: "Manual", fuel: "Petrol", fuelTank: "40 L",
      steering: "Electric power steering", length: "3,990 mm", width: "1,750 mm", height: "1,605 mm", wheelbase: "2,500 mm", groundClearance: "205 mm",
      climate: "Manual AC", rearArmrest: "Yes", upholstery: "Black fabric", wheels: "16-inch steel", esc: "Yes", abs: "Yes with EBD", isofix: "Yes", tpms: "Yes", airbags: "6",
    },
  },
};

export const verifiedComparisonFor = (brand: string, model: string, variant?: string): SpecRecord | undefined =>
  verifiedVariants[`${brand}|${model}|${variant ?? ""}`];

const legacyVariantSources: Record<string, Source> = {
  "Tata|Nexon|XZ+ Diesel MT": { label: "Tata Motors", url: "https://cars.tatamotors.com/nexon/ice/price.html" },
  "Tata|Punch|Accomplished Dazzle AMT": { label: "Tata Motors", url: "https://cars.tatamotors.com/punch/ice/price.html" },
  "Tata|Altroz|XE Petrol MT": { label: "Tata Motors", url: "https://www.tatamotors.com/press-releases/tata-motors-launches-the-all-new-altroz-premium-by-legacy-modern-by-design/" },
  "Tata|Altroz|XZ+ Diesel MT": { label: "Tata Motors", url: "https://www.tatamotors.com/press-releases/tata-motors-launches-the-all-new-altroz-premium-by-legacy-modern-by-design/" },
  "Kia|Seltos|GTX+ DCT": { label: "Kia India", url: "https://www.kia.com/in/our-vehicles/seltos/showroom.html" },
  "Kia|Carens|Premium Petrol MT": { label: "Kia India", url: "https://www.kia.com/in/our-vehicles/carens/showroom.html" },
  "Kia|Carens|Luxury+ Diesel AT": { label: "Kia India", url: "https://www.kia.com/in/our-vehicles/carens/showroom.html" },
  "Mahindra|XUV700|AX5 Petrol MT": { label: "Mahindra Auto", url: "https://auto.mahindra.com/suv" },
  "Mahindra|XUV700|AX7 Diesel AT": { label: "Mahindra Auto", url: "https://auto.mahindra.com/suv" },
  "Mahindra|XUV 3XO|AX7L Diesel AT": { label: "Mahindra Auto", url: "https://auto.mahindra.com/own-online/variant-selection?pid=X3XO" },
  "Hyundai|Venue|S Petrol MT": { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/venue/features" },
  "Hyundai|Venue|SX(O) Turbo DCT": { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/venue/features" },
  "Hyundai|i20|Asta(O) Turbo DCT": { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/i20/features" },
  "Renault|Kiger|RXZ Turbo CVT": { label: "Renault India", url: "https://www.renault.co.in/cars/renault-kiger.html" },
  "Skoda|Kushaq|Onyx 1.0 TSI MT": kushaqSource,
  "Skoda|Kushaq|Style 1.5 TSI DSG": kushaqSource,
  "Skoda|Slavia|Active 1.0 TSI MT": slaviaSource,
  "Skoda|Slavia|Style 1.5 TSI DSG": slaviaSource,
};

export const legacyVariantSourceFor = (brand: string, model: string, variant?: string): Source | undefined =>
  legacyVariantSources[`${brand}|${model}|${variant ?? ""}`];
