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

const elevateSource: Source = { label: "Honda India", url: "https://www.hondacarindia.com/web-data/brochures/pdfs/Honda%20Elevate%2018Nov25.pdf" };
const cretaSource: Source = { label: "Hyundai India", url: "https://www.hyundai.com/in/en/find-a-car/creta/features" };
const taigunSource: Source = { label: "Volkswagen India", url: "https://www.volkswagen.co.in/en/models/taigun.html/__layer/layers/specifications/taigun/master.layer" };
const virtusSource: Source = { label: "Volkswagen India", url: "https://www.volkswagen.co.in/en/models/virtus.html/__layer/layers/specifications/virtus/virtus-chrome-technical-specifications.layer" };
const kushaqSource: Source = { label: "Skoda India", url: "https://www.skoda-auto.co.in/_doc/c1ef59c1-8c19-4a0c-969a-cc90a26a9187" };
const slaviaSource: Source = { label: "Skoda India", url: "https://www.skoda-auto.co.in/news/news-detail/the-new-skoda-slavia-says-it-all-with-confidence" };
const exterSource: Source = { label: "Hyundai India", url: "https://www.hyundai.com/content/dam/hyundai/in/en/data/brochure/exter.pdf" };
const kigerSource: Source = { label: "Renault India", url: "https://www.renault.co.in/cars/renault-kiger/configurator.html" };
const nexonSource: Source = { label: "Tata Motors", url: "https://cars.tatamotors.com/content/dam/tml/pv/products/nexon/year-2025/ice/promoting-vc/brochures/jan-2025/nexon-brochure-jan.pdf" };
const punchSource: Source = { label: "Tata Motors", url: "https://cars.tatamotors.com/content/dam/tml/pv/products/punch/year-2025/ice/promoting-vc/brochures/2025/january/punch-main-brochure.pdf" };
const brezzaSource: Source = { label: "Maruti Suzuki India", url: "https://www.marutisuzuki.com/content/dam/msil/arena/in/en/assets/cars/brezza/final-new-brezza/brochure/The-New-Brezza-Brochure.pdf" };
const balenoSource: Source = { label: "Maruti Suzuki India", url: "https://www.nexaexperience.com/content/dam/msil/nexa/in/en/assets/cars/baleno/documents/NEXA-Baleno-Brochure.pdf" };
const cretaBrochureSource: Source = { label: "Hyundai India", url: "https://www.hyundai.com/content/dam/hyundai/in/en/data/brochure/creta.pdf" };
const scorpioNSource: Source = { label: "Mahindra Auto", url: "https://auto.mahindra.com/suv/scorpio-n-z8-l-diesel/SCNM097918082295.html" };
const seltosSource: Source = { label: "Kia India", url: "https://www.kia.com/in/our-vehicles/seltos/specs.html" };
const sonetSource: Source = { label: "Kia India", url: "https://www.kia.com/in/our-vehicles/sonet/specs.html" };
const grandVitaraSource: Source = { label: "Maruti Suzuki India", url: "https://www.nexaexperience.com/content/dam/msil/nexa/in/en/assets/cars/grand-vitara/sigma/documents/NEXA-Grand-Vitara-brochure.pdf" };
const hycrossSource: Source = { label: "Toyota India", url: "https://www.toyotabharat.com/documents/brochures/e-brochure-hycross-spec.pdf" };
const fronxSource: Source = { label: "Maruti Suzuki India", url: "https://www.nexaexperience.com/content/dam/msil/nexa/in/en/assets/cars/fronx/documents/NEXA-Fronx-Brochure.pdf" };
const hyryderSource: Source = { label: "Toyota India", url: "https://www.toyotabharat.com/documents/brochures/e-brochure-urbancruiser-hyryder-spec.pdf" };
const xuv3xoSource: Source = { label: "Mahindra Auto", url: "https://auto.mahindra.com/suv/xuv3xo-mx1-petrol/X3XOM103418095737.html" };
const hectorSource: Source = { label: "MG Motor India", url: "https://www.mgmotor.co.in/vehicles/mghector" };
const taigunCommon = {
  fuel: "Petrol", steering: "Electromechanical power steering", frontBrakes: "Disc", frontSuspension: "McPherson strut with stabiliser bar",
  rearSuspension: "Twist beam axle", length: "4,221 mm", width: "1,760 mm", height: "1,612 mm", wheelbase: "2,651 mm",
  boot: "385 L", fuelTank: "50 L",
};
const virtusCommon = {
  fuel: "Petrol", steering: "Electromechanical power steering", frontBrakes: "Disc", rearBrakes: "Drum",
  frontSuspension: "McPherson strut with stabiliser bar", rearSuspension: "Twist beam axle",
  length: "4,561 mm", width: "1,752 mm", height: "1,507 mm", wheelbase: "2,651 mm", boot: "521 L", groundClearance: "179 mm (unladen)",
  fuelTank: "45 L", wheels: "16-inch (205/55 R16)",
};
const elevateCommon = {
  engine: "1.5L i-VTEC petrol", displacement: "1,498 cc", power: "121 PS @ 6,600 rpm", torque: "145 Nm @ 4,300 rpm",
  fuel: "Petrol", fuelTank: "40 L", steering: "Electric power steering",
  frontSuspension: "McPherson strut with coil spring", rearSuspension: "Torsion beam with coil spring",
  frontBrakes: "Ventilated disc", rearBrakes: "Drum", length: "4,312 mm", width: "1,790 mm", height: "1,650 mm",
  wheelbase: "2,650 mm", groundClearance: "220 mm", boot: "458 L", climate: "Automatic", rearAc: "Yes",
  headlamps: "LED projector", airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes",
};
const exterCommon = {
  engine: "1.2L Kappa petrol", displacement: "1,197 cc", power: "83 PS @ 6,000 rpm", torque: "113.8 Nm @ 4,000 rpm",
  fuel: "Petrol", fuelTank: "37 L", frontSuspension: "McPherson strut with coil spring",
  rearSuspension: "Coupled torsion beam with coil spring", frontBrakes: "Disc", rearBrakes: "Drum",
  length: "3,830 mm", width: "1,723 mm", wheelbase: "2,450 mm",
};
const kushaqCommon = {
  drive: "Front-wheel drive", fuel: "Petrol", fuelTank: "50 L", steering: "Electromechanical power steering",
  frontSuspension: "McPherson strut with stabiliser bar", rearSuspension: "Twist beam axle",
  frontBrakes: "Disc", length: "4,229 mm", width: "1,760 mm", height: "1,612 mm", wheelbase: "2,651 mm",
  groundClearance: "155 mm (laden)", boot: "385 L", climate: "Automatic", rearAc: "Yes",
  headlamps: "LED", airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes",
};
const grandVitaraCommon = {
  seats: "5", length: "4,345 mm", width: "1,795 mm", height: "1,645 mm", wheelbase: "2,600 mm", fuelTank: "45 L",
  frontSuspension: "MacPherson strut", rearSuspension: "Torsion beam", frontBrakes: "Disc", rearBrakes: "Disc",
  climate: "Automatic", rearAc: "Yes", rearArmrest: "Yes", airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes",
};
const hycrossCommon = {
  seats: "7", engine: "2.0L TNGA petrol", displacement: "1,987 cc", fuelTank: "52 L", length: "4,755 mm", wheelbase: "2,850 mm",
  frontSuspension: "MacPherson strut", rearSuspension: "Semi-independent torsion beam", frontBrakes: "Disc", rearBrakes: "Disc",
  airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes", rearAc: "Yes", rearArmrest: "Yes",
};
const fronxCommon = {
  seats: "5", fuel: "Petrol", fuelTank: "37 L", length: "3,995 mm", width: "1,765 mm", height: "1,550 mm", wheelbase: "2,520 mm",
  boot: "308 L", frontSuspension: "MacPherson strut", rearSuspension: "Torsion beam", frontBrakes: "Disc", rearBrakes: "Drum",
  airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes",
};
const hyryderCommon = {
  seats: "5", length: "4,365 mm", width: "1,795 mm", height: "1,645 mm", wheelbase: "2,600 mm", fuelTank: "45 L",
  frontSuspension: "MacPherson strut", rearSuspension: "Torsion beam", frontBrakes: "Ventilated disc", rearBrakes: "Solid disc",
  airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes",
};

