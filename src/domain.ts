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
  loopStage: BuildRole;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
};

export type FeedbackStatus = "New" | "Reviewing" | "Planned" | "Shipped";

export type TesterRunOutcome = "Useful" | "Confusing" | "Blocked";

export type TesterRun = {
  id: string;
  testerName: string;
  scenario: string;
  outcome: TesterRunOutcome;
  friction: string;
  nextLoopStage: BuildRole;
  createdAt: string;
};

export type DraftTesterRun = Omit<TesterRun, "id" | "createdAt">;

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

export type SubscriptionSettings = {
  emailDigest: boolean;
  browserAlerts: boolean;
  quietHours: boolean;
};

export type Profile = {
  displayName: string;
  city: string;
  garageRole: "Owner" | "Buyer" | "Enthusiast" | "Mechanic";
};

export type StarterRoute = {
  id: "profile" | "follow" | "garage" | "save" | "feedback";
  title: string;
  detail: string;
  href: string;
};

export type QaSessionItem = {
  id:
    | "feed"
    | "starter"
    | "garage"
    | "buyer"
    | "trust"
    | "backup"
    | "install"
    | "offline"
    | "service-boundary";
  label: string;
};

export type ResponsiveBreakpoint = "Phone" | "Tablet" | "Desktop";

export type ResponsiveQaItem = {
  id: string;
  breakpoint: ResponsiveBreakpoint;
  surface: string;
  label: string;
};

export type ReportStatus = "Open" | "Dismissed" | "Removed";

export type ReportRecord = {
  id: string;
  postId: string;
  postTitle: string;
  reason: string;
  reporterName: string;
  status: ReportStatus;
  createdAt: string;
};

export type DraftReport = Pick<ReportRecord, "postId" | "postTitle" | "reason" | "reporterName">;

export type ShortlistStatus = "Researching" | "Test drive" | "Negotiating" | "Rejected" | "Bought";

export type ShortlistItem = {
  id: string;
  brand: string;
  model: string;
  budget: number;
  status: ShortlistStatus;
  notes: string;
};

export type DraftShortlistItem = Omit<ShortlistItem, "id">;

export type BuildLoopItem = {
  role: BuildRole;
  question: string;
  currentDecision: string;
};

export type LaunchReadinessItem = {
  area: "Deploy" | "Install" | "Responsive QA" | "Data safety" | "Trust" | "Feedback" | "Boundary";
  label: string;
  detail: string;
  ready: boolean;
};

export type ProductionLaunchItem = {
  id:
    | "production-url"
    | "deep-link-refresh"
    | "security-headers"
    | "manifest-install"
    | "offline-smoke"
    | "handoff-shared";
  label: string;
  detail: string;
};

