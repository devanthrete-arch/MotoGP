import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useClerk, useUser } from "@clerk/react";
import {
  buildLoop,
  knowledgeLabels,
  privacyReadinessItems,
  shortlistStatuses,
  starterRoutes,
  timelineKinds,
  type DraftPost,
  type DraftShortlistItem,
  type DraftTimelineEntry,
  type DraftVehicle,
  type FollowState,
  type GarageVehicle,
  type KnowledgeLabel,
  type OwnerPost,
  type Profile,
  type ReportRecord,
  type ShortlistItem,
  type SubscriptionSettings,
  type TimelineEntry,
  type TimelineEntryKind,
} from "./domain";
import {
  assessPostQuality,
  buildCityCircles,
  buildConnectionStatusCopy,
  buildGarageCostLedger,
  buildGarageInsights,
  buildGarageExportMarkdown,
  buildGarageReminders,
  buildInspectionChecklists,
  buildModelSharePayload,
  buildModerationSummary,
  buildNotificationPreview,
  buildOwnershipPlaybooks,
  buildPostSharePayload,
  buildPrivacyReadinessSummary,
  buildReturnNudges,
  buildShortlistComparisons,
  buildStarterRouteProgress,
  filterPostsByMode,
  formatMoney,
  groupByModel,
  modelKeyFor,
  type ShortlistComparison,
} from "./insights";
import {
  createPost,
  createReport,
  createShortlistItem,
  createTimelineEntry,
  createVehicle,
  loadFollows,
  loadGarage,
  loadProfile,
  loadPosts,
  loadReports,
  loadSaved,
  loadShortlist,
  loadSubscriptionSettings,
  loadTimeline,
  saveFollows,
  saveGarage,
  savePosts,
  saveProfile,
  saveReports,
  saveSaved,
  saveShortlist,
  saveSubscriptionSettings,
  saveTimeline,
} from "./storage";

type FeedMode = "latest" | "helpful" | "saved" | "following";

type PitStopStatus = "published" | "pending" | "removed";

type PitStopClip = {
  addedAt: string;
  brand?: string;
  category: "Builds" | "Launches" | "Ownership" | "India";
  embedUrl: string;
  id: string;
  model?: string;
  sourceLabel: string;
  status: PitStopStatus;
  summary: string;
  thumbnailLabel: string;
  title: string;
};

type PitStopReel = {
  category: PitStopClip["category"];
  embedUrl: string;
  id: string;
  sourceLabel: string;
  summary: string;
  title: string;
};

const showDeferredCommunityModules = false;
const adminModeratorEmails = [
  "piyushdtu23@gmail.com",
  "priyansht1999@gmail.com",
  "shauryashivam38@gmail.com",
  "hemangdtu@gmail.com",
] as const;
export const isAdminModeratorEmail = (email: string): boolean =>
  adminModeratorEmails.includes(email.toLowerCase() as (typeof adminModeratorEmails)[number]);

const pitStopClips: PitStopClip[] = [
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    brand: "Mahindra",
    category: "Builds",
    embedUrl: "https://www.instagram.com/explore/tags/carsofinstagram/",
    id: "pitstop-builds-carsofinstagram",
    model: "Thar",
    sourceLabel: "Instagram car clips",
    status: "published",
    summary: "Custom builds, tasteful mods, owner-shot walkarounds, and short-format garage inspiration.",
    thumbnailLabel: "IG Builds",
    title: "Car builds worth watching",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    brand: "Hyundai",
    category: "Launches",
    embedUrl: "https://www.instagram.com/explore/tags/newcar/",
    id: "pitstop-launches-newcar",
    model: "Creta",
    sourceLabel: "Instagram launch clips",
    status: "published",
    summary: "Quick launch clips, dealership first looks, and real-world walkarounds before deep reviews arrive.",
    thumbnailLabel: "IG Launch",
    title: "New car clips",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    brand: "Honda",
    category: "Ownership",
    embedUrl: "https://www.instagram.com/explore/tags/carreview/",
    id: "pitstop-ownership-carreview",
    model: "City",
    sourceLabel: "Instagram review clips",
    status: "published",
    summary: "Short owner opinions and driving impressions to pair with detailed community posts.",
    thumbnailLabel: "IG Review",
    title: "Review clips from owners",
  },
  {
    addedAt: "2026-10-01T00:00:00.000Z",
    brand: "Tata",
    category: "India",
    embedUrl: "https://www.instagram.com/explore/tags/indianautomotive/",
    id: "pitstop-india-automotive",
    model: "Nexon",
    sourceLabel: "Instagram India auto clips",
    status: "published",
    summary: "India-focused clips around road presence, trims, city use, accessories, and buyer chatter.",
    thumbnailLabel: "IG India",
    title: "Indian automotive clips",
  },
];

const pitStopCategories: Array<PitStopClip["category"] | "All"> = ["All", "Builds", "Launches", "Ownership", "India"];
const pitStopCategoryFromHash = (): PitStopClip["category"] | null => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.replace("#pit-stop-", "").toLowerCase();
  return pitStopCategories.find((category): category is PitStopClip["category"] => category !== "All" && category.toLowerCase() === hash) ?? null;
};
const pitStopCollectionUrl = (category: PitStopClip["category"]) => `/#pit-stop-${category.toLowerCase()}`;

export const filterPitStopClipsByCategory = (
  clips: PitStopClip[],
  category: PitStopClip["category"] | "All",
): PitStopClip[] => (category === "All" ? clips : clips.filter((clip) => clip.category === category));

export const buildTopPitStopReels = (clips: PitStopClip[]): PitStopReel[] =>
  clips.flatMap((clip) => {
    const reelAngles = {
      Builds: ["walkaround", "wheel fitment", "lighting setup", "interior trim", "exhaust note"],
      India: ["city drive", "highway pull", "monsoon road", "accessory check", "delivery day"],
      Launches: ["first look", "variant walkaround", "feature demo", "dealer stock", "road presence"],
      Ownership: ["owner review", "service story", "fuel run", "problem check", "long-term note"],
    }[clip.category];

    return Array.from({ length: 50 }, (_, index) => {
      const angle = reelAngles[index % reelAngles.length];
      const rank = index + 1;

      return {
        category: clip.category,
        embedUrl: clip.embedUrl,
        id: `${clip.id}-reel-${rank}`,
        sourceLabel: clip.sourceLabel,
        summary: `Instagram ${angle} pick for ${clip.brand ?? "cars"}${clip.model ? ` ${clip.model}` : ""}. Auto-filled from the ${clip.category.toLowerCase()} source queue; replace with live Instagram API results when connected.`,
        title: `${clip.model ?? clip.category} ${angle} reel #${rank}`,
      };
    });
  });

const priceStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;
type PriceState = (typeof priceStates)[number];
const defaultPriceState: PriceState = "Maharashtra";
const cityStateMap: Record<string, PriceState> = {
  Bengaluru: "Karnataka",
  Chandigarh: "Chandigarh",
  "Delhi NCR": "Delhi",
  Pune: "Maharashtra",
};
const demoPriceFactor = 0.92;

