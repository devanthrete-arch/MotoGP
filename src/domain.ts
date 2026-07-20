export type KnowledgeLabel = "Review" | "Known issue" | "Fix" | "Cost note" | "Travelogue" | "Owner note";

export type BuildRole = "Product owner" | "Designer" | "Backend engineer" | "Frontend engineer" | "Tested / QA" | "Real user";

export type OwnerPost = {
  id: string;
  title: string;
  author: string;
  brand: string;
  model: string;
  variant: string;
  city: string;
  odometerKm: number;
  label: KnowledgeLabel;
  topic: string;
  body: string;
  createdAt: string;
  helpful: number;
  fixesConfirmed: number;
  comments: string[];
};

export type FeedbackNote = {
  id: string;
  message: string;
  createdAt: string;
};

export type GarageVehicle = {
  id: string;
  nickname: string;
  brand: string;
  model: string;
  variant: string;
  city: string;
  odometerKm: number;
  purchaseMonth: string;
};

export type TimelineEntryKind = "Service" | "Repair" | "Tyres" | "Insurance" | "Fuel" | "Trip" | "Note";

export type TimelineEntry = {
  id: string;
  vehicleId: string;
  kind: TimelineEntryKind;
  title: string;
  amount: number;
  odometerKm: number;
  happenedOn: string;
  note: string;
};

export type FollowState = {
  models: string[];
  topics: string[];
};

export type BuildLoopItem = {
  role: BuildRole;
  question: string;
  currentDecision: string;
};

export type ModelNotebook = {
  key: string;
  brand: string;
  model: string;
  posts: OwnerPost[];
};

export type DraftPost = Omit<OwnerPost, "id" | "createdAt" | "helpful" | "fixesConfirmed" | "comments">;

export type DraftVehicle = Omit<GarageVehicle, "id">;

export type DraftTimelineEntry = Omit<TimelineEntry, "id">;

export const knowledgeLabels: KnowledgeLabel[] = [
  "Review",
  "Known issue",
  "Fix",
  "Cost note",
  "Travelogue",
  "Owner note",
];

export const timelineKinds: TimelineEntryKind[] = ["Service", "Repair", "Tyres", "Insurance", "Fuel", "Trip", "Note"];

export const seedGarage: GarageVehicle[] = [
  {
    id: "garage-nexon",
    nickname: "Daily diesel",
    brand: "Tata",
    model: "Nexon",
    variant: "XZ+ Diesel MT",
    city: "Pune",
    odometerKm: 42000,
    purchaseMonth: "2021-08",
  },
];

export const seedTimeline: TimelineEntry[] = [
  {
    id: "timeline-nexon-clutch",
    vehicleId: "garage-nexon",
    kind: "Repair",
    title: "Clutch linkage cleaned and adjusted",
    amount: 1350,
    odometerKm: 38000,
    happenedOn: "2026-04-18",
    note: "Avoided unnecessary full clutch replacement after a second technician inspected the linkage.",
  },
  {
    id: "timeline-nexon-service",
    vehicleId: "garage-nexon",
    kind: "Service",
    title: "40k km scheduled service",
    amount: 8200,
    odometerKm: 40200,
    happenedOn: "2026-06-12",
    note: "Oil, filters, alignment, and brake cleaning. Good reference bill for other Nexon diesel owners.",
  },
];

