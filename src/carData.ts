// AutoFlex India car market data.
// CONTRACT FILE: the exported types and function signatures below are frozen.
// The data agent replaces/extends the data arrays with researched real-market
// figures; screen agents import from this module and must not edit it.
//
// Data vintage: Indian market line-ups and ex-showroom Delhi prices as of
// mid-2026 (post GST 2.0 restructuring of Sept 2025), researched from
// manufacturer sites, CarWale, ZigWheels, Autocar India and V3Cars.
// Prices rounded to the nearest ₹1,000. mileageKMPL carries ARAI km/l for
// ICE/hybrid and MIDC range (km/charge) for EVs.

export interface CarVariant {
  name: string;
  fuel: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  transmission: "MT" | "AMT" | "CVT" | "DCT" | "AT" | "eCVT" | "Single Speed";
  priceExShowroomINR: number; // Delhi ex-showroom, INR
  engineCC?: number;
  powerBHP?: number;
  torqueNM?: number;
  mileageKMPL?: number; // ARAI claimed; km/charge range for EVs
  seats?: number;
}

export interface CarModel {
  brand: string;
  model: string;
  bodyType: "Hatchback" | "Sedan" | "SUV" | "MPV" | "Coupe" | "Pickup";
  safetyRatingStars?: number; // GNCAP/BNCAP
  variants: CarVariant[];
}

// state -> effective on-road multiplier over ex-showroom (RTO + insurance + cess, approx)
export const stateOnRoadFactor: Record<string, number> = {
  Delhi: 1.1,
  Maharashtra: 1.15,
  Karnataka: 1.2,
  "Tamil Nadu": 1.16,
  Telangana: 1.17,
  "Uttar Pradesh": 1.12,
  Gujarat: 1.1,
  "West Bengal": 1.12,
  Rajasthan: 1.13,
  Kerala: 1.18,
  Haryana: 1.12,
  Punjab: 1.13,
  "Madhya Pradesh": 1.14,
  "Andhra Pradesh": 1.16,
  Bihar: 1.13,
  Odisha: 1.11,
  Jharkhand: 1.12,
  Chhattisgarh: 1.12,
  Assam: 1.12,
  Uttarakhand: 1.12,
};

export const indianStates = Object.keys(stateOnRoadFactor);

export function onRoadPriceINR(exShowroomINR: number, state: string): number {
  const factor = stateOnRoadFactor[state] ?? 1.12;
  return Math.round(exShowroomINR * factor);
}