// Only facts supported for these exact selections are included. A blank means unverified, not absent.
const verifiedVariants: Record<string, SpecRecord> = {
  "Tata|Nexon|Smart Petrol MT": {
    source: nexonSource,
    values: {
      engine: "1.2L turbocharged Revotron petrol", displacement: "1,199 cc", power: "88.2 kW @ 5,500 rpm", torque: "170 Nm @ 1,750-4,000 rpm",
      transmission: "5-speed manual", fuel: "Petrol", fuelTank: "44 L", frontSuspension: "Independent lower wishbone McPherson strut with coil spring",
      rearSuspension: "Semi-independent twist beam with stabilizer bar, coil spring and shock absorber", frontBrakes: "Disc", rearBrakes: "Drum",
      length: "3,995 mm", width: "1,804 mm", height: "1,620 mm", wheelbase: "2,498 mm", boot: "382 L (ISO V215)",
      airbags: "6", esc: "Yes", isofix: "Yes", wheels: "16-inch (195/60 R16)", headlamps: "LED", climate: "Air conditioning",
    },
  },
  "Tata|Punch|Pure Petrol MT": {
    source: punchSource,
    values: {
      engine: "1.2L Revotron petrol", displacement: "1,199 cc", power: "87.8 PS @ 6,000 rpm", torque: "115 Nm @ 3,250 +/- 100 rpm",
      transmission: "5-speed manual", fuel: "Petrol", fuelTank: "37 L", frontSuspension: "Independent lower wishbone McPherson strut with coil spring",
      rearSuspension: "Semi-independent twist beam with coil spring and shock absorber", frontBrakes: "Disc", rearBrakes: "Drum",
      length: "3,827 mm", width: "1,742 mm", height: "1,615 mm", wheelbase: "2,445 mm", groundClearance: "187 mm (unladen)", boot: "366 L (ISO V215)",
      wheels: "15-inch (185/70 R15)", esc: "Yes",
    },
  },
  "Maruti Suzuki|Brezza|ZXi+ Petrol AT": {
    source: brezzaSource,
    values: {
      engine: "1.5L K15C petrol ISG", displacement: "1,462 cc", power: "75.8 kW @ 6,000 rpm", torque: "139 Nm @ 4,400 rpm",
      transmission: "6-speed automatic", fuel: "Petrol", mileage: "20.17 km/l", fuelTank: "48 L", frontSuspension: "MacPherson strut",
      rearSuspension: "Torsion beam", frontBrakes: "Ventilated disc", rearBrakes: "Drum", length: "3,995 mm", width: "1,790 mm",
      height: "1,685 mm (unladen)", wheelbase: "2,500 mm", climate: "Automatic", cruise: "Yes", sunroof: "Electric",
      rearAc: "Yes", wirelessCharger: "Yes", rearArmrest: "Yes", instrumentCluster: "Colour TFT MID", headlamps: "LED projector",
      wheels: "16-inch alloy (215/60 R16)", airbags: "6", esc: "Yes", isofix: "Yes", tpms: "Yes", connectedCar: "Next Gen Suzuki Connect",
      ota: "Infotainment", touchscreen: "10.1-inch", smartphone: "Wireless Android Auto and Apple CarPlay", speakers: "4 plus 2 tweeters", bluetooth: "Yes",
    },
  },
  "Maruti Suzuki|Baleno|Sigma Petrol MT": {
    source: balenoSource,
    values: {
      engine: "1.2L K-series Dual Jet Dual VVT petrol", displacement: "1,197 cc", power: "66 kW @ 6,000 rpm", torque: "113 Nm @ 4,400 rpm",
      transmission: "5-speed manual", fuel: "Petrol", mileage: "22.35 km/l", fuelTank: "37 L", steering: "Electric rack-and-pinion",
      frontSuspension: "MacPherson strut", rearSuspension: "Torsion beam", frontBrakes: "Disc", rearBrakes: "Drum",
      length: "3,990 mm", width: "1,745 mm", height: "1,500 mm (unladen)", wheelbase: "2,520 mm", boot: "318 L",
      headlamps: "Halogen projector", wheels: "15-inch steel (185/65 R15)", airbags: "6", esc: "Yes", isofix: "Yes",
      climate: "Automatic", instrumentCluster: "Segment MID", touchscreen: "No", smartphone: "No", speakers: "No",
      rearAc: "No", cruise: "No", connectedCar: "No",
    },
  },
  "Kia|Seltos|HTX Petrol IVT": {
    source: seltosSource,
    values: {
      seats: "5", engine: "Smartstream G1.5 petrol", transmission: "IVT", fuel: "Petrol", fuelTank: "47 L",
      length: "4,460 mm", width: "1,830 mm", height: "1,635 mm", wheelbase: "2,690 mm", boot: "447 L",
      climate: "Dual-zone automatic", cruise: "Yes", sunroof: "Dual-pane panoramic", rearAc: "Yes", wirelessCharger: "Yes",
      headlamps: "Ice Cube MFR LED", wheels: "17-inch crystal-cut alloy", airbags: "6", esc: "Yes", isofix: "Yes",
      connectedCar: "Kia Connect 2.0", ota: "Software updates", touchscreen: "12.3-inch", smartphone: "Wireless Android Auto and Apple CarPlay",
      speakers: "8 (Bose)", bluetooth: "Yes",
    },
  },
  "Kia|Sonet|GTX+ DCT": {
    source: sonetSource,
    values: {
      engine: "Smartstream G1.0 T-GDi petrol", transmission: "7-speed DCT", fuel: "Petrol",
      length: "3,995 mm", width: "1,790 mm", height: "1,642 mm", wheelbase: "2,500 mm", boot: "385 L",
      sunroof: "Electric", headlamps: "Crown Jewel LED", wheels: "16-inch sporty crystal-cut alloy",
      airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes", connectedCar: "Kia Connect", ota: "Map updates",
      touchscreen: "10.25-inch navigation", smartphone: "Wired Android Auto and Apple CarPlay", speakers: "7 (Bose)", bluetooth: "Yes",
    },
  },
  "Maruti Suzuki|Grand Vitara|Sigma Smart Hybrid MT": {
    source: grandVitaraSource,
    values: {
      ...grandVitaraCommon, engine: "1.5L petrol Smart Hybrid", displacement: "1,462 cc", power: "75.8 kW @ 6,000 rpm",
      torque: "139 Nm @ 4,300 rpm", transmission: "5-speed manual", drive: "2WD", fuel: "Petrol", mileage: "21.11 km/l",
      sunroof: "No", cruise: "No", wirelessCharger: "No", instrumentCluster: "4.2-inch colour TFT MID",
      headlamps: "Bi-halogen projector", wheels: "17-inch steel (215/60 R17)", tpms: "No", connectedCar: "No", touchscreen: "No", speakers: "No",
    },
  },
  "Maruti Suzuki|Grand Vitara|Alpha+ Hybrid e-CVT": {
    source: grandVitaraSource,
    values: {
      ...grandVitaraCommon, engine: "1.5L strong hybrid petrol", displacement: "1,490 cc", power: "85 kW (combined system)",
      torque: "122 Nm @ 3,800-4,800 rpm (engine)", transmission: "e-CVT", drive: "2WD", fuel: "Petrol hybrid", mileage: "27.97 km/l",
      sunroof: "No", cruise: "Yes", wirelessCharger: "Yes", instrumentCluster: "7-inch colour TFT MID", upholstery: "Leatherette",
      headlamps: "LED projector", wheels: "17-inch machined alloy (215/60 R17)", tpms: "Yes", connectedCar: "Suzuki Connect",
      touchscreen: "9-inch", speakers: "4 plus 2 tweeters",
    },
  },
  "Toyota|Innova Hycross|GX 7S Petrol CVT": {
    source: hycrossSource,
    values: {
      ...hycrossCommon, power: "126 kW", torque: "204 Nm", transmission: "Direct Shift CVT with sequential shift", fuel: "Petrol",
      width: "1,845 mm", height: "1,785 mm", climate: "Manual AC", cruise: "No", sunroof: "No", upholstery: "Black fabric",
      wheels: "16-inch alloy (205/65 R16)", speakers: "4", connectedCar: "Toyota telematics",
      collisionAssist: "No", laneAssist: "No", adaptiveCruise: "No", highBeamAssist: "No",
    },
  },
  "Toyota|Innova Hycross|ZX(O) Hybrid": {
    source: hycrossSource,
    values: {
      ...hycrossCommon, torque: "191 Nm (engine)", transmission: "e-Drive with sequential shift", fuel: "Petrol hybrid",
      width: "1,850 mm", height: "1,790 mm", climate: "Automatic", cruise: "Adaptive", sunroof: "Panoramic",
      upholstery: "Quilted art leather", wheels: "18-inch alloy (225/50 R18)", speakers: "9 (JBL)", connectedCar: "Toyota telematics",
      collisionAssist: "Toyota Safety Sense pre-collision system", laneAssist: "Toyota Safety Sense lane trace assist",
      adaptiveCruise: "Dynamic radar cruise control", highBeamAssist: "Yes",
    },
  },
  "Maruti Suzuki|Fronx|Sigma 1.2 MT": {
    source: fronxSource,
    values: {
      ...fronxCommon, engine: "1.2L K-series Dual Jet Dual VVT petrol", displacement: "1,197 cc", power: "66 kW @ 6,000 rpm",
      torque: "113 Nm @ 4,400 rpm", transmission: "5-speed manual", mileage: "21.79 km/l", headlamps: "Halogen projector",
      wheels: "16-inch steel (195/60 R16)", cruise: "No", wirelessCharger: "No", touchscreen: "No", smartphone: "No", speakers: "No", connectedCar: "No",
    },
  },
  "Maruti Suzuki|Fronx|Turbo Alpha AT": {
    source: fronxSource,
    values: {
      ...fronxCommon, engine: "1.0L Turbo Boosterjet petrol", displacement: "998 cc", power: "73.6 kW @ 5,500 rpm",
      torque: "147.6 Nm @ 2,000-4,500 rpm", transmission: "6-speed automatic", mileage: "20.01 km/l",
      climate: "Automatic", cruise: "Yes", wirelessCharger: "Yes", headlamps: "LED multi-reflector", connectedCar: "Next Gen Suzuki Connect",
      wheels: "16-inch precision-cut alloy (195/60 R16)", ota: "Yes", touchscreen: "9-inch", smartphone: "Wireless Android Auto and Apple CarPlay", speakers: "4 plus 2 tweeters", bluetooth: "Yes",
    },
  },
  "Toyota|Hyryder|S NeoDrive MT": {
    source: hyryderSource,
    values: {
      ...hyryderCommon, engine: "1.5L K-series petrol with ISG", displacement: "1,462 cc", power: "75.8 kW @ 6,000 rpm",
      torque: "136.8 Nm @ 4,400 rpm", transmission: "5-speed manual", drive: "2WD", fuel: "Petrol", mileage: "21.12 km/l",
      headlamps: "Bi-halogen projector", wheels: "17-inch steel (215/60 R17)",
    },
  },
  "Toyota|Hyryder|V Hybrid e-CVT": {
    source: hyryderSource,
    values: {
      ...hyryderCommon, engine: "1.5L TNGA strong hybrid petrol", displacement: "1,490 cc", power: "85 kW (combined system)",
      torque: "122 Nm @ 4,400-4,800 rpm (engine)", transmission: "e-Drive", drive: "2WD", fuel: "Petrol hybrid", mileage: "27.97 km/l",
      headlamps: "LED projector", wheels: "17-inch machined alloy (215/60 R17)",
    },
  },
  "Mahindra|XUV 3XO|MX1 Petrol MT": {
    source: xuv3xoSource,
    values: {
      seats: "5", engine: "1.2L turbo petrol with multipoint injection", displacement: "1,197 cc", power: "82 kW @ 5,000 rpm",
      torque: "200 Nm @ 1,500-3,500 rpm", transmission: "Manual", drive: "2WD", fuel: "Petrol", fuelTank: "42 L",
      frontSuspension: "MacPherson strut with anti-roll bar", rearSuspension: "Twist beam with coil spring", frontBrakes: "Disc", rearBrakes: "Disc",
      length: "3,990 mm", width: "1,821 mm", height: "1,647 mm (with ski rack)", wheelbase: "2,600 mm", boot: "364 L",
      airbags: "6", upholstery: "Fabric", wheels: "16-inch (205/65 R16)", speakers: "No",
    },
  },
  "MG|Hector|Style Petrol MT": {
    source: hectorSource,
    values: {
      seats: "5", engine: "1.5L turbocharged intercooled petrol", power: "143 PS @ 5,200 +/- 200 rpm", torque: "250 Nm @ 3,000 +/- 200 rpm",
      transmission: "6-speed manual", fuel: "Petrol", fuelTank: "60 L", frontSuspension: "McPherson strut with coil springs",
      rearSuspension: "Beam assembly with coil spring", frontBrakes: "Disc", rearBrakes: "Disc",
      length: "4,655 mm", width: "1,835 mm", height: "1,760 mm", wheelbase: "2,750 mm", wheels: "17-inch (215/60 R17)", airbags: "6",
    },
  },
  "Honda|Elevate|SV Petrol MT": {
    source: elevateSource,
    values: { ...elevateCommon, transmission: "6-speed manual", mileage: "15.31 km/l", sunroof: "No", wheels: "16-inch steel", upholstery: "Fabric", wirelessCharger: "No", rearArmrest: "No", collisionAssist: "No", laneAssist: "No", adaptiveCruise: "No", highBeamAssist: "No" },
  },
  "Honda|Elevate|ZX CVT": {
    source: elevateSource,
    values: { ...elevateCommon, transmission: "CVT", mileage: "16.92 km/l", sunroof: "Electric", wheels: "17-inch alloy", upholstery: "Leatherette", wirelessCharger: "Yes", rearArmrest: "Yes", collisionAssist: "Honda SENSING CMBS", laneAssist: "Honda SENSING LKAS", adaptiveCruise: "Honda SENSING ACC", highBeamAssist: "Yes", touchscreen: "10.25-inch", speakers: "8", connectedCar: "Honda Connect", smartphone: "Wireless Android Auto and Apple CarPlay", bluetooth: "Yes", remoteStart: "Yes" },
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
  "Hyundai|Creta|SX Premium Petrol IVT": {
    source: cretaBrochureSource,
    values: {
      engine: "1.5L MPi petrol", displacement: "1,497 cc", power: "84.4 kW (115 PS) @ 6,300 rpm", torque: "143.8 Nm @ 4,500 rpm",
      transmission: "IVT", fuel: "Petrol", fuelTank: "50 L", frontSuspension: "McPherson strut with coil spring", rearSuspension: "Coupled torsion beam axle",
      frontBrakes: "Disc", rearBrakes: "Disc", length: "4,330 mm", width: "1,790 mm", height: "1,635 mm (with roof rails)", wheelbase: "2,610 mm",
      climate: "Dual-zone automatic", cruise: "Yes", sunroof: "Voice-enabled panoramic", rearAc: "Yes", wirelessCharger: "Yes",
      upholstery: "Leather", instrumentCluster: "10.25-inch digital", rearArmrest: "Yes", headlamps: "Quad-beam LED", wheels: "17-inch alloy (215/60 R17)",
      airbags: "6", abs: "Yes with EBD", esc: "Yes", isofix: "Yes", tpms: "Yes", collisionAssist: "No", laneAssist: "No",
      adaptiveCruise: "No", highBeamAssist: "No", connectedCar: "Hyundai Bluelink", ota: "Maps and infotainment", remoteStart: "Yes",
      touchscreen: "10.25-inch navigation", smartphone: "Wireless Android Auto and Apple CarPlay (via adaptor)", speakers: "8", bluetooth: "Yes",
    },
  },
  "Mahindra|Scorpio N|Z8L Diesel AT 4WD": {
    source: scorpioNSource,
    values: {
      seats: "7", engine: "mHawk common-rail diesel", power: "128.6 kW @ 3,500 rpm", torque: "400 Nm @ 1,750-2,750 rpm",
      transmission: "Automatic", drive: "4WD", fuel: "Diesel", fuelTank: "57 L", frontSuspension: "Double wishbone with coil-over shocks, FDD and MTV-CL",
      rearSuspension: "Pentalink with Watt's linkage, FDD and MTV-CL", frontBrakes: "Disc", rearBrakes: "Disc",
      length: "4,662 mm", width: "1,917 mm", height: "1,857 mm", wheelbase: "2,750 mm",
      wheels: "18-inch (255/60 R18)", airbags: "6", touchscreen: "12.3-inch", speakers: "12",
    },
  },
  "Volkswagen|Taigun|Comfortline 1.0 TSI MT": {
    source: taigunSource,
    values: { ...taigunCommon, engine: "1.0L TSI", displacement: "999 cc", power: "115 PS @ 5,000-5,500 rpm", torque: "178 Nm @ 1,850-4,000 rpm", transmission: "6-speed manual", rearBrakes: "Drum", mileage: "19.98 km/l", wheels: "16-inch (205/60 R16)" },
  },
  "Volkswagen|Taigun|GT Plus 1.5 DSG": {
    source: taigunSource,
    values: { ...taigunCommon, engine: "1.5L TSI Evo with ACT", displacement: "1,498 cc", power: "150 PS @ 5,000-6,000 rpm", torque: "250 Nm @ 1,600-3,500 rpm", transmission: "7-speed DSG", rearBrakes: "Disc", mileage: "18.85 km/l", wheels: "17-inch (205/55 R17)" },
  },
  "Volkswagen|Virtus|Comfortline 1.0 TSI MT": {
    source: virtusSource,
    values: { ...virtusCommon, engine: "1.0L TSI", displacement: "999 cc", power: "115 PS @ 5,000-5,500 rpm", torque: "178 Nm @ 1,750-4,000 rpm", transmission: "6-speed manual", mileage: "20.19 km/l" },
  },
  "Volkswagen|Virtus|GT Plus 1.5 DSG": {
    source: virtusSource,
    values: { ...virtusCommon, engine: "1.5L TSI Evo with ACT", displacement: "1,498 cc", power: "150 PS @ 5,000-6,000 rpm", torque: "250 Nm @ 1,600-3,500 rpm", transmission: "7-speed DSG", mileage: "19.62 km/l" },
  },
  "Skoda|Kushaq|Classic+ 1.0 TSI MT": {
    source: kushaqSource,
    values: { ...kushaqCommon, engine: "1.0L TSI turbo petrol", displacement: "999 cc", power: "85 kW @ 5,000-5,500 rpm", torque: "178 Nm @ 1,750-4,000 rpm", transmission: "6-speed manual", mileage: "19.66 km/l (ARAI)", rearBrakes: "Drum", sunroof: "Electric", wheels: "16-inch alloy", upholstery: "Fabric", tpms: "No", rearArmrest: "No", instrumentCluster: "Analogue dials with monochrome display", touchscreen: "7-inch", speakers: "6", smartphone: "Wired Android Auto and Apple CarPlay", wirelessCharger: "No" },
  },
  "Skoda|Kushaq|Prestige 1.5 TSI DSG": {
    source: kushaqSource,
    values: { ...kushaqCommon, engine: "1.5L TSI turbo petrol", displacement: "1,498 cc", power: "110 kW @ 5,000-6,000 rpm", torque: "250 Nm @ 1,600-3,500 rpm", transmission: "7-speed DSG", mileage: "18.72 km/l (ARAI)", rearBrakes: "Disc", sunroof: "Panoramic", instrumentCluster: "10.25-inch digital", upholstery: "Leatherette", wheels: "17-inch alloy", tpms: "Yes", rearArmrest: "Yes", touchscreen: "10.1-inch", smartphone: "Wireless Android Auto and Apple CarPlay", wirelessCharger: "Yes", speakers: "6 with subwoofer and amplifier" },
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
    values: { ...exterCommon, transmission: "5-speed manual", airbags: "6", abs: "Yes", esc: "Yes", isofix: "Yes", tpms: "No", sunroof: "No", cruise: "No", rearAc: "No", wirelessCharger: "No", climate: "Manual AC", upholstery: "Fabric", instrumentCluster: "Colour TFT MID", connectedCar: "No", ota: "No", touchscreen: "No", smartphone: "No", speakers: "No", wheels: "14-inch steel" },
  },
  "Hyundai|Exter|HX 10 Petrol AMT": {
    source: exterSource,
    values: { ...exterCommon, height: "1,643 mm (with roof rails)", transmission: "5-speed AMT", airbags: "6", abs: "Yes", esc: "Yes", isofix: "Yes", tpms: "Yes", sunroof: "Electric", cruise: "Yes", rearAc: "Yes", wirelessCharger: "Yes", climate: "Automatic", instrumentCluster: "Colour TFT MID", connectedCar: "Hyundai Bluelink", ota: "Maps and infotainment", touchscreen: "8-inch navigation", smartphone: "Wireless Android Auto and Apple CarPlay (via adaptor)", speakers: "Front and rear", wheels: "15-inch diamond-cut alloy" },
  },
  "Renault|Kiger|Authentic 1.0 MT": {
    source: kigerSource,
    values: {
      engine: "1.0L petrol, 3 cylinders", displacement: "1.0 L", power: "72 PS", torque: "96 Nm", transmission: "Manual", fuel: "Petrol", fuelTank: "40 L",
      steering: "Electric power steering", length: "3,990 mm", width: "1,750 mm", height: "1,605 mm", wheelbase: "2,500 mm", groundClearance: "205 mm",
      climate: "Manual AC", rearArmrest: "Yes", upholstery: "Black fabric", wheels: "16-inch steel", esc: "Yes", abs: "Yes with EBD", isofix: "Yes", tpms: "Yes", airbags: "6", boot: "405 L",
    },
  },
};

export const verifiedComparisonFor = (brand: string, model: string, variant?: string): SpecRecord | undefined =>
  verifiedVariants[`${brand}|${model}|${variant ?? ""}`];

const legacyVariantSources: Record<string, Source> = {
  "Hyundai|Creta|SX Petrol CVT": cretaBrochureSource,
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
