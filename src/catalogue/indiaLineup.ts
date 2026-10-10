export type LineupKind = "car" | "two-wheeler";
export type LineupShape = "car" | "motorcycle" | "scooter";

export type LineupEntry = {
  brand: string;
  model: string;
  kind: LineupKind;
  shape: LineupShape;
  status?: "pre-booking";
  source: { label: string; url: string; checkedOn: string };
};

const checkedOn = "2026-10-10";
const source = (label: string, url: string) => ({ label, url, checkedOn });
const cars = (brand: string, models: string[], url: string): LineupEntry[] => models.map(model => ({
  brand, model, kind: "car", shape: "car", source: source(`${brand} India`, url),
}));
const bikes = (brand: string, models: string[], url: string): LineupEntry[] => models.map(model => ({
  brand, model, kind: "two-wheeler", shape: "motorcycle", source: source(`${brand} India`, url),
}));
const scooters = (brand: string, models: string[], url: string): LineupEntry[] => models.map(model => ({
  brand, model, kind: "two-wheeler", shape: "scooter", source: source(`${brand} India`, url),
}));

const marutiArena = "https://www.marutisuzuki.com/arena";
const marutiTour = "https://www.marutisuzuki.com/tour";
const marutiNexa = "https://www.nexaexperience.com/compare-cars";
const tataCars = "https://cars.tatamotors.com/news-and-events.html";
const mahindraSuvs = "https://auto.mahindra.com/suv";
const heroMotorcycles = "https://www.heromotocorp.com/en-in/motorcycles.html";
const heroScooters = "https://www.heromotocorp.com/en-in/scooters.html";
const hondaMotorcycles = "https://www.honda2wheelersindia.com/motorcycle?division=redwing";
const hondaScooters = "https://www.honda2wheelersindia.com/scooter";
const tvsVehicles = "https://www.tvsmotor.com/our-products/vehicles";
const bajajBikes = "https://www.bajajauto.com/bikes";
const royalEnfield = "https://www.royalenfield.com/in/en/motorcycles/";

const hondaPrebook = (model: string): LineupEntry => ({
  brand: "Honda", model, kind: "two-wheeler", shape: "motorcycle", status: "pre-booking",
  source: source("Honda India", hondaMotorcycles),
});
const hondaScooterPrebook: LineupEntry = {
  brand: "Honda", model: "ADV160", kind: "two-wheeler", shape: "scooter", status: "pre-booking",
  source: source("Honda India", hondaScooters),
};

// India-market models shown in each maker's official product catalogue, not a historical archive.
export const indiaLineup: readonly LineupEntry[] = [
  ...cars("Maruti Suzuki", ["S-Presso", "Alto K10", "Celerio", "WagonR", "Eeco", "Swift", "Dzire", "Brezza", "Ertiga", "Victoris"], marutiArena),
  ...cars("Maruti Suzuki", ["Tour H1", "Tour H3", "Tour S", "Tour V", "Tour M"], marutiTour),
  ...cars("Maruti Suzuki", ["Baleno", "Fronx", "Grand Vitara", "XL6", "Jimny", "Invicto", "e Vitara"], marutiNexa),
  ...cars("Hyundai", ["Verna", "Aura", "Venue", "Venue N Line", "Creta", "Creta N Line", "Exter", "Alcazar", "Grand i10 Nios", "i20", "i20 N Line", "IONIQ 5", "Creta Electric", "Prime-HB", "Prime-SD"], "https://www.hyundai.com/in/en/find-a-car"),
  ...cars("Tata", ["Tiago", "Tiago.ev", "Tigor", "Tigor.ev", "Punch", "Punch.ev", "Altroz", "Nexon", "Nexon.ev", "Curvv", "Curvv.ev", "Harrier", "Harrier.ev", "Safari"], tataCars),
  ...cars("Mahindra", ["Thar", "Thar ROXX", "Scorpio N", "Scorpio Classic", "XUV 3XO", "XUV 3XO EV", "XUV 7XO", "Bolero", "Bolero Neo", "Bolero Neo Plus", "XUV400", "BE 6", "XEV 9e"], mahindraSuvs),
  ...bikes("Hero", ["Splendor+", "Splendor+ XTEC", "Splendor+ XTEC 2.0", "Splendor+ Flex", "HF Deluxe", "HF Deluxe Flex", "HF 100", "Passion+", "Glamour", "Glamour X", "Glamour X ABS", "Super Splendor XTEC", "Super Splendor XTEC 2.0", "Xtreme 125R", "Xtreme 160R", "Xtreme 160R 4V", "Xtreme 250R", "XPulse 200 4V", "XPulse 210", "XPulse 210 Dakar Edition", "Karizma XMR"], heroMotorcycles),
  ...scooters("Hero", ["Destini 110", "Destini 125", "Destini Prime", "Xoom 110", "Xoom 125", "Xoom 160", "Pleasure+ XTEC"], heroScooters),
  ...bikes("Honda", ["Shine100", "Shine100 DX", "Livo", "Shine125", "Shine 125 Limited Edition", "SP125", "CB125 Hornet", "Unicorn", "SP160", "NX200", "Hornet 2.0", "CB350", "CB350C", "CB350C Special Edition", "CB350 H'ness", "CB350RS", "NX500 E-Clutch", "CB750 Hornet E-Clutch", "CB1000 Hornet SP", "XL750 Transalp E-Clutch", "Gold Wing Tour", "CBR1000RR-R SP"], hondaMotorcycles),
  hondaPrebook("Rebel300"),
  ...scooters("Honda", ["Activa110", "Activa110 Anniversary Edition", "Dio110", "Dio125", "Dio125 X-Edition", "Activa125", "Activa125 Anniversary Edition", "Activa e:", "QC1"], hondaScooters),
  hondaScooterPrebook,
  ...bikes("TVS", ["Apache RTX", "Apache RR 310", "Apache RTR 310", "Apache RTR 200 4V", "Apache RTR 180", "Apache RTR 160 4V", "Apache RTR 160", "Ronin", "Raider", "Radeon", "Star City+", "Sport"], tvsVehicles),
  ...scooters("TVS", ["Ntorq 150", "Ntorq 125", "Jupiter 110", "Jupiter 125", "Zest 110", "iQube", "TVS X", "Orbiter"], tvsVehicles),
  ...bikes("TVS", ["XL100"], tvsVehicles),
  ...bikes("Bajaj", ["Freedom 125 NG04", "Pulsar N125", "Pulsar N160", "Pulsar N250", "Pulsar NS125", "Pulsar NS160", "Pulsar NS200", "Pulsar NS400Z", "Pulsar RS200", "Pulsar 125", "Pulsar 150", "Pulsar 180", "Pulsar 220F", "Dominar 250", "Dominar 400", "Avenger 220 Cruise", "Avenger 220 Street", "Platina 100", "Platina 110 Drum", "CT 110X"], bajajBikes),
  ...bikes("Royal Enfield", ["Goan Classic 350", "Classic 350", "Bullet 350", "Classic 650", "Bullet 650", "Meteor 350", "Super Meteor 650", "Himalayan 450", "Himalayan 440", "Hunter 350", "Guerrilla 450", "Shotgun 650", "Interceptor 650", "Continental GT 650", "Bear 650", "Scram 440", "Flying Flea C6"], royalEnfield),
];

export const requestedMakes = ["Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Hero", "Honda", "TVS", "Bajaj", "Royal Enfield"] as const;