const modelPriceOptions = [
  { brand: "Tata", model: "Nexon", bodyType: "Compact SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "17–24 km/l", safety: "5-star GNCAP", variants: [{ name: "Smart Petrol MT", price: 815000 }, { name: "XZ+ Diesel MT", price: 950000 }] },
  { brand: "Tata", model: "Punch", bodyType: "Micro SUV", fuel: "Petrol / CNG", seating: 5, mileage: "18–26 km/l", safety: "5-star GNCAP", variants: [{ name: "Pure Petrol MT", price: 613000 }, { name: "Accomplished Dazzle AMT", price: 950000 }] },
  { brand: "Tata", model: "Harrier", bodyType: "SUV", fuel: "Diesel", seating: 5, mileage: "14–16 km/l", safety: "5-star BNCAP", variants: [{ name: "Smart Diesel MT", price: 1500000 }, { name: "Fearless+ AT", price: 2499000 }] },
  { brand: "Honda", model: "City", bodyType: "Sedan", fuel: "Petrol / Hybrid", seating: 5, mileage: "17–27 km/l", safety: "5-star ASEAN NCAP", variants: [{ name: "VX Petrol CVT", price: 1250000 }, { name: "ZX e:HEV", price: 1180000 }] },
  { brand: "Honda", model: "Elevate", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "15–16 km/l", safety: "ADAS available", variants: [{ name: "SV Petrol MT", price: 1119000 }, { name: "ZX CVT", price: 1663000 }] },
  { brand: "Kia", model: "Seltos", bodyType: "SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "17–20 km/l", safety: "ADAS available", variants: [{ name: "HTX Petrol IVT", price: 1540000 }, { name: "GTX+ DCT", price: 1090000 }] },
  { brand: "Kia", model: "Sonet", bodyType: "Compact SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "18–22 km/l", safety: "6 airbags standard", variants: [{ name: "HTK Petrol MT", price: 800000 }, { name: "GTX+ DCT", price: 1455000 }] },
  { brand: "Mahindra", model: "Thar", bodyType: "Lifestyle SUV", fuel: "Petrol / Diesel", seating: 4, mileage: "9–15 km/l", safety: "4-star GNCAP", variants: [{ name: "LX Petrol AT 4x4", price: 1499000 }, { name: "LX Diesel AT 4x4", price: 1125000 }] },
  { brand: "Mahindra", model: "XUV700", bodyType: "SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "13–16 km/l", safety: "5-star GNCAP", variants: [{ name: "AX5 Petrol MT", price: 1399000 }, { name: "AX7 Diesel AT", price: 1919000 }] },
  { brand: "Mahindra", model: "Scorpio N", bodyType: "SUV", fuel: "Petrol / Diesel", seating: 7, mileage: "12–15 km/l", safety: "5-star GNCAP", variants: [{ name: "Z4 Diesel MT", price: 1549000 }, { name: "Z8L Diesel AT 4WD", price: 2454000 }] },
  { brand: "Maruti Suzuki", model: "Brezza", bodyType: "Compact SUV", fuel: "Petrol / CNG", seating: 5, mileage: "19–25 km/l", safety: "ESC available", variants: [{ name: "VXi Petrol MT", price: 869000 }, { name: "ZXi+ Petrol AT", price: 1300000 }] },
  { brand: "Maruti Suzuki", model: "Grand Vitara", bodyType: "SUV", fuel: "Petrol / Hybrid / CNG", seating: 5, mileage: "19–27 km/l", safety: "6 airbags available", variants: [{ name: "Sigma Smart Hybrid MT", price: 1087000 }, { name: "Alpha+ Hybrid e-CVT", price: 1997000 }] },
  { brand: "Hyundai", model: "Creta", bodyType: "SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "17–21 km/l", safety: "ADAS available", variants: [{ name: "SX Petrol CVT", price: 1543000 }, { name: "EX Petrol MT", price: 1111000 }] },
  { brand: "Hyundai", model: "Venue", bodyType: "Compact SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "17–23 km/l", safety: "6 airbags standard", variants: [{ name: "S Petrol MT", price: 795000 }, { name: "SX(O) Turbo DCT", price: 1350000 }] },
  { brand: "Toyota", model: "Hyryder", bodyType: "SUV", fuel: "Petrol / Hybrid / CNG", seating: 5, mileage: "20–27 km/l", safety: "AWD available", variants: [{ name: "S NeoDrive MT", price: 1149000 }, { name: "V Hybrid e-CVT", price: 1999000 }] },
  { brand: "Toyota", model: "Innova Hycross", bodyType: "MPV", fuel: "Petrol / Hybrid", seating: 7, mileage: "16–23 km/l", safety: "ADAS available", variants: [{ name: "GX 7S Petrol CVT", price: 1977000 }, { name: "ZX(O) Hybrid", price: 3056000 }] },
  { brand: "Skoda", model: "Kushaq", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "18–19 km/l", safety: "5-star GNCAP", variants: [{ name: "Onyx 1.0 TSI MT", price: 1089000 }, { name: "Style 1.5 TSI DSG", price: 1800000 }] },
  { brand: "Skoda", model: "Slavia", bodyType: "Sedan", fuel: "Petrol", seating: 5, mileage: "18–20 km/l", safety: "5-star GNCAP", variants: [{ name: "Active 1.0 TSI MT", price: 1069000 }, { name: "Style 1.5 TSI DSG", price: 1849000 }] },
  { brand: "Volkswagen", model: "Taigun", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "18–19 km/l", safety: "5-star GNCAP", variants: [{ name: "Comfortline 1.0 TSI MT", price: 1117000 }, { name: "GT Plus 1.5 DSG", price: 1900000 }] },
  { brand: "Volkswagen", model: "Virtus", bodyType: "Sedan", fuel: "Petrol", seating: 5, mileage: "18–20 km/l", safety: "5-star GNCAP", variants: [{ name: "Comfortline 1.0 TSI MT", price: 1106000 }, { name: "GT Plus 1.5 DSG", price: 1900000 }] },
] as const;

const brands = [...new Set(modelPriceOptions.map((option) => option.brand))];
const modelsForBrand = (brand: string) => modelPriceOptions.filter((option) => option.brand === brand);
const optionForModel = (brand: string, model: string) =>
  modelPriceOptions.find((option) => option.brand === brand && option.model === model);
const variantsForModel = (brand: string, model: string) => optionForModel(brand, model)?.variants ?? [];
const statePriceFactor = (state: string) => {
  const stateIndex = priceStates.indexOf(state as PriceState);
  return stateIndex >= 0 ? 0.96 + (stateIndex % 9) * 0.01 : 1;
};
export const priceForModel = (
  brand: string,
  model: string,
  variant = variantsForModel(brand, model)[0]?.name ?? "",
  state: string = defaultPriceState,
  status: ShortlistItem["status"] = "New",
): number => {
  const basePrice = variantsForModel(brand, model).find((option) => option.name === variant)?.price ?? 0;
  return Math.round(basePrice * statePriceFactor(state) * (status === "Test drive" ? demoPriceFactor : 1));
};
const firstModelForBrand = (brand: string) => modelsForBrand(brand)[0]?.model ?? "";
const firstVariantForModel = (brand: string, model: string) => variantsForModel(brand, model)[0]?.name ?? "";
const modelDetailsFor = (brand: string, model: string) => optionForModel(brand, model);
const stateForCity = (city: string): PriceState | "" => cityStateMap[city.trim()] ?? "";
const priceSourceFor = (state: string, status: ShortlistItem["status"]) =>
  status === "Test drive"
    ? `Indicative demo/test-drive estimate, ${state || defaultPriceState}`
    : `Indicative ex-showroom estimate, ${state || defaultPriceState}`;
type AppProps = {
  clerkEnabled?: boolean;
};

type AppAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  requireSignIn: () => void;
};

const ClerkAccountPanel = ({ savedCount }: { savedCount: number }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const metadataRole = typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : "";
  const role = metadataRole === "moderator" || (email && isAdminModeratorEmail(email)) ? "Moderator" : "User";

  if (!isLoaded) {
    return <p>Loading Clerk sign-in…</p>;
  }

  return isSignedIn ? (
    <>
      <div className="instrument-metrics">
        <span>
          <strong>{role}</strong>
          Role
        </span>
        <span>
          <strong>{savedCount}</strong>
          Saved notes
        </span>
        <span>
          <strong>{user?.firstName ?? "Signed in"}</strong>
          Profile
        </span>
      </div>
      <div className="auth-actions">
        <UserButton />
        <span>{email}</span>
      </div>
    </>
  ) : (
    <>
      <div className="instrument-metrics">
        <span>
          <strong>Clerk</strong>
          Backend auth
        </span>
        <span>
          <strong>{savedCount}</strong>
          Saved notes
        </span>
        <span>
          <strong>User</strong>
          Default role
        </span>
      </div>
      <div className="auth-actions">
        <SignInButton mode="modal">
          <button className="primary-action" type="button">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="secondary-action" type="button">
            Create account
          </button>
        </SignUpButton>
      </div>
    </>
  );
};

const LoginGate = ({ isLoaded }: { isLoaded: boolean }) => (
  <section className="panel auth-gate" aria-label="Sign in required">
    <div>
      <p className="eyebrow">Account required</p>
      <h2>Log in or create an account to use Otofolks.</h2>
      <p>Feed actions, Pit Stop clips, Compare, saves, comments, follows, and moderator tools are available after sign-in.</p>
    </div>
    <div className="auth-actions">
      <SignInButton mode="modal">
        <button className="primary-action" disabled={!isLoaded} type="button">
          Log in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="secondary-action" disabled={!isLoaded} type="button">
          Create account
        </button>
      </SignUpButton>
    </div>
  </section>
);

const ClerkConnectedApp = () => {
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  return (
    <OtofolksApp
      auth={{
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        requireSignIn: () => {
          void clerk.openSignIn();
        },
      }}
      clerkEnabled
    />
  );
};

export function App({ clerkEnabled = false }: AppProps) {
  if (clerkEnabled) return <ClerkConnectedApp />;

  return (
    <OtofolksApp
      auth={{
        isLoaded: true,
        isSignedIn: false,
        requireSignIn: () => undefined,
      }}
      clerkEnabled={false}
    />
  );
}

const compareMetricRows = (comparisons: ShortlistComparison[]) => {
  const [first, second] = comparisons;
  if (!first || !second) return [];

  const firstDetails = modelDetailsFor(first.item.brand, first.item.model);
  const secondDetails = modelDetailsFor(second.item.brand, second.item.model);

  return [
    ["Model", `${first.item.brand} ${first.item.model}`, `${second.item.brand} ${second.item.model}`],
    ["Variant", first.item.variant ?? "—", second.item.variant ?? "—"],
    ["Estimated price", formatMoney(first.item.budget), formatMoney(second.item.budget)],
    ["State basis", first.item.state ?? defaultPriceState, second.item.state ?? defaultPriceState],
    ["Status", first.item.status, second.item.status],
    ["Body type", firstDetails?.bodyType ?? "—", secondDetails?.bodyType ?? "—"],
    ["Fuel", firstDetails?.fuel ?? "—", secondDetails?.fuel ?? "—"],
    ["Seats", firstDetails ? `${firstDetails.seating}` : "—", secondDetails ? `${secondDetails.seating}` : "—"],
    ["Mileage", firstDetails?.mileage ?? "—", secondDetails?.mileage ?? "—"],
    ["Safety", firstDetails?.safety ?? "—", secondDetails?.safety ?? "—"],
  ];
};

const initialDraft: DraftPost = {
  title: "",
  author: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  label: "Owner note",
  topic: "Ownership review",
  body: "",
};

const initialVehicleDraft: DraftVehicle = {
  nickname: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  purchaseMonth: "",
};

const initialTimelineDraft: DraftTimelineEntry = {
  vehicleId: "",
  kind: "Service",
  title: "",
  amount: 0,
  odometerKm: 0,
  happenedOn: new Date().toISOString().slice(0, 10),
  note: "",
};

const initialShortlistDraft: DraftShortlistItem = {
  brand: "Tata",
  budget: priceForModel("Tata", "Nexon", "Smart Petrol MT", defaultPriceState, "New"),
  model: "Nexon",
  notes: "",
  priceSource: priceSourceFor(defaultPriceState, "New"),
  state: defaultPriceState,
  status: "New",
  variant: "Smart Petrol MT",
};

const garageRoles: Profile["garageRole"][] = ["Owner", "Buyer", "Enthusiast", "Mechanic"];

const getInitialOnlineStatus = (): boolean => {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  } catch {
    return true;
  }
};

function OtofolksApp({ auth, clerkEnabled = false }: AppProps & { auth: AppAuthState }) {
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [reports, setReports] = useState<ReportRecord[]>(() => loadReports());
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist());
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved());
  const [follows, setFollows] = useState<FollowState>(() => loadFollows());
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>(() => loadSubscriptionSettings());
  const [garage, setGarage] = useState<GarageVehicle[]>(() => loadGarage());
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => loadTimeline());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FeedMode>("latest");
  const [selectedLabel, setSelectedLabel] = useState<KnowledgeLabel | "All">("All");
  const [selectedFeedState, setSelectedFeedState] = useState<PriceState | "All">("All");
  const initialPitStopCollection = pitStopCategoryFromHash();
  const [selectedPitStopCategory, setSelectedPitStopCategory] = useState<PitStopClip["category"] | "All">(
    initialPitStopCollection ?? "All",
  );
  const [selectedPitStopCollection, setSelectedPitStopCollection] = useState<PitStopClip["category"] | null>(initialPitStopCollection);
  const [selectedPost, setSelectedPost] = useState<OwnerPost | null>(posts[0] ?? null);
  const [draft, setDraft] = useState<DraftPost>(initialDraft);
  const [vehicleDraft, setVehicleDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [timelineDraft, setTimelineDraft] = useState<DraftTimelineEntry>(() => ({
    ...initialTimelineDraft,
    vehicleId: loadGarage()[0]?.id ?? "",
  }));
  const [shortlistDraft, setShortlistDraft] = useState<DraftShortlistItem>(initialShortlistDraft);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportDraft, setReportDraft] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);

  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  const filteredPosts = useMemo(() => {
    const modeFilteredPosts = filterPostsByMode(posts, {
        followedModelSet,
        followedTopicSet,
        mode,
        query,
        saved,
        selectedLabel,
      });
    return selectedFeedState === "All"
      ? modeFilteredPosts
      : modeFilteredPosts.filter((post) => stateForCity(post.city) === selectedFeedState);
  }, [followedModelSet, followedTopicSet, mode, posts, query, saved, selectedFeedState, selectedLabel]);

  const publishedPitStopClips = useMemo(
    () => pitStopClips.filter((clip) => clip.status === "published"),
    [],
  );
  const pitStopReels = useMemo(() => buildTopPitStopReels(publishedPitStopClips), [publishedPitStopClips]);
  const filteredPitStopClips = useMemo(
    () => filterPitStopClipsByCategory(publishedPitStopClips, selectedPitStopCategory),
    [publishedPitStopClips, selectedPitStopCategory],
  );
  const selectedPitStopReels = useMemo(
    () => pitStopReels.filter((reel) => reel.category === selectedPitStopCollection).slice(0, 50),
    [pitStopReels, selectedPitStopCollection],
  );

  const returnNudges = useMemo(
    () => buildReturnNudges({ followedModelSet, followedTopicSet, garage, posts, savedCount: saved.size }),
    [followedModelSet, followedTopicSet, garage, posts, saved.size],
  );
  const starterProgress = useMemo(
    () =>
      buildStarterRouteProgress({
        follows,
        garage,
        profile,
        routes: starterRoutes,
        savedCount: saved.size,
        shortlistCount: shortlist.length,
      }),
    [follows, garage, profile, saved.size, shortlist.length],
  );
  const completedStarterSteps = starterProgress.filter((step) => step.complete).length;
  const connectionStatus = useMemo(() => buildConnectionStatusCopy(isOnline), [isOnline]);

  const notificationPreview = useMemo(
    () => buildNotificationPreview({ follows, posts, preference: subscriptionSettings }),
    [follows, posts, subscriptionSettings],
  );

  const garageInsights = useMemo(() => buildGarageInsights(garage, timeline, posts), [garage, posts, timeline]);
  const garageCostLedger = useMemo(() => buildGarageCostLedger(garage, timeline), [garage, timeline]);
  const garageReminders = useMemo(() => buildGarageReminders(garage, timeline), [garage, timeline]);
  const cityCircles = useMemo(() => buildCityCircles(posts, garage), [garage, posts]);
  const ownershipPlaybooks = useMemo(() => buildOwnershipPlaybooks(posts), [posts]);
  const moderationSummary = useMemo(() => buildModerationSummary(reports), [reports]);
  const privacySummary = useMemo(() => buildPrivacyReadinessSummary(privacyReadinessItems), []);
  const shortlistComparisons = useMemo(() => buildShortlistComparisons(shortlist, posts), [posts, shortlist]);
  const oneToOneCompareRows = useMemo(() => compareMetricRows(shortlistComparisons), [shortlistComparisons]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, posts), [posts, shortlist]);
  const inspectionChecklistByItemId = useMemo(
    () => new Map(inspectionChecklists.map((checklist) => [checklist.item.id, checklist])),
    [inspectionChecklists],
  );
  const draftQuality = useMemo(() => assessPostQuality(draft), [draft]);
  const selectedPostQuality = useMemo(() => (selectedPost ? assessPostQuality(selectedPost) : null), [selectedPost]);
  const shortlistDraftPrice = priceForModel(
    shortlistDraft.brand,
    shortlistDraft.model,
    shortlistDraft.variant,
    shortlistDraft.state,
    shortlistDraft.status,
  );
  const shortlistDraftSource = priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status);
  const shortlistDraftDetails = modelDetailsFor(shortlistDraft.brand, shortlistDraft.model);

  const stats = useMemo(
    () => ({
      posts: posts.length,
      models: notebooks.length,
      fixes: posts.filter((post) => post.label === "Fix").length,
      confirmations: posts.reduce((total, post) => total + post.fixesConfirmed, 0),
      follows: follows.models.length + follows.topics.length,
      garage: garage.length,
      reports: moderationSummary.openReports,
      shortlist: shortlist.length,
    }),
    [follows.models.length, follows.topics.length, garage.length, moderationSummary.openReports, notebooks.length, posts, shortlist.length],
  );

  useEffect(() => {
    const updateOnline = () => setIsOnline(true);
    const updateOffline = () => setIsOnline(false);

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  const persistPosts = (nextPosts: OwnerPost[]) => {
    setPosts(nextPosts);
    savePosts(nextPosts);
  };

  const persistFollows = (nextFollows: FollowState) => {
    setFollows(nextFollows);
    saveFollows(nextFollows);
  };

  const persistSubscriptionSettings = (nextSettings: SubscriptionSettings) => {
    setSubscriptionSettings(nextSettings);
    saveSubscriptionSettings(nextSettings);
  };

  const persistProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  const persistReports = (nextReports: ReportRecord[]) => {
    setReports(nextReports);
    saveReports(nextReports);
  };

  const persistShortlist = (nextShortlist: ShortlistItem[]) => {
    setShortlist(nextShortlist);
    saveShortlist(nextShortlist);
  };

  const persistGarage = (nextGarage: GarageVehicle[]) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const persistTimeline = (nextTimeline: TimelineEntry[]) => {
    setTimeline(nextTimeline);
    saveTimeline(nextTimeline);
  };

  const toggleSaved = (postId: string) => {
    const next = new Set(saved);
    if (next.has(postId)) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
  };

  const toggleFollowModel = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const nextModels = follows.models.includes(key) ? follows.models.filter((item) => item !== key) : [...follows.models, key];
    persistFollows({ ...follows, models: nextModels });
  };

  const toggleFollowTopic = (topic: KnowledgeLabel) => {
    const nextTopics = follows.topics.includes(topic)
      ? follows.topics.filter((item) => item !== topic)
      : [...follows.topics, topic];
    persistFollows({ ...follows, topics: nextTopics });
  };

  const markHelpful = (postId: string) => {
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: post.helpful + 1 } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const confirmFix = (postId: string) => {
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: post.fixesConfirmed + 1, helpful: post.helpful + 1 } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !commentDraft.trim()) return;
    const author = profile.displayName.trim() || "Anonymous garage member";
    const next = posts.map((post) =>
      post.id === selectedPost.id ? { ...post, comments: [`${author}: ${commentDraft.trim()}`, ...post.comments] } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === selectedPost.id) ?? null);
    setCommentDraft("");
  };

  const reportSelectedPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !reportDraft.trim()) return;
    const report = createReport({
      postId: selectedPost.id,
      postTitle: selectedPost.title,
      reason: reportDraft.trim(),
      reporterName: profile.displayName.trim() || "Anonymous reporter",
    });
    persistReports([report, ...reports]);
    setReportDraft("");
  };

  const setReportStatus = (reportId: string, status: ReportRecord["status"]) => {
    persistReports(reports.map((report) => (report.id === reportId ? { ...report, status } : report)));
  };

  const removeReportedPost = (report: ReportRecord) => {
    const nextPosts = posts.filter((post) => post.id !== report.postId);
    persistPosts(nextPosts);
    persistReports(reports.map((item) => (item.id === report.id ? { ...item, status: "Removed" } : item)));
    if (selectedPost?.id === report.postId) setSelectedPost(nextPosts[0] ?? null);
  };

  const shareText = async (payload: { text: string; title: string }) => {
    try {
      if (navigator.share) {
        await navigator.share(payload);
        setActionMessage("Shared.");
        return;
      }

      await navigator.clipboard.writeText(`${payload.title}\n\n${payload.text}`);
      setActionMessage("Copied to clipboard.");
    } catch {
      setActionMessage("Sharing was cancelled or blocked by the browser.");
    }
  };

  const shareSelectedPost = () => {
    if (!selectedPost) return;
    void shareText(buildPostSharePayload(selectedPost));
  };

  const shareModelNotebook = (brand: string, model: string) => {
    const notebook = notebooks.find((item) => item.key === modelKeyFor(brand, model));
    if (!notebook) return;
    void shareText(buildModelSharePayload(notebook));
  };

  const exportGarage = () => {
    void shareText({
      title: "Otofolks garage export",
      text: buildGarageExportMarkdown(garage, timeline),
    });
  };

  const addShortlistItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shortlistDraft.model.trim()) return;
    persistShortlist([
      {
        ...createShortlistItem({
          ...shortlistDraft,
          budget: shortlistDraftPrice,
          priceSource: shortlistDraftSource,
        }),
      },
      ...shortlist,
    ]);
    setShortlistDraft(initialShortlistDraft);
  };

  const addSelectedToShortlist = () => {
    if (!selectedPost) return;
    const alreadyShortlisted = shortlist.some(
      (item) => modelKeyFor(item.brand, item.model) === modelKeyFor(selectedPost.brand, selectedPost.model),
    );
    if (alreadyShortlisted) {
      setActionMessage("That model is already in Compare.");
      return;
    }
    persistShortlist([
      createShortlistItem({
        brand: selectedPost.brand,
        budget: priceForModel(
          selectedPost.brand,
          selectedPost.model,
          firstVariantForModel(selectedPost.brand, selectedPost.model),
          stateForCity(selectedPost.city) || defaultPriceState,
          "New",
        ),
        model: selectedPost.model,
        notes: `Added from: ${selectedPost.title}`,
        priceSource: priceSourceFor(stateForCity(selectedPost.city) || defaultPriceState, "New"),
        state: stateForCity(selectedPost.city) || defaultPriceState,
        status: "New",
        variant: firstVariantForModel(selectedPost.brand, selectedPost.model),
      }),
      ...shortlist,
    ]);
    setActionMessage(`${selectedPost.brand} ${selectedPost.model} added to Compare.`);
  };

  const updateShortlistItem = (itemId: string, patch: Partial<ShortlistItem>) => {
    persistShortlist(shortlist.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const removeShortlistItem = (itemId: string) => {
    persistShortlist(shortlist.filter((item) => item.id !== itemId));
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const post = createPost({
      ...draft,
      author: draft.author.trim() || "Anonymous owner",
      odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
    });
    const next = [post, ...posts];
    persistPosts(next);
    setSelectedPost(post);
    setDraft(initialDraft);
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage]);
    setVehicleDraft(initialVehicleDraft);
  };

  const addTimelineNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timelineDraft.vehicleId) return;
    const entry = createTimelineEntry({
      ...timelineDraft,
      amount: Number.isFinite(timelineDraft.amount) ? timelineDraft.amount : 0,
      odometerKm: Number.isFinite(timelineDraft.odometerKm) ? timelineDraft.odometerKm : 0,
    });
    persistTimeline([entry, ...timeline]);
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
  };

  const shouldShowFeatures = !clerkEnabled || auth.isSignedIn;
  const requireSignIn = () => {
    if (shouldShowFeatures) return true;
    auth.requireSignIn();
    setActionMessage("Log in or create an account to use this feature.");
    return false;
  };
  const handleFeatureNav = (event: MouseEvent<HTMLAnchorElement>) => {
    setNavMenuOpen(false);
    if (!shouldShowFeatures) {
      event.preventDefault();
      requireSignIn();
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Otofolks home" onClick={() => setNavMenuOpen(false)}>
            <span className="logo-mark" aria-hidden="true">
              <span className="logo-car" />
              <span className="logo-wrench" />
            </span>
            Otofolks
          </a>
          <button
            aria-controls="primary-nav-links"
            aria-expanded={navMenuOpen}
            className="nav-toggle"
            type="button"
            onClick={() => setNavMenuOpen((isOpen) => !isOpen)}
          >
            <span />
            <span />
            <span />
            Menu
          </button>
          <div className={`nav-actions ${navMenuOpen ? "is-open" : ""}`} id="primary-nav-links">
            <a href={shouldShowFeatures ? "#feed" : "#account"} onClick={handleFeatureNav}>
              Feed
            </a>
            <a href={shouldShowFeatures ? "#pit-stop" : "#account"} onClick={handleFeatureNav}>
              Pit Stop
            </a>
            <a href={shouldShowFeatures ? "#compare" : "#account"} onClick={handleFeatureNav}>
              Compare
            </a>
            <a href="#account" onClick={() => setNavMenuOpen(false)}>
              Sign in
            </a>
          </div>
        </nav>

        <div className="hero-grid" id="top">
          <div>
            <div className="brand-lockup" aria-label="Otofolks logo lockup">
              <span className="logo-mark splash-mark" aria-hidden="true">
                <span className="logo-car" />
                <span className="logo-wrench" />
              </span>
              <strong>
                Oto<span>folks</span>
              </strong>
              <small>Care you can trust</small>
            </div>
            <span className="sys-badge">Service-ready community</span>
            <p className="eyebrow">Otofolks customer web</p>
            <h1>Useful car decisions start with trusted owner evidence.</h1>
            <p className="hero-copy">
              Otofolks keeps the customer surface focused: owner notes, service signals, short car clips, and model
              comparisons that help buyers move from research to action.
            </p>
            <div className="service-sync-card" aria-label="Merged service app preview">
              <div className="service-search">
                <span aria-hidden="true" />
                <strong>Search owner notes, experts, service types...</strong>
                <button type="button" onClick={requireSignIn}>
                  Filter
                </button>
              </div>
              <div className="service-pill-row" aria-label="Service categories">
                <span className="is-active">Car Service</span>
                <span>Oil Change</span>
                <span>Tyre</span>
                <span>Owner Notes</span>
              </div>
              <div className="service-preview-grid">
                <article className="offer-card">
                  <span>Community + service</span>
                  <h3>Find trusted car help backed by real owner evidence.</h3>
                  <p>Community notes now share the same Otofolks rhythm as booking, providers, vehicles, and payments.</p>
                </article>
                <div className="phone-preview" aria-label="Otofolks service app screens">
                  <img src="/app-screens/service-home.png" alt="Otofolks service app home screen" />
                  <img src="/app-screens/provider-about.png" alt="Otofolks provider detail screen" />
                  <img src="/app-screens/booking-schedule.png" alt="Otofolks booking schedule screen" />
                </div>
              </div>
            </div>
            <div className="hero-actions">
              <a className="primary-action" href={shouldShowFeatures ? "#feed" : "#account"} onClick={handleFeatureNav}>
                Open feed
              </a>
              <a className="secondary-action" href={shouldShowFeatures ? "#pit-stop" : "#account"} onClick={handleFeatureNav}>
                Open Pit Stop
              </a>
            </div>
          </div>

          <div className="instrument-card" id="account" aria-label="Sign in and profile">
            <p className="instrument-kicker">Account</p>
            {clerkEnabled ? (
              <ClerkAccountPanel savedCount={saved.size} />
            ) : (
              <>
                <div className="instrument-metrics">
                  <span>
                    <strong>Clerk</strong>
                    Add key
                  </span>
                  <span>
                    <strong>{saved.size}</strong>
                    Saved notes
                  </span>
                  <span>
                    <strong>{profile.displayName.trim() ? "Set" : "Local"}</strong>
                    Profile
                  </span>
                </div>
                <p>Add VITE_CLERK_PUBLISHABLE_KEY to enable Clerk login. Until then, saves stay in this browser.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {actionMessage ? (
        <div className="action-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <section className={`connection-strip ${connectionStatus.tone}`} aria-label="Connection status">
        <strong>{connectionStatus.label}</strong>
        <span>{connectionStatus.detail}</span>
      </section>

      {shouldShowFeatures ? (
        <>
      {showDeferredCommunityModules ? (
        <>
      <section className="panel dashboard-panel" aria-label="Return user dashboard">
        <div>
          <p className="eyebrow">Return-user garage</p>
          <h2>Your next useful reason to come back.</h2>
        </div>
        <div className="nudge-grid">
          {returnNudges.length ? (
            returnNudges.map((nudge) => <p key={nudge}>{nudge}</p>)
          ) : (
            <p>Follow a model, save a note, or add a vehicle to unlock a more personal garage dashboard.</p>
          )}
        </div>
      </section>

      <section className="panel starter-panel" aria-label="First visit starter route">
        <div className="section-head">
          <div>
            <p className="eyebrow">Starter route</p>
            <h2>Five moves to make Otofolks useful on day one.</h2>
          </div>
          <div className="starter-score">
            <strong>
              {completedStarterSteps}/{starterProgress.length}
            </strong>
            done
          </div>
        </div>
        <div className="starter-grid">
          {starterProgress.map((step) => (
            <a className={`starter-card ${step.complete ? "complete" : ""}`} href={step.href} key={step.id}>
              <span>{step.complete ? "Done" : "Next"}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="panel split-panel profile-panel" id="profile">
        <div>
          <p className="eyebrow">Lightweight profile</p>
          <h2>Join the discussion without account ceremony.</h2>
          <p>
            This local profile keeps comments, reports, and future recovery simple until the hosted account layer is
            ready.
          </p>
        </div>
        <form className="composer" onSubmit={(event) => event.preventDefault()}>
          <input
            value={profile.displayName}
            onChange={(event) => persistProfile({ ...profile, displayName: event.target.value })}
            placeholder="Display name"
          />
          <div className="form-row">
            <input
              value={profile.city}
              onChange={(event) => persistProfile({ ...profile, city: event.target.value })}
              placeholder="City"
            />
            <select
              value={profile.garageRole}
              onChange={(event) => persistProfile({ ...profile, garageRole: event.target.value as Profile["garageRole"] })}
            >
              {garageRoles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
          <p className="form-note">
            Posting as {profile.displayName.trim() || "Anonymous garage member"}
            {profile.city.trim() ? ` from ${profile.city}` : ""}.
          </p>
        </form>
      </section>

      <section className="panel privacy-panel" id="privacy">
        <div className="section-head">
          <div>
            <p className="eyebrow">Privacy readiness</p>
            <h2>Be explicit about what the MVP stores.</h2>
          </div>
          <div className="privacy-stats" aria-label="Privacy readiness summary">
            <span>{privacySummary["Stored for MVP"]} stored</span>
            <span>{privacySummary["Not collected"]} not collected</span>
            <span>{privacySummary["Deletion baseline"]} deletion</span>
          </div>
        </div>
        <div className="privacy-grid">
          {privacyReadinessItems.map((item) => (
            <article className={item.stance.toLowerCase().replaceAll(" ", "-")} key={item.id}>
              <span>{item.stance}</span>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel notification-panel" id="notifications">
        <div className="notification-layout">
          <div className="notification-copy">
            <p className="eyebrow">Subscriptions</p>
            <h2>Choose the updates you actually want.</h2>
            <p>
              Keep this lightweight for the MVP: weekly ownership summaries, optional browser alerts, and quiet hours
              when notification jobs are added.
            </p>
          </div>
          <div className="preference-card" aria-label="Notification preferences">
            <label>
              <input
                checked={subscriptionSettings.emailDigest}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, emailDigest: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Weekly digest</strong>
                <small>One roundup for followed models and topics.</small>
              </span>
            </label>
            <label>
              <input
                checked={subscriptionSettings.browserAlerts}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, browserAlerts: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Browser alerts</strong>
                <small>Reserved for important updates after hosted notifications exist.</small>
              </span>
            </label>
            <label>
              <input
                checked={subscriptionSettings.quietHours}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, quietHours: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Quiet hours</strong>
                <small>Keep alerts muted outside useful ownership hours.</small>
              </span>
            </label>
          </div>
        </div>
        <div className="notification-grid">
          {notificationPreview.map((preview) => (
            <p key={preview}>{preview}</p>
          ))}
        </div>
      </section>

      <section className="panel" id="cities">
        <div className="section-head">
          <div>
            <p className="eyebrow">City circles</p>
            <h2>Local ownership signals matter.</h2>
          </div>
        </div>
        <div className="city-grid">
          {cityCircles.length ? (
            cityCircles.map((circle) => (
              <article className={`city-card ${circle.localSignal.toLowerCase()}`} key={circle.city}>
                <span>{circle.localSignal}</span>
                <h3>{circle.city}</h3>
                <p>
                  {circle.posts.length} owner notes · {circle.garageVehicles.length} garage vehicles
                </p>
                <div className="city-tags">
                  {circle.topBrands.map((brand) => (
                    <button key={brand} type="button" onClick={() => setQuery(brand)}>
                      {brand}
                    </button>
                  ))}
                  {circle.hotTopics.map((topic) => (
                    <button key={topic} type="button" onClick={() => setSelectedLabel(topic)}>
                      {topic}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">Add city details to posts or garage vehicles to start local circles.</div>
          )}
        </div>
      </section>
        </>
      ) : null}

      <section className="panel pit-lane" aria-label="Digital pit lane">
        <div className="section-head">
          <div>
            <p className="eyebrow">Digital Pit Lane</p>
            <h2>Jump straight to a module.</h2>
          </div>
        </div>
        <div className="module-grid">
          <a className="module-card" href="#feed">
            <span className="module-index">{String(stats.posts).padStart(2, "0")}</span>
            <span className="module-open">OPEN</span>
            <h3>Community</h3>
            <span className="module-sub">Owner notes // fixes</span>
          </a>
          <a className="module-card" href="#pit-stop">
            <span className="module-index">{String(publishedPitStopClips.length).padStart(2, "0")}</span>
            <span className="module-open">OPEN</span>
            <h3>Pit Stop</h3>
            <span className="module-sub">Reels // clips</span>
          </a>
          <a className="module-card" href="#compare">
            <span className="module-index">{String(stats.shortlist).padStart(2, "0")}</span>
            <span className="module-open">OPEN</span>
            <h3>Compare</h3>
            <span className="module-sub">Models // pricing</span>
          </a>
        </div>
      </section>

      <section className="panel" id="feed">
        <div className="section-head">
          <div>
            <p className="eyebrow">Community feed</p>
            <h2>Feed: owner notes, saved posts, and real problems.</h2>
            <p className="section-note">Use “Save note” on any card, then open Saved notes here to see it again.</p>
          </div>
          <div className="filters" aria-label="Feed filters">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, model, city, issue..."
              type="search"
            />
            <select value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value as KnowledgeLabel | "All")}>
              <option>All</option>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
            <select value={selectedFeedState} onChange={(event) => setSelectedFeedState(event.target.value as PriceState | "All")}>
              <option value="All">All states</option>
              {priceStates.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
            <select value={mode} onChange={(event) => setMode(event.target.value as FeedMode)}>
              <option value="latest">Latest</option>
              <option value="helpful">Most helpful</option>
              <option value="following">Following</option>
              <option value="saved">Saved</option>
            </select>
            <button className="save-button" type="button" onClick={() => setMode("saved")}>
              Saved notes · {saved.size}
            </button>
          </div>
        </div>

        <div className="content-grid">
          <div className="feed-list">
            {filteredPosts.length ? (
              filteredPosts.map((post) => (
                <article
                  className={`post-card ${selectedPost?.id === post.id ? "is-selected" : ""}`}
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                >
                  <div>
                    <span className="pill">{post.label}</span>
                    <h3>{post.title}</h3>
                    <p>
                      {post.brand} {post.model} · {post.city} · {post.odometerKm.toLocaleString("en-IN")} km
                    </p>
                  </div>
                  <button
                    className="save-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSaved(post.id);
                    }}
                  >
                    {saved.has(post.id) ? "Saved note" : "Save note"}
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">No notes match this filter yet. Write or follow the first useful one.</div>
            )}
          </div>

          <aside className="detail-card">
            {selectedPost ? (
              <>
                <span className="pill">{selectedPost.label}</span>
                <h2>{selectedPost.title}</h2>
                <p className="owner-line">
                  By {selectedPost.author} · {selectedPost.brand} {selectedPost.model} {selectedPost.variant} ·{" "}
                  {selectedPost.city}
                </p>
                <p>{selectedPost.body}</p>
                {selectedPostQuality ? (
                  <div className={`quality-card ${selectedPostQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="quality-meter">
                      <span style={{ width: `${(selectedPostQuality.score / selectedPostQuality.maxScore) * 100}%` }} />
                    </div>
                    <strong>
                      {selectedPostQuality.grade} · {selectedPostQuality.score}/{selectedPostQuality.maxScore}
                    </strong>
                    <p>{selectedPostQuality.strengths[0] ?? "This note needs more ownership context."}</p>
                  </div>
                ) : null}
                <div className="signal-row">
                  <button type="button" onClick={() => markHelpful(selectedPost.id)}>
                    Helpful · {selectedPost.helpful}
                  </button>
                  {selectedPost.label === "Fix" ? (
                    <button type="button" onClick={() => confirmFix(selectedPost.id)}>
                      Worked for me · {selectedPost.fixesConfirmed}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => toggleSaved(selectedPost.id)}>
                    {saved.has(selectedPost.id) ? "Remove saved" : "Save note"}
                  </button>
                  <button type="button" onClick={() => toggleFollowModel(selectedPost.brand, selectedPost.model)}>
                    {followedModelSet.has(modelKeyFor(selectedPost.brand, selectedPost.model)) ? "Following model" : "Follow model"}
                  </button>
                  <button type="button" onClick={() => toggleFollowTopic(selectedPost.label)}>
                    {followedTopicSet.has(selectedPost.label) ? "Following topic" : "Follow topic"}
                  </button>
                  <button type="button" onClick={shareSelectedPost}>
                    Share note
                  </button>
                  <button type="button" onClick={addSelectedToShortlist}>
                    Add model to compare
                  </button>
                </div>
                <div className="related-pitstop-strip" aria-label="Related Pit Stop clips">
                  <strong>Watch alongside this review</strong>
                  {publishedPitStopClips
                    .filter((clip) => clip.brand === selectedPost.brand || clip.model === selectedPost.model)
                    .slice(0, 2)
                    .map((clip) => (
                      <a href={clip.embedUrl} key={clip.id} rel="noreferrer" target="_blank">
                        {clip.title}
                      </a>
                    ))}
                </div>
                <div className="comments">
                  <strong>Discussion</strong>
                  {selectedPost.comments.map((comment) => (
                    <p key={comment}>{comment}</p>
                  ))}
                </div>
                <form className="inline-form" onSubmit={addComment}>
                  <textarea
                    required
                    rows={3}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Add a useful reply, correction, bill detail, or ownership question."
                  />
                  <button className="primary-action" type="submit">
                    Add comment
                  </button>
                </form>
                <form className="inline-form report-form" onSubmit={reportSelectedPost}>
                  <textarea
                    required
                    rows={3}
                    value={reportDraft}
                    onChange={(event) => setReportDraft(event.target.value)}
                    placeholder="Report spam, abuse, fake lead, or dangerous advice. This goes into the local review queue."
                  />
                  <button className="save-button" type="submit">
                    Report for review
                  </button>
                </form>
              </>
            ) : (
              <p>Select a post to inspect owner details.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="panel pit-stop-panel" id="pit-stop">
        <div className="section-head">
          <div>
            <p className="eyebrow">Pit Stop</p>
            <h2>Short car clips tied to topics and models, not profiles.</h2>
          </div>
          <div className="pit-stop-filters" aria-label="Pit Stop category filters">
            {pitStopCategories.map((category) => (
              <button
                aria-pressed={selectedPitStopCategory === category}
                key={category}
                onClick={() => {
                  setSelectedPitStopCategory(category);
                  setSelectedPitStopCollection(category === "All" ? null : category);
                }}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="pit-stop-grid">
          {filteredPitStopClips.map((clip) => (
            <a
              aria-pressed={selectedPitStopCollection === clip.category}
              className="pit-stop-card"
              href={pitStopCollectionUrl(clip.category)}
              key={clip.id}
              rel="noreferrer"
              target="_blank"
            >
              <div className="pit-stop-thumb" aria-hidden="true">
                <strong>{clip.thumbnailLabel}</strong>
                <small>{clip.brand ?? "Cars"}</small>
              </div>
              <span>{clip.category}</span>
              <h3>{clip.title}</h3>
              <p>{clip.summary}</p>
              {clip.brand && clip.model ? <small>Related: {clip.brand} {clip.model}</small> : null}
              <em>Open top 50 in new tab · {clip.sourceLabel}</em>
            </a>
          ))}
        </div>
        {selectedPitStopCollection ? (
        <div className="pit-stop-reel-section" id={pitStopCollectionUrl(selectedPitStopCollection).slice(2)}>
          <div className="section-head compact">
            <div>
              <p className="eyebrow">{selectedPitStopCollection} top 50</p>
              <h3>Individual reel cards</h3>
            </div>
            <span className="form-note">Top {selectedPitStopReels.length} kept from the selected source queue</span>
          </div>
          <div className="pit-stop-reel-grid">
            {selectedPitStopReels.map((reel) => (
              <a className="pit-stop-reel-card" href={reel.embedUrl} key={reel.id} rel="noreferrer" target="_blank">
                <span>{reel.category}</span>
                <h4>{reel.title}</h4>
                <p>{reel.summary}</p>
                <em>{reel.sourceLabel}</em>
              </a>
            ))}
          </div>
        </div>
        ) : null}
      </section>

      <section className="panel" id="compare">
        <div className="section-head">
          <div>
            <p className="eyebrow">Compare</p>
            <h2>Turn owner notes into a decision.</h2>
          </div>
        </div>
        <div className="shortlist-grid">
          <form className="composer" onSubmit={addShortlistItem}>
            <h3>Add model to compare</h3>
            <div className="form-row">
              <select
                value={shortlistDraft.brand}
                onChange={(event) => {
                  const brand = event.target.value;
                  const model = firstModelForBrand(brand);
                  const variant = firstVariantForModel(brand, model);
                  const budget = priceForModel(brand, model, variant, shortlistDraft.state, shortlistDraft.status);
                  setShortlistDraft({
                    ...shortlistDraft,
                    brand,
                    budget,
                    model,
                    priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                    variant,
                  });
                }}
              >
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <select
                value={shortlistDraft.model}
                onChange={(event) => {
                  const model = event.target.value;
                  const variant = firstVariantForModel(shortlistDraft.brand, model);
                  const budget = priceForModel(shortlistDraft.brand, model, variant, shortlistDraft.state, shortlistDraft.status);
                  setShortlistDraft({
                    ...shortlistDraft,
                    budget,
                    model,
                    priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                    variant,
                  });
                }}
              >
                {modelsForBrand(shortlistDraft.brand).map((option) => (
                  <option key={option.model}>{option.model}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <select
                value={shortlistDraft.variant}
                onChange={(event) => {
                  const variant = event.target.value;
                  const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, variant, shortlistDraft.state, shortlistDraft.status);
                  setShortlistDraft({
                    ...shortlistDraft,
                    budget,
                    priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                    variant,
                  });
                }}
              >
                {variantsForModel(shortlistDraft.brand, shortlistDraft.model).map((option) => (
                  <option key={option.name}>{option.name}</option>
                ))}
              </select>
              <select
                value={shortlistDraft.state}
                onChange={(event) => {
                  const state = event.target.value as PriceState;
                  const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, state, shortlistDraft.status);
                  setShortlistDraft({
                    ...shortlistDraft,
                    budget,
                    priceSource: priceSourceFor(state, shortlistDraft.status),
                    state,
                  });
                }}
              >
                {priceStates.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="price-display" aria-label="Model price">
                <span>{shortlistDraft.status === "Test drive" ? "Test drive estimate" : "Ex-showroom estimate"}</span>
                <strong>{formatMoney(shortlistDraftPrice)}</strong>
                <small>{shortlistDraftSource}</small>
              </div>
              <select
                value={shortlistDraft.status}
                onChange={(event) => {
                  const status = event.target.value as ShortlistItem["status"];
                  const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, shortlistDraft.state, status);
                  setShortlistDraft({
                    ...shortlistDraft,
                    budget,
                    priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, status),
                    status,
                  });
                }}
              >
                {shortlistStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={4}
              value={shortlistDraft.notes}
              onChange={(event) => setShortlistDraft({ ...shortlistDraft, notes: event.target.value })}
              placeholder="Why is it on the list? Dealer quote, family need, must-check concern..."
            />
            <button className="primary-action" type="submit">
              Add to compare
            </button>
          </form>

          <div className="compare-side">
            {oneToOneCompareRows.length ? (
              <article className="comparison-card one-to-one-card" aria-label="One to one comparison">
                <span className="confidence high">One-to-one comparison</span>
                <h3>
                  {shortlistComparisons[0].item.brand} {shortlistComparisons[0].item.model} vs{" "}
                  {shortlistComparisons[1].item.brand} {shortlistComparisons[1].item.model}
                </h3>
                <div className="compare-table" role="table" aria-label="Compared metrics">
                  <div role="row">
                    <strong role="columnheader">Metric</strong>
                    <strong role="columnheader">{shortlistComparisons[0].item.model}</strong>
                    <strong role="columnheader">{shortlistComparisons[1].item.model}</strong>
                  </div>
                  {oneToOneCompareRows.map(([metric, first, second]) => (
                    <div role="row" key={metric}>
                      <span role="rowheader">{metric}</span>
                      <span role="cell">{first}</span>
                      <span role="cell">{second}</span>
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <article className="comparison-card one-to-one-card" aria-label="One to one comparison empty state">
                <span className="confidence low">One-to-one comparison</span>
                <h3>Add two cars to compare side by side.</h3>
                <p>Metrics will show price, variant, state basis, status, body type, fuel, seats, mileage, and safety.</p>
              </article>
            )}
            <article className="comparison-card example-card" aria-label="Compare preview">
              <span className="confidence medium">Example preview</span>
              <h3>
                {shortlistDraft.brand} {shortlistDraft.model}
              </h3>
              <p>{shortlistDraft.variant}</p>
              <p>{formatMoney(shortlistDraftPrice)} estimated price</p>
              {shortlistDraftDetails ? (
                <div className="spec-grid" aria-label="Selected car details">
                  <span>{shortlistDraftDetails.bodyType}</span>
                  <span>{shortlistDraftDetails.fuel}</span>
                  <span>{shortlistDraftDetails.seating} seats</span>
                  <span>{shortlistDraftDetails.mileage}</span>
                  <span>{shortlistDraftDetails.safety}</span>
                </div>
              ) : null}
              <div className="comparison-stats">
                <span>{shortlistDraft.status}</span>
                <span>{shortlistDraft.state}</span>
              </div>
              <small>{shortlistDraftSource}</small>
            </article>
            <div className="comparison-grid">
            {shortlistComparisons.length ? (
              shortlistComparisons.map((comparison) => {
                const inspection = inspectionChecklistByItemId.get(comparison.item.id);
                const comparisonDetails = modelDetailsFor(comparison.item.brand, comparison.item.model);
                return (
                  <article className="comparison-card" key={comparison.item.id}>
                    {inspection ? (
                      <div className="inspection-list">
                        <strong>Inspection checklist</strong>
                        {inspection.checklist.map((item) => (
                          <div className={`inspection-item ${item.priority.toLowerCase()}`} key={item.id}>
                            <span>{item.priority}</span>
                            <div>
                              <b>{item.title}</b>
                              <p>{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <h3>
                      {comparison.item.brand} {comparison.item.model}
                    </h3>
                    {comparison.item.variant ? <p>{comparison.item.variant}</p> : null}
                    <p>{formatMoney(comparison.item.budget)} estimated price</p>
                    {comparison.item.priceSource ? <small>{comparison.item.priceSource}</small> : null}
                    {comparisonDetails ? (
                      <div className="spec-grid" aria-label="Car details">
                        <span>{comparisonDetails.bodyType}</span>
                        <span>{comparisonDetails.fuel}</span>
                        <span>{comparisonDetails.seating} seats</span>
                        <span>{comparisonDetails.mileage}</span>
                        <span>{comparisonDetails.safety}</span>
                      </div>
                    ) : null}
                    <div className="form-row">
                      <select
                        value={comparison.item.status}
                        onChange={(event) =>
                          updateShortlistItem(comparison.item.id, {
                            budget: priceForModel(
                              comparison.item.brand,
                              comparison.item.model,
                              comparison.item.variant,
                              comparison.item.state,
                              event.target.value as ShortlistItem["status"],
                            ),
                            priceSource: priceSourceFor(
                              comparison.item.state ?? defaultPriceState,
                              event.target.value as ShortlistItem["status"],
                            ),
                            status: event.target.value as ShortlistItem["status"],
                          })
                        }
                      >
                        {shortlistStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <button className="save-button" type="button" onClick={() => removeShortlistItem(comparison.item.id)}>
                        Remove
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={comparison.item.notes}
                      onChange={(event) => updateShortlistItem(comparison.item.id, { notes: event.target.value })}
                      placeholder="Decision notes"
                    />
                  </article>
                );
              })
            ) : (
              <div className="empty-state">Add a model manually or from an owner note to begin comparison.</div>
            )}
            </div>
          </div>
        </div>
      </section>

      {showDeferredCommunityModules ? (
        <>
      <section className="panel playbook-panel" id="playbooks">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ownership playbooks</p>
            <h2>Turn scattered owner notes into “what should I check?” guidance.</h2>
          </div>
        </div>
        <div className="playbook-grid">
          {ownershipPlaybooks.map((playbook) => (
            <article className="playbook-card" key={playbook.key}>
              <div className="playbook-topline">
                <span>{playbook.confidence}</span>
                <strong>{playbook.evidenceCount} notes</strong>
              </div>
              <h3>
                {playbook.brand} {playbook.model}
              </h3>
              <p>{playbook.headline}</p>
              <div className="playbook-columns">
                <div>
                  <h4>Owner signals</h4>
                  {playbook.ownerSignals.map((signal) => (
                    <p key={signal}>{signal}</p>
                  ))}
                </div>
                <div>
                  <h4>Buyer checks</h4>
                  {playbook.buyerChecks.map((check) => (
                    <p key={check}>{check}</p>
                  ))}
                </div>
              </div>
              <button
                className="save-button"
                type="button"
                onClick={() => {
                  setQuery(`${playbook.brand} ${playbook.model}`);
                  setMode("latest");
                }}
              >
                Open matching notes
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel split-panel" id="write">
        <div>
          <p className="eyebrow">Publish</p>
          <h2>Write like the next owner depends on it.</h2>
          <p>
            The form pushes users toward the context that makes ownership advice useful: variant, city, odometer, real
            symptoms, costs, and outcomes.
          </p>
          <div className={`quality-card ${draftQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="quality-meter" aria-label={`Draft detail quality ${draftQuality.score} of ${draftQuality.maxScore}`}>
              <span style={{ width: `${(draftQuality.score / draftQuality.maxScore) * 100}%` }} />
            </div>
            <strong>
              Detail meter: {draftQuality.grade} · {draftQuality.score}/{draftQuality.maxScore}
            </strong>
            <div className="quality-prompts">
              {(draftQuality.missingPrompts.length ? draftQuality.missingPrompts : draftQuality.strengths).slice(0, 3).map((prompt) => (
                <p key={prompt}>{prompt}</p>
              ))}
            </div>
          </div>
        </div>
        <form className="composer" onSubmit={publishPost}>
          <input
            required
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Title"
          />
          <div className="form-row">
            <input
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
              placeholder="Your garage name"
            />
            <select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <input
              required
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              placeholder="Model"
            />
          </div>
          <div className="form-row">
            <input
              value={draft.variant}
              onChange={(event) => setDraft({ ...draft, variant: event.target.value })}
              placeholder="Variant"
            />
            <input
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
              placeholder="City"
            />
          </div>
          <input
            min="0"
            type="number"
            value={draft.odometerKm || ""}
            onChange={(event) => setDraft({ ...draft, odometerKm: Number(event.target.value) })}
            placeholder="Odometer km"
          />
          <textarea
            required
            rows={7}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
          />
          <button className="primary-action" type="submit">
            Publish note
          </button>
        </form>
      </section>

      <section className="panel" id="garage">
        <div className="section-head">
          <div>
            <p className="eyebrow">Garage timeline</p>
            <h2>Make ownership useful before something breaks.</h2>
          </div>
          <button className="save-button" type="button" onClick={exportGarage}>
            Export garage
          </button>
        </div>
        <div className="garage-grid">
          <form className="composer" onSubmit={addVehicle}>
            <h3>Add vehicle</h3>
            <input
              value={vehicleDraft.nickname}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
              placeholder="Nickname"
            />
            <div className="form-row">
              <select value={vehicleDraft.brand} onChange={(event) => setVehicleDraft({ ...vehicleDraft, brand: event.target.value })}>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                required
                value={vehicleDraft.model}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
                placeholder="Model"
              />
            </div>
            <div className="form-row">
              <input
                value={vehicleDraft.variant}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, variant: event.target.value })}
                placeholder="Variant"
              />
              <input
                value={vehicleDraft.city}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, city: event.target.value })}
                placeholder="City"
              />
            </div>
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={vehicleDraft.odometerKm || ""}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, odometerKm: Number(event.target.value) })}
                placeholder="Current odometer"
              />
              <input
                type="month"
                value={vehicleDraft.purchaseMonth}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, purchaseMonth: event.target.value })}
                aria-label="Purchase month"
              />
            </div>
            <button className="primary-action" type="submit">
              Save vehicle
            </button>
          </form>

          <form className="composer" onSubmit={addTimelineNote}>
            <h3>Add timeline note</h3>
            <select
              required
              value={timelineDraft.vehicleId}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })}
            >
              {garage.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname || vehicle.model}
                </option>
              ))}
            </select>
            <div className="form-row">
              <select
                value={timelineDraft.kind}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })}
              >
                {timelineKinds.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <input
                type="date"
                value={timelineDraft.happenedOn}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })}
                aria-label="Timeline date"
              />
            </div>
            <input
              required
              value={timelineDraft.title}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, title: event.target.value })}
              placeholder="What happened?"
            />
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={timelineDraft.amount || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
                placeholder="Amount paid"
              />
              <input
                min="0"
                type="number"
                value={timelineDraft.odometerKm || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
                placeholder="Odometer"
              />
            </div>
            <textarea
              rows={4}
              value={timelineDraft.note}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, note: event.target.value })}
              placeholder="Bill details, symptoms, shop notes, or what you would do differently."
            />
            <button className="primary-action" type="submit">
              Add timeline note
            </button>
          </form>
        </div>

        <div className="reminder-board" aria-label="Garage reminders">
          {garageReminders.length ? (
            garageReminders.map((reminder) => (
              <article className={`reminder-card ${reminder.urgency.toLowerCase()}`} key={reminder.id}>
                <span>{reminder.urgency}</span>
                <h3>{reminder.title}</h3>
                <p>
                  {reminder.vehicleName}: {reminder.detail}
                </p>
              </article>
            ))
          ) : (
            <div className="empty-state">No garage reminders right now. Keep logging service, insurance, tyre, and repair notes.</div>
          )}
        </div>

        <div className="timeline-board">
          {garage.map((vehicle) => (
            <article className="vehicle-card" key={vehicle.id}>
              <span className="pill">{vehicle.brand}</span>
              <h3>{vehicle.nickname}</h3>
              <p>
                {vehicle.model} {vehicle.variant} · {vehicle.city} · {vehicle.odometerKm.toLocaleString("en-IN")} km
              </p>
              {timeline
                .filter((entry) => entry.vehicleId === vehicle.id)
                .slice(0, 3)
                .map((entry) => (
                  <div className="timeline-entry" key={entry.id}>
                    <strong>
                      {entry.kind}: {entry.title}
                    </strong>
                    <span>
                      {formatMoney(entry.amount)} · {entry.odometerKm.toLocaleString("en-IN")} km · {entry.happenedOn}
                    </span>
                    <p>{entry.note}</p>
                  </div>
                ))}
            </article>
          ))}
        </div>

        <div className="ledger-board" aria-label="Garage running cost ledger">
          {garageCostLedger.map((ledger) => (
            <article className="ledger-card" key={ledger.vehicle.id}>
              <span>{ledger.vehicle.brand}</span>
              <h3>{ledger.vehicle.nickname || ledger.vehicle.model}</h3>
              <div className="ledger-stats">
                <p>
                  <strong>{formatMoney(ledger.totalSpend)}</strong>
                  <small>Total logged</small>
                </p>
                <p>
                  <strong>{ledger.costPerKm === null ? "—" : `${formatMoney(ledger.costPerKm, 2)}/km`}</strong>
                  <small>Approx cost/km</small>
                </p>
                <p>
                  <strong>{ledger.entryCount}</strong>
                  <small>Timeline notes</small>
                </p>
              </div>
              <p>
                {ledger.latestEntry
                  ? `Latest: ${ledger.latestEntry.kind.toLowerCase()} · ${ledger.latestEntry.title}`
                  : "No timeline spend yet. Add service, repair, tyre, fuel, or insurance notes."}
              </p>
            </article>
          ))}
        </div>

        <div className="insight-grid">
          {garageInsights.map((insight) => (
            <article className={`insight-card ${insight.tone}`} key={insight.id}>
              <span>{insight.tone}</span>
              <h3>{insight.title}</h3>
              <p>{insight.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="notebooks">
        <div className="section-head">
          <div>
            <p className="eyebrow">Model notebooks</p>
            <h2>Every model earns its own living knowledge page.</h2>
          </div>
        </div>
        <div className="notebook-grid">
          {notebooks.map((notebook) => {
            const isFollowing = followedModelSet.has(notebook.key);
            return (
              <article className="notebook-card" key={notebook.key}>
                <span className="pill">{notebook.brand}</span>
                <h3>{notebook.model}</h3>
                <p>{notebook.posts.length} owner notes</p>
                <div className="notebook-pitstop-strip">
                  <strong>Pit Stop for this car</strong>
                  {publishedPitStopClips
                    .filter((clip) => modelKeyFor(clip.brand ?? "", clip.model ?? "") === notebook.key)
                    .map((clip) => (
                      <a href={clip.embedUrl} key={clip.id} rel="noreferrer" target="_blank">
                        {clip.title}
                      </a>
                    ))}
                </div>
                <button className="save-button" type="button" onClick={() => toggleFollowModel(notebook.brand, notebook.model)}>
                  {isFollowing ? "Following" : "Follow model"}
                </button>
                <button className="save-button" type="button" onClick={() => shareModelNotebook(notebook.brand, notebook.model)}>
                  Share notebook
                </button>
                <div className="notebook-tags">
                  {knowledgeLabels
                    .filter((label) => notebook.posts.some((post) => post.label === label))
                    .map((label) => (
                      <button key={label} type="button" onClick={() => toggleFollowTopic(label)}>
                        {followedTopicSet.has(label) ? `Following ${label}` : label}
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel" id="loop">
        <div className="section-head">
          <div>
            <p className="eyebrow">Build loop</p>
            <h2>The product keeps moving through six lenses.</h2>
          </div>
        </div>
        <div className="loop-grid">
          {buildLoop.map((item) => (
            <article className="loop-card" key={item.role}>
              <span>{item.role}</span>
              <h3>{item.question}</h3>
              <p>{item.currentDecision}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel moderation-panel" id="moderation">
        <div className="section-head">
          <div>
            <p className="eyebrow">Moderator bay</p>
            <h2>Trust tools before scale tools.</h2>
          </div>
          <div className="moderation-stats">
            <span>{moderationSummary.openReports} open</span>
            <span>{moderationSummary.dismissedReports} dismissed</span>
            <span>{moderationSummary.removedReports} removed</span>
          </div>
        </div>
        <div className="moderation-grid">
          {reports.length ? (
            reports.map((report) => (
              <article className={`report-card ${report.status.toLowerCase()}`} key={report.id}>
                <span>{report.status}</span>
                <h3>{report.postTitle}</h3>
                <p>{report.reason}</p>
                <small>
                  Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleDateString("en-IN")}
                </small>
                <div className="signal-row">
                  <button type="button" onClick={() => setReportStatus(report.id, "Dismissed")}>
                    Dismiss
                  </button>
                  <button type="button" onClick={() => removeReportedPost(report)}>
                    Remove post
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">No reports yet. The queue is ready before the community needs it.</div>
          )}
        </div>
      </section>
        </>
      ) : null}
        </>
      ) : (
        <LoginGate isLoaded={auth.isLoaded} />
      )}

      <footer className="app-footer">
        <span>Otofolks customer web</span>
        <span className="ok">Care you can trust</span>
      </footer>
    </main>
  );
}