export type HostedApiReadinessItem = {
  id: string;
  surface: string;
  currentMode: "Local-first" | "Static" | "Reserved";
  hostedNeed: string;
  priority: "Launch blocker" | "Beta" | "Later";
  serviceCenterBoundary: boolean;
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

export const shortlistStatuses: ShortlistStatus[] = ["Researching", "Test drive", "Negotiating", "Rejected", "Bought"];

export const feedbackStatuses: FeedbackStatus[] = ["New", "Reviewing", "Planned", "Shipped"];

export const testerRunOutcomes: TesterRunOutcome[] = ["Useful", "Confusing", "Blocked"];

export const feedbackLoopStages: BuildRole[] = [
  "Product owner",
  "Designer",
  "Backend engineer",
  "Frontend engineer",
  "Tested / QA",
  "Real user",
];

export const starterRoutes: StarterRoute[] = [
  {
    detail: "Add a display name, city, and role so comments and reports feel human.",
    href: "#profile",
    id: "profile",
    title: "Set your garage identity",
  },
  {
    detail: "Follow one model or topic so the feed starts bringing useful notes back to you.",
    href: "#notebooks",
    id: "follow",
    title: "Follow a model notebook",
  },
  {
    detail: "Add a vehicle and one timeline note to unlock service reminders and cost context.",
    href: "#garage",
    id: "garage",
    title: "Create your garage baseline",
  },
  {
    detail: "Save one ownership note or shortlist a model before you leave.",
    href: "#feed",
    id: "save",
    title: "Keep one useful note",
  },
  {
    detail: "Tell the product loop what confused you, helped you, or felt missing.",
    href: "#feedback",
    id: "feedback",
    title: "Leave tester feedback",
  },
];

export const qaSessionItems: QaSessionItem[] = [
  { id: "feed", label: "Feed filters, saved notes, and following mode work." },
  { id: "starter", label: "Starter route updates as a fresh tester completes first actions." },
  { id: "garage", label: "Garage, timeline, reminders, and cost ledger persist locally." },
  { id: "buyer", label: "Buyer shortlist and inspection checklist stay readable on mobile." },
  { id: "trust", label: "Comments, reports, moderator queue, and feedback triage work." },
  { id: "backup", label: "Local backup export/import restores tester state." },
  { id: "install", label: "Manifest, icon, theme metadata, and shortcuts are available." },
  { id: "offline", label: "Offline strip explains local-first behavior when connection drops." },
  { id: "service-boundary", label: "Service-center work remains outside the community loop." },
];

export const responsiveQaItems: ResponsiveQaItem[] = [
  {
    breakpoint: "Phone",
    id: "phone-nav-feed",
    label: "Burger nav opens, closes, and feed/detail actions stay thumb-friendly.",
    surface: "Navigation + feed",
  },
  {
    breakpoint: "Phone",
    id: "phone-forms",
    label: "Write, feedback, garage, and shortlist forms stay readable without sideways scroll.",
    surface: "Forms",
  },
  {
    breakpoint: "Tablet",
    id: "tablet-cards",
    label: "Notebook, city, playbook, and garage cards keep useful two-column rhythm.",
    surface: "Knowledge cards",
  },
  {
    breakpoint: "Tablet",
    id: "tablet-qa-loop",
    label: "QA, feedback routing, and launch panels remain scannable in one pass.",
    surface: "Loop panels",
  },
  {
    breakpoint: "Desktop",
    id: "desktop-hero-detail",
    label: "Hero, feed detail, and sticky ownership note avoid cramped or floating dead space.",
    surface: "Hero + detail",
  },
  {
    breakpoint: "Desktop",
    id: "desktop-data-tools",
    label: "Backup, moderation, garage ledger, and reminders keep clear action hierarchy.",
    surface: "Data tools",
  },
];

export const productionLaunchItems: ProductionLaunchItem[] = [
  {
    detail: "Vercel production URL is available and opens the TypeScript webapp.",
    id: "production-url",
    label: "Production URL opens",
  },
  {
    detail: "A refreshed deep link falls back to the app instead of showing Vercel 404.",
    id: "deep-link-refresh",
    label: "Deep-link refresh works",
  },
  {
    detail: "Production response includes content-type, referrer, and permissions policy headers.",
    id: "security-headers",
    label: "Security headers verified",
  },
  {
    detail: "Manifest, icon, theme color, and install shortcuts are reachable on the deployed URL.",
    id: "manifest-install",
    label: "Install metadata verified",
  },
  {
    detail: "Offline toggle confirms local posts, garage notes, backup, and feedback still work.",
    id: "offline-smoke",
    label: "Offline smoke pass",
  },
  {
    detail: "QA handoff was shared with product, design, engineering, QA, and real-user notes.",
    id: "handoff-shared",
    label: "Launch handoff shared",
  },
];

export const hostedApiReadinessItems: HostedApiReadinessItem[] = [
  {
    currentMode: "Local-first",
    hostedNeed: "Persist posts, comments, helpful/stale signals, reports, and moderation outcomes across devices.",
    id: "community-feed",
    priority: "Beta",
    serviceCenterBoundary: false,
    surface: "Community feed and moderation",
  },
  {
    currentMode: "Local-first",
    hostedNeed: "Map profile, saved notes, follows, feedback, and tester runs to a recoverable account.",
    id: "profile-feedback",
    priority: "Beta",
    serviceCenterBoundary: false,
    surface: "Profile, saves, follows, and feedback",
  },
  {
    currentMode: "Local-first",
    hostedNeed: "Sync garage vehicles, timeline, reminders, running costs, and backups after web validation.",
    id: "garage-ownership",
    priority: "Later",
    serviceCenterBoundary: false,
    surface: "Garage and ownership timeline",
  },
  {
    currentMode: "Local-first",
    hostedNeed: "Turn local shortlist and inspection outcomes into cross-device buyer workspaces.",
    id: "buyer-workspace",
    priority: "Later",
    serviceCenterBoundary: false,
    surface: "Buyer shortlist and inspections",
  },
  {
    currentMode: "Static",
    hostedNeed: "Replace share-copy fallbacks with hosted routes and Open Graph metadata after deployment.",
    id: "sharing-metadata",
    priority: "Beta",
    serviceCenterBoundary: false,
    surface: "Share links and metadata",
  },
  {
    currentMode: "Reserved",
    hostedNeed: "Keep `/api/service-centers/*` owned by the separate service-center team.",
    id: "service-center",
    priority: "Later",
    serviceCenterBoundary: true,
    surface: "Service-center integration",
  },
];

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
    currentDecision: "A fast ownership community surface with local-first data and future API wiring.",
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

export const launchReadinessItems: LaunchReadinessItem[] = [
  {
    area: "Deploy",
    detail: "Vercel config, SPA fallback, and release command exist for repeatable deploy checks.",
    label: "Vercel web deploy path",
    ready: true,
  },
  {
    area: "Deploy",
    detail: "Needs the first production Vercel URL, deep-link refresh check, and header check before public sharing.",
    label: "Production Vercel URL",
    ready: false,
  },
  {
    area: "Install",
    detail: "Manifest, theme metadata, icon, and shortcuts are available for browser install surfaces.",
    label: "Install-ready web shell",
    ready: true,
  },
  {
    area: "Responsive QA",
    detail: "Navigation, cards, forms, and action rows have phone/tablet/desktop breakpoints.",
    label: "Responsive shell",
    ready: true,
  },
  {
    area: "Data safety",
    detail: "Local storage failures and app render crashes have safe fallbacks.",
    label: "Browser-safe local MVP",
    ready: true,
  },
  {
    area: "Data safety",
    detail: "The app explains online/offline state and what local-first work still continues.",
    label: "Offline-aware local mode",
    ready: true,
  },
  {
    area: "Trust",
    detail: "Reports, moderation queue, community rules, and owner blocking are available for tester abuse handling.",
    label: "Trust-and-safety loop",
    ready: true,
  },
  {
    area: "Feedback",
    detail: "Tester notes can move from New to Reviewing, Planned, and Shipped.",
    label: "Real-user feedback triage",
    ready: true,
  },
  {
    area: "Boundary",
    detail: "Service-center endpoints remain reserved for the separate owning team.",
    label: "Service-center boundary",
    ready: true,
  },
];