export function formatINR(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const carCatalog: CarModel[] = [
  // ───────────────────────── Maruti Suzuki ─────────────────────────
  {
    brand: "Maruti Suzuki",
    model: "Swift",
    bodyType: "Hatchback",
    variants: [
      { name: "LXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 579000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 24.8, seats: 5 },
      { name: "VXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 649000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 24.8, seats: 5 },
      { name: "VXi CNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 732000, engineCC: 1197, powerBHP: 69, torqueNM: 102, mileageKMPL: 32.85, seats: 5 },
      { name: "ZXi+ AMT", fuel: "Petrol", transmission: "AMT", priceExShowroomINR: 880000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 25.75, seats: 5 },
    ],
  },
  {
    brand: "Maruti Suzuki",
    model: "Baleno",
    bodyType: "Hatchback",
    variants: [
      { name: "Sigma", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 599000, engineCC: 1197, powerBHP: 89, torqueNM: 113, mileageKMPL: 22.94, seats: 5 },
      { name: "Delta", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 679000, engineCC: 1197, powerBHP: 89, torqueNM: 113, mileageKMPL: 22.94, seats: 5 },
      { name: "Delta CNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 769000, engineCC: 1197, powerBHP: 76, torqueNM: 98, mileageKMPL: 30.61, seats: 5 },
      { name: "Alpha AMT", fuel: "Petrol", transmission: "AMT", priceExShowroomINR: 879000, engineCC: 1197, powerBHP: 89, torqueNM: 113, mileageKMPL: 22.9, seats: 5 },
    ],
  },
  {
    brand: "Maruti Suzuki",
    model: "Dzire",
    bodyType: "Sedan",
    safetyRatingStars: 5,
    variants: [
      { name: "LXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 625000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 24.79, seats: 5 },
      { name: "VXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 699000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 24.79, seats: 5 },
      { name: "VXi CNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 786000, engineCC: 1197, powerBHP: 69, torqueNM: 102, mileageKMPL: 33.73, seats: 5 },
      { name: "ZXi+ AMT", fuel: "Petrol", transmission: "AMT", priceExShowroomINR: 934000, engineCC: 1197, powerBHP: 81, torqueNM: 112, mileageKMPL: 25.71, seats: 5 },
    ],
  },
  {
    brand: "Maruti Suzuki",
    model: "Brezza",
    bodyType: "SUV",
    variants: [
      { name: "LXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 740000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 17.38, seats: 5 },
      { name: "VXi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 869000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 17.38, seats: 5 },
      { name: "VXi CNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 930000, engineCC: 1462, powerBHP: 87, torqueNM: 122, mileageKMPL: 25.51, seats: 5 },
      { name: "ZXi+ AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1371000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 19.8, seats: 5 },
    ],
  },
  {
    brand: "Maruti Suzuki",
    model: "Grand Vitara",
    bodyType: "SUV",
    variants: [
      { name: "Sigma Smart Hybrid", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1067000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 21.11, seats: 5 },
      { name: "Delta Smart Hybrid", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1177000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 21.11, seats: 5 },
      { name: "Zeta+ Intelligent Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 1671000, engineCC: 1490, powerBHP: 115, torqueNM: 122, mileageKMPL: 27.97, seats: 5 },
      { name: "Alpha+ Intelligent Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 1899000, engineCC: 1490, powerBHP: 115, torqueNM: 122, mileageKMPL: 27.97, seats: 5 },
    ],
  },

  // ───────────────────────── Hyundai ─────────────────────────
  {
    brand: "Hyundai",
    model: "Creta",
    bodyType: "SUV",
    variants: [
      { name: "E 1.5 MPi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1079000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 17.4, seats: 5 },
      { name: "S 1.5 MPi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1220000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 17.4, seats: 5 },
      { name: "SX(O) 1.5 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 1850000, engineCC: 1493, powerBHP: 114, torqueNM: 250, mileageKMPL: 19.1, seats: 5 },
      { name: "SX(O) 1.5 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 2011000, engineCC: 1482, powerBHP: 158, torqueNM: 253, mileageKMPL: 18.4, seats: 5 },
    ],
  },
  {
    brand: "Hyundai",
    model: "Venue",
    bodyType: "SUV",
    variants: [
      { name: "E 1.2 Kappa", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 800000, engineCC: 1197, powerBHP: 82, torqueNM: 114, mileageKMPL: 20.5, seats: 5 },
      { name: "S 1.2 Kappa", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 921000, engineCC: 1197, powerBHP: 82, torqueNM: 114, mileageKMPL: 20.5, seats: 5 },
      { name: "SX 1.5 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1230000, engineCC: 1493, powerBHP: 114, torqueNM: 250, mileageKMPL: 23.0, seats: 5 },
      { name: "SX(O) 1.0 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1420000, engineCC: 998, powerBHP: 118, torqueNM: 172, mileageKMPL: 18.1, seats: 5 },
    ],
  },
  {
    brand: "Hyundai",
    model: "Exter",
    bodyType: "SUV",
    variants: [
      { name: "EX", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 581000, engineCC: 1197, powerBHP: 82, torqueNM: 114, mileageKMPL: 19.4, seats: 5 },
      { name: "S", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 715000, engineCC: 1197, powerBHP: 82, torqueNM: 114, mileageKMPL: 19.4, seats: 5 },
      { name: "S CNG Duo", fuel: "CNG", transmission: "MT", priceExShowroomINR: 795000, engineCC: 1197, powerBHP: 68, torqueNM: 95, mileageKMPL: 27.1, seats: 5 },
      { name: "SX(O) AMT", fuel: "Petrol", transmission: "AMT", priceExShowroomINR: 879000, engineCC: 1197, powerBHP: 82, torqueNM: 114, mileageKMPL: 19.2, seats: 5 },
    ],
  },
  {
    brand: "Hyundai",
    model: "i20",
    bodyType: "Hatchback",
    safetyRatingStars: 3,
    variants: [
      { name: "Magna", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 599000, engineCC: 1197, powerBHP: 82, torqueNM: 115, mileageKMPL: 20.35, seats: 5 },
      { name: "Sportz", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 735000, engineCC: 1197, powerBHP: 82, torqueNM: 115, mileageKMPL: 20.35, seats: 5 },
      { name: "Asta(O) IVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 930000, engineCC: 1197, powerBHP: 82, torqueNM: 115, mileageKMPL: 19.65, seats: 5 },
    ],
  },
  {
    brand: "Hyundai",
    model: "Verna",
    bodyType: "Sedan",
    safetyRatingStars: 5,
    variants: [
      { name: "EX 1.5 MPi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1036000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 18.6, seats: 5 },
      { name: "SX 1.5 MPi", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1230000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 18.6, seats: 5 },
      { name: "SX(O) 1.5 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1580000, engineCC: 1482, powerBHP: 158, torqueNM: 253, mileageKMPL: 18.9, seats: 5 },
    ],
  },

  // ───────────────────────── Honda ─────────────────────────
  {
    brand: "Honda",
    model: "City",
    bodyType: "Sedan",
    variants: [
      { name: "V MT", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1200000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 17.8, seats: 5 },
      { name: "VX CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1420000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 18.4, seats: 5 },
      { name: "ZX CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1530000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 18.4, seats: 5 },
      { name: "e:HEV ZX", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 2136000, engineCC: 1498, powerBHP: 125, torqueNM: 253, mileageKMPL: 26.5, seats: 5 },
    ],
  },
  {
    brand: "Honda",
    model: "Elevate",
    bodyType: "SUV",
    variants: [
      { name: "SV", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1181000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 15.31, seats: 5 },
      { name: "V", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1290000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 15.31, seats: 5 },
      { name: "ZX CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1646000, engineCC: 1498, powerBHP: 119, torqueNM: 145, mileageKMPL: 16.92, seats: 5 },
    ],
  },
  {
    brand: "Honda",
    model: "Amaze",
    bodyType: "Sedan",
    variants: [
      { name: "V MT", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 810000, engineCC: 1199, powerBHP: 89, torqueNM: 110, mileageKMPL: 18.65, seats: 5 },
      { name: "VX CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 995000, engineCC: 1199, powerBHP: 89, torqueNM: 110, mileageKMPL: 19.46, seats: 5 },
      { name: "ZX CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1120000, engineCC: 1199, powerBHP: 89, torqueNM: 110, mileageKMPL: 19.46, seats: 5 },
    ],
  },

  // ───────────────────────── Volkswagen ─────────────────────────
  {
    brand: "Volkswagen",
    model: "Virtus",
    bodyType: "Sedan",
    safetyRatingStars: 5,
    variants: [
      { name: "Comfortline 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1050000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.4, seats: 5 },
      { name: "Highline 1.0 TSI AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1350000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 18.12, seats: 5 },
      { name: "GT Plus Sport 1.5 TSI DSG", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1750000, engineCC: 1498, powerBHP: 148, torqueNM: 250, mileageKMPL: 18.67, seats: 5 },
    ],
  },
  {
    brand: "Volkswagen",
    model: "Taigun",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Comfortline 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1100000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.2, seats: 5 },
      { name: "Highline 1.0 TSI AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1450000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 17.88, seats: 5 },
      { name: "GT Plus Sport 1.5 TSI DSG", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1919000, engineCC: 1498, powerBHP: 148, torqueNM: 250, mileageKMPL: 17.75, seats: 5 },
    ],
  },

  // ───────────────────────── MG ─────────────────────────
  {
    brand: "MG",
    model: "Hector",
    bodyType: "SUV",
    variants: [
      { name: "Style 1.5 Turbo", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1199000, engineCC: 1451, powerBHP: 141, torqueNM: 250, mileageKMPL: 14.2, seats: 5 },
      { name: "Sharp Pro 1.5 Turbo CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1660000, engineCC: 1451, powerBHP: 141, torqueNM: 250, mileageKMPL: 13.6, seats: 5 },
      { name: "Sharp Pro 2.0 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1899000, engineCC: 1956, powerBHP: 168, torqueNM: 350, mileageKMPL: 17.4, seats: 5 },
    ],
  },
  {
    brand: "MG",
    model: "Astor",
    bodyType: "SUV",
    variants: [
      { name: "Sprint", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 979000, engineCC: 1498, powerBHP: 108, torqueNM: 144, mileageKMPL: 15.4, seats: 5 },
      { name: "Select CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1230000, engineCC: 1498, powerBHP: 108, torqueNM: 144, mileageKMPL: 14.6, seats: 5 },
      { name: "Savvy Pro CVT", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1530000, engineCC: 1498, powerBHP: 108, torqueNM: 144, mileageKMPL: 14.6, seats: 5 },
    ],
  },
  {
    brand: "MG",
    model: "Comet EV",
    bodyType: "Hatchback",
    variants: [
      { name: "Executive", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 763000, powerBHP: 41, torqueNM: 110, mileageKMPL: 230, seats: 4 },
      { name: "Exclusive FC", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 900000, powerBHP: 41, torqueNM: 110, mileageKMPL: 230, seats: 4 },
      { name: "Blackstorm", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1000000, powerBHP: 41, torqueNM: 110, mileageKMPL: 230, seats: 4 },
    ],
  },
  {
    brand: "MG",
    model: "Windsor EV",
    bodyType: "SUV",
    variants: [
      { name: "Excite", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1470000, powerBHP: 134, torqueNM: 200, mileageKMPL: 332, seats: 5 },
      { name: "Exclusive", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1580000, powerBHP: 134, torqueNM: 200, mileageKMPL: 332, seats: 5 },
      { name: "Essence Pro", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1700000, powerBHP: 134, torqueNM: 200, mileageKMPL: 449, seats: 5 },
    ],
  },

  // ───────────────────────── Tata ─────────────────────────
  {
    brand: "Tata",
    model: "Nexon",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Smart 1.2 Revotron", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 739000, engineCC: 1199, powerBHP: 118, torqueNM: 170, mileageKMPL: 17.44, seats: 5 },
      { name: "Creative iCNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 999000, engineCC: 1199, powerBHP: 99, torqueNM: 170, mileageKMPL: 24.07, seats: 5 },
      { name: "Creative+ DCA", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1130000, engineCC: 1199, powerBHP: 118, torqueNM: 170, mileageKMPL: 17.18, seats: 5 },
      { name: "Fearless+ PS 1.5 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1330000, engineCC: 1497, powerBHP: 113, torqueNM: 260, mileageKMPL: 23.23, seats: 5 },
    ],
  },
  {
    brand: "Tata",
    model: "Punch",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Pure", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 570000, engineCC: 1199, powerBHP: 87, torqueNM: 115, mileageKMPL: 20.09, seats: 5 },
      { name: "Adventure", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 660000, engineCC: 1199, powerBHP: 87, torqueNM: 115, mileageKMPL: 20.09, seats: 5 },
      { name: "Adventure iCNG", fuel: "CNG", transmission: "MT", priceExShowroomINR: 799000, engineCC: 1199, powerBHP: 73, torqueNM: 103, mileageKMPL: 26.99, seats: 5 },
      { name: "Creative+ AMT", fuel: "Petrol", transmission: "AMT", priceExShowroomINR: 890000, engineCC: 1199, powerBHP: 87, torqueNM: 115, mileageKMPL: 20.09, seats: 5 },
    ],
  },
  {
    brand: "Tata",
    model: "Curvv",
    bodyType: "Coupe",
    safetyRatingStars: 5,
    variants: [
      { name: "Smart 1.2 Revotron", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 976000, engineCC: 1199, powerBHP: 118, torqueNM: 170, mileageKMPL: 18.15, seats: 5 },
      { name: "Accomplished 1.5 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1330000, engineCC: 1497, powerBHP: 116, torqueNM: 260, mileageKMPL: 21.0, seats: 5 },
      { name: "Creative 45 EV", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1699000, powerBHP: 148, torqueNM: 215, mileageKMPL: 502, seats: 5 },
      { name: "Empowered+ A 55 EV", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 2150000, powerBHP: 165, torqueNM: 215, mileageKMPL: 585, seats: 5 },
    ],
  },
  {
    brand: "Tata",
    model: "Harrier",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Smart 2.0 Kryotec", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1299000, engineCC: 1956, powerBHP: 168, torqueNM: 350, mileageKMPL: 16.8, seats: 5 },
      { name: "Adventure+", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1550000, engineCC: 1956, powerBHP: 168, torqueNM: 350, mileageKMPL: 16.8, seats: 5 },
      { name: "Fearless+ AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 2300000, engineCC: 1956, powerBHP: 168, torqueNM: 350, mileageKMPL: 14.6, seats: 5 },
    ],
  },

  // ───────────────────────── Mahindra ─────────────────────────
  {
    brand: "Mahindra",
    model: "Scorpio-N",
    bodyType: "SUV",
    variants: [
      { name: "Z2 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1369000, engineCC: 1997, powerBHP: 200, torqueNM: 370, mileageKMPL: 13.0, seats: 7 },
      { name: "Z4 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1570000, engineCC: 2184, powerBHP: 130, torqueNM: 300, mileageKMPL: 15.4, seats: 7 },
      { name: "Z8 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 2130000, engineCC: 2184, powerBHP: 172, torqueNM: 400, mileageKMPL: 14.2, seats: 7 },
      { name: "Z8L Diesel AT 4XPLOR", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 2460000, engineCC: 2184, powerBHP: 172, torqueNM: 400, mileageKMPL: 14.2, seats: 7 },
    ],
  },
  {
    brand: "Mahindra",
    model: "XUV700",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "MX Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1366000, engineCC: 1997, powerBHP: 197, torqueNM: 380, mileageKMPL: 13.0, seats: 5 },
      { name: "AX5 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1720000, engineCC: 2198, powerBHP: 182, torqueNM: 450, mileageKMPL: 16.0, seats: 7 },
      { name: "AX7 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 2250000, engineCC: 2198, powerBHP: 182, torqueNM: 450, mileageKMPL: 14.7, seats: 7 },
      { name: "AX7L Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 2510000, engineCC: 2198, powerBHP: 182, torqueNM: 450, mileageKMPL: 14.7, seats: 7 },
    ],
  },
  {
    brand: "Mahindra",
    model: "Thar",
    bodyType: "SUV",
    safetyRatingStars: 4,
    variants: [
      { name: "AX(O) 1.5 Diesel RWD", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 999000, engineCC: 1497, powerBHP: 117, torqueNM: 300, mileageKMPL: 15.2, seats: 4 },
      { name: "LX 2.2 Diesel 4WD", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1480000, engineCC: 2184, powerBHP: 130, torqueNM: 300, mileageKMPL: 15.2, seats: 4 },
      { name: "LX 2.0 Petrol AT 4WD", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1570000, engineCC: 1997, powerBHP: 150, torqueNM: 320, mileageKMPL: 12.4, seats: 4 },
    ],
  },
  {
    brand: "Mahindra",
    model: "BE 6",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Pack One 59 kWh", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 1890000, powerBHP: 228, torqueNM: 380, mileageKMPL: 557, seats: 5 },
      { name: "Pack Two 79 kWh", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 2250000, powerBHP: 281, torqueNM: 380, mileageKMPL: 683, seats: 5 },
      { name: "Pack Three 79 kWh", fuel: "Electric", transmission: "Single Speed", priceExShowroomINR: 2530000, powerBHP: 281, torqueNM: 380, mileageKMPL: 683, seats: 5 },
    ],
  },

  // ───────────────────────── Kia ─────────────────────────
  {
    brand: "Kia",
    model: "Seltos",
    bodyType: "SUV",
    variants: [
      { name: "HTE 1.5 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1099000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 17.0, seats: 5 },
      { name: "HTK+ 1.5 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1350000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 17.0, seats: 5 },
      { name: "HTX 1.5 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 1750000, engineCC: 1493, powerBHP: 114, torqueNM: 250, mileageKMPL: 19.1, seats: 5 },
      { name: "GTX+ 1.5 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 2050000, engineCC: 1482, powerBHP: 158, torqueNM: 253, mileageKMPL: 17.9, seats: 5 },
    ],
  },
  {
    brand: "Kia",
    model: "Sonet",
    bodyType: "SUV",
    variants: [
      { name: "HTE 1.2 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 741000, engineCC: 1197, powerBHP: 82, torqueNM: 115, mileageKMPL: 18.4, seats: 5 },
      { name: "HTK+ 1.2 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 950000, engineCC: 1197, powerBHP: 82, torqueNM: 115, mileageKMPL: 18.4, seats: 5 },
      { name: "HTX+ 1.5 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 1250000, engineCC: 1493, powerBHP: 114, torqueNM: 250, mileageKMPL: 17.3, seats: 5 },
      { name: "GTX+ 1.0 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1447000, engineCC: 998, powerBHP: 118, torqueNM: 172, mileageKMPL: 18.7, seats: 5 },
    ],
  },
  {
    brand: "Kia",
    model: "Carens",
    bodyType: "MPV",
    variants: [
      { name: "Premium 1.5 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 950000, engineCC: 1497, powerBHP: 113, torqueNM: 144, mileageKMPL: 16.2, seats: 7 },
      { name: "Prestige+ 1.5 Diesel", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1250000, engineCC: 1493, powerBHP: 114, torqueNM: 250, mileageKMPL: 21.3, seats: 7 },
      { name: "Luxury+ 1.5 Turbo DCT", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1650000, engineCC: 1482, powerBHP: 158, torqueNM: 253, mileageKMPL: 17.9, seats: 7 },
    ],
  },

  // ───────────────────────── Toyota ─────────────────────────
  {
    brand: "Toyota",
    model: "Urban Cruiser Hyryder",
    bodyType: "SUV",
    variants: [
      { name: "E Neo Drive", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1095000, engineCC: 1462, powerBHP: 102, torqueNM: 137, mileageKMPL: 21.11, seats: 5 },
      { name: "S CNG Neo Drive", fuel: "CNG", transmission: "MT", priceExShowroomINR: 1330000, engineCC: 1462, powerBHP: 87, torqueNM: 122, mileageKMPL: 26.6, seats: 5 },
      { name: "S Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 1520000, engineCC: 1490, powerBHP: 115, torqueNM: 122, mileageKMPL: 27.97, seats: 5 },
      { name: "V Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 1969000, engineCC: 1490, powerBHP: 115, torqueNM: 122, mileageKMPL: 27.97, seats: 5 },
    ],
  },
  {
    brand: "Toyota",
    model: "Innova Hycross",
    bodyType: "MPV",
    variants: [
      { name: "GX 8-Seater", fuel: "Petrol", transmission: "CVT", priceExShowroomINR: 1953000, engineCC: 1987, powerBHP: 172, torqueNM: 205, mileageKMPL: 16.13, seats: 8 },
      { name: "VX Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 2650000, engineCC: 1987, powerBHP: 183, torqueNM: 206, mileageKMPL: 23.24, seats: 7 },
      { name: "ZX(O) Hybrid", fuel: "Hybrid", transmission: "eCVT", priceExShowroomINR: 3295000, engineCC: 1987, powerBHP: 183, torqueNM: 206, mileageKMPL: 23.24, seats: 7 },
    ],
  },
  {
    brand: "Toyota",
    model: "Innova Crysta",
    bodyType: "MPV",
    variants: [
      { name: "GX 7-Seater", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 1972000, engineCC: 2393, powerBHP: 148, torqueNM: 343, mileageKMPL: 15.6, seats: 7 },
      { name: "VX 7-Seater", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 2380000, engineCC: 2393, powerBHP: 148, torqueNM: 343, mileageKMPL: 15.6, seats: 7 },
      { name: "ZX 7-Seater", fuel: "Diesel", transmission: "MT", priceExShowroomINR: 2677000, engineCC: 2393, powerBHP: 148, torqueNM: 343, mileageKMPL: 15.6, seats: 7 },
    ],
  },
  {
    brand: "Toyota",
    model: "Fortuner",
    bodyType: "SUV",
    variants: [
      { name: "4x2 2.7 Petrol", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 3416000, engineCC: 2694, powerBHP: 164, torqueNM: 245, mileageKMPL: 10.01, seats: 7 },
      { name: "4x4 2.8 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 4450000, engineCC: 2755, powerBHP: 201, torqueNM: 500, mileageKMPL: 10.26, seats: 7 },
      { name: "GR Sport 4x4 Diesel AT", fuel: "Diesel", transmission: "AT", priceExShowroomINR: 4959000, engineCC: 2755, powerBHP: 201, torqueNM: 500, mileageKMPL: 10.26, seats: 7 },
    ],
  },

  // ───────────────────────── Skoda ─────────────────────────
  {
    brand: "Skoda",
    model: "Kylaq",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Classic 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 759000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.68, seats: 5 },
      { name: "Signature 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 950000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.68, seats: 5 },
      { name: "Prestige 1.0 TSI AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1299000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.05, seats: 5 },
    ],
  },
  {
    brand: "Skoda",
    model: "Kushaq",
    bodyType: "SUV",
    safetyRatingStars: 5,
    variants: [
      { name: "Classic 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 1069000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.76, seats: 5 },
      { name: "Signature 1.0 TSI AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1420000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 18.86, seats: 5 },
      { name: "Prestige 1.5 TSI DSG", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1899000, engineCC: 1498, powerBHP: 148, torqueNM: 250, mileageKMPL: 19.76, seats: 5 },
    ],
  },
  {
    brand: "Skoda",
    model: "Slavia",
    bodyType: "Sedan",
    safetyRatingStars: 5,
    variants: [
      { name: "Classic 1.0 TSI", fuel: "Petrol", transmission: "MT", priceExShowroomINR: 999000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 19.47, seats: 5 },
      { name: "Signature 1.0 TSI AT", fuel: "Petrol", transmission: "AT", priceExShowroomINR: 1400000, engineCC: 999, powerBHP: 114, torqueNM: 178, mileageKMPL: 18.07, seats: 5 },
      { name: "Prestige 1.5 TSI DSG", fuel: "Petrol", transmission: "DCT", priceExShowroomINR: 1799000, engineCC: 1498, powerBHP: 148, torqueNM: 250, mileageKMPL: 18.72, seats: 5 },
    ],
  },
];

export function modelsByBrand(brand: string): CarModel[] {
  return carCatalog.filter((c) => c.brand === brand);
}

export function findModel(brand: string, model: string): CarModel | undefined {
  return carCatalog.find((c) => c.brand === brand && c.model === model);
}