export const seedPosts: OwnerPost[] = [
  {
    id: "nexon-diesel-clutch",
    title: "Nexon diesel clutch became heavy at 38k km — dealer fix that worked",
    author: "Amit from Pune",
    brand: "Tata",
    model: "Nexon",
    variant: "XZ+ Diesel MT",
    city: "Pune",
    odometerKm: 42000,
    label: "Fix",
    topic: "Repairs",
    body:
      "The pedal feel changed slowly, not overnight. The useful clue was a squeak after traffic-heavy drives. Dealer first suggested full clutch work, but another technician cleaned and lubricated the linkage, then adjusted free play. Cost was low and the fix has held for 4,000 km.",
    createdAt: "2026-07-14T10:00:00.000Z",
    helpful: 31,
    fixesConfirmed: 7,
    comments: ["Same symptom on my 2021 car.", "Please add labour split if you still have the bill."],
  },
  {
    id: "city-hybrid-highway",
    title: "Honda City e:HEV highway report: brilliant economy, small boot compromise",
    author: "GarageNomad",
    brand: "Honda",
    model: "City",
    variant: "ZX e:HEV",
    city: "Bengaluru",
    odometerKm: 18500,
    label: "Review",
    topic: "Ownership review",
    body:
      "After three Bengaluru-Goa runs, the car feels calmer than the spec sheet suggests. ADAS is usable on open stretches, efficiency stays impressive when driven smoothly, and rear seat comfort remains the party trick. The boot floor and tyre replacement cost are the two caveats I now tell every buyer.",
    createdAt: "2026-07-10T15:30:00.000Z",
    helpful: 44,
    fixesConfirmed: 0,
    comments: ["How does it behave on broken ghat roads?", "This is exactly the ownership detail I wanted."],
  },
  {
    id: "seltos-dct-heat",
    title: "Seltos DCT in Delhi summer: what changed my driving habits",
    author: "NCRDriver",
    brand: "Kia",
    model: "Seltos",
    variant: "GTX+ DCT",
    city: "Delhi NCR",
    odometerKm: 27000,
    label: "Known issue",
    topic: "Reliability",
    body:
      "The car is quick and easy, but bumper-to-bumper crawling in peak heat needs patience. I avoid holding it on throttle creep, shift to neutral during long signals, and watch the warning signs after long jams. No failure yet, but this is not a gearbox I would recommend blindly to every city user.",
    createdAt: "2026-07-07T08:45:00.000Z",
    helpful: 28,
    fixesConfirmed: 0,
    comments: ["Useful balanced note, not fearmongering.", "Please mention average service cost too."],
  },
  {
    id: "thar-ladakh-cost",
    title: "Thar Ladakh trip cost sheet: tyres, fuel, permits, and what I would pack again",
    author: "TrailLedger",
    brand: "Mahindra",
    model: "Thar",
    variant: "LX Diesel AT 4x4",
    city: "Chandigarh",
    odometerKm: 33000,
    label: "Travelogue",
    topic: "Road trips",
    body:
      "The trip was less about hero photos and more about preparation. Fuel planning, tyre pressure discipline, and conservative day distances mattered more than accessories. The surprise cost was replacing one tyre before the return leg. The best spend was a proper compressor and recovery board rental.",
    createdAt: "2026-07-03T12:10:00.000Z",
    helpful: 53,
    fixesConfirmed: 0,
    comments: ["Please share route map.", "This is the kind of travelogue old forums did well."],
  },
];

export const buildLoop: BuildLoopItem[] = [
  {
    role: "Product owner",
    question: "What must a first-time visitor understand in 30 seconds?",
    currentDecision: "Autoflex is for useful ownership knowledge, not thin engagement posts.",
  },
  {
    role: "Designer",
    question: "Where should trust show up visually?",
    currentDecision: "Every card surfaces car, city, odometer, label, helpful signals, and owner context.",
  },
  {
    role: "Backend engineer",
    question: "What API contract remains separate?",
    currentDecision: "Service-center integration is reserved under a separate boundary until that team shares the contract.",
  },
  {
    role: "Frontend engineer",
    question: "What can ship on Vercel today?",
    currentDecision: "A TypeScript web MVP with local-first data and future API wiring.",
  },
  {
    role: "Tested / QA",
    question: "What must not regress?",
    currentDecision: "Feed filtering, post creation, saved posts, model grouping, and feedback capture.",
  },
  {
    role: "Real user",
    question: "Would this help me decide, fix, or remember something?",
    currentDecision: "The MVP prioritizes reviews, issues, fixes, cost notes, and travelogues over vanity metrics.",
  },
];
