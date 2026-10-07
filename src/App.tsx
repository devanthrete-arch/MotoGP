import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useClerk, useUser, useSession } from "@clerk/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloudWorkspacePanel } from "./CloudWorkspacePanel";
import { isSharedPost, loadCommunityComments, loadCommunityPosts, publishCommunityComment, publishCommunityPost } from "./communityCloud";
import { comparisonFields, legacyVariantSourceFor, verifiedComparisonFor } from "./comparisonCatalog";
import type { PrivateWorkspace } from "./cloudWorkspace";
import { createClerkSupabaseClient, readCloudConfig, sessionTokenGetter, type ClerkTokenGetter } from "./supabase";
import { ArrowRight, Bookmark, Car, ChevronDown, House, LogOut, Menu, MessageCircle, PenLine, Play, Scale, UserRound, X } from "lucide-react";
import { buildTopPitStopReels, filterPitStopClipsByCategory, pitStopClips, pitStopCategories, type PitStopClip } from "./pitstop";
export { buildTopPitStopReels, filterPitStopClipsByCategory } from "./pitstop";
import {
  buildLoop,
  knowledgeLabels,
  privacyReadinessItems,
  seedPosts,
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
  setStorageUser,
  readStoredJson,
  writeStoredJson,
} from "./storage";

type FeedMode = "latest" | "helpful" | "saved" | "following";
const seedPostIds = new Set(seedPosts.map(post => post.id));
const postSource = (id: string) => isSharedPost(id) ? "Shared" : seedPostIds.has(id) ? "Example" : "On this device";
type AppView = "top" | "feed" | "pit-stop" | "compare" | "account" | "garage" | "write";
const viewFromHash = (): AppView => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  if (hash.startsWith("pit-stop")) return "pit-stop";
  return hash === "feed" || hash === "compare" || hash === "account" || hash === "garage" || hash === "write" ? hash : "top";
};
const destinations = [
  { id: "top", label: "Home", icon: House },
  { id: "garage", label: "My garage", icon: Car },
  { id: "feed", label: "Community", icon: MessageCircle },
  { id: "pit-stop", label: "Pit Stop", icon: Play },
  { id: "compare", label: "Compare", icon: Scale },
] as const;


const showDeferredCommunityModules = false;
const adminModeratorEmails = [
  "piyushdtu23@gmail.com",
  "priyansht1999@gmail.com",
  "shauryashivam38@gmail.com",
  "hemangdtu@gmail.com",
] as const;
export const isAdminModeratorEmail = (email: string): boolean =>
  adminModeratorEmails.includes(email.toLowerCase() as (typeof adminModeratorEmails)[number]);

const pitStopCategoryFromHash = (): PitStopClip["category"] | null => {
  const hash = typeof window === "undefined" ? "" : window.location.hash.replace("#pit-stop-", "").toLowerCase();
  return pitStopCategories.find((category): category is PitStopClip["category"] => category !== "All" && category.toLowerCase() === hash) ?? null;
};
const pitStopCollectionUrl = (category: PitStopClip["category"]) => `/#pit-stop-${category.toLowerCase()}`;


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
  { brand: "Skoda", model: "Kushaq", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "18–20 km/l", safety: "5-star GNCAP", variants: [{ name: "Classic+ 1.0 TSI MT", price: 1069000 }, { name: "Prestige 1.5 TSI DSG", price: 1879000 }] },
  { brand: "Skoda", model: "Slavia", bodyType: "Sedan", fuel: "Petrol", seating: 5, mileage: "18–20 km/l", safety: "5-star GNCAP", variants: [{ name: "Classic 1.0 TSI MT", price: 999900 }, { name: "Prestige 1.5 TSI DSG", price: 1859000 }] },
  { brand: "Volkswagen", model: "Taigun", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "18–19 km/l", safety: "5-star GNCAP", variants: [{ name: "Comfortline 1.0 TSI MT", price: 1117000 }, { name: "GT Plus 1.5 DSG", price: 1900000 }] },
  { brand: "Volkswagen", model: "Virtus", bodyType: "Sedan", fuel: "Petrol", seating: 5, mileage: "18–20 km/l", safety: "5-star GNCAP", variants: [{ name: "Comfortline 1.0 TSI MT", price: 1106000 }, { name: "GT Plus 1.5 DSG", price: 1900000 }] },
  { brand: "Tata", model: "Tiago", bodyType: "Hatchback", fuel: "Petrol / CNG", seating: 5, mileage: "19–26 km/l", safety: "4-star GNCAP", variants: [{ name: "XE Petrol MT", price: 565000 }, { name: "XZ+ CNG", price: 862000 }] },
  { brand: "Tata", model: "Altroz", bodyType: "Hatchback", fuel: "Petrol / Diesel / CNG", seating: 5, mileage: "18–23 km/l", safety: "5-star GNCAP", variants: [{ name: "XE Petrol MT", price: 665000 }, { name: "XZ+ Diesel MT", price: 1065000 }] },
  { brand: "Tata", model: "Curvv", bodyType: "SUV Coupe", fuel: "Petrol / Diesel", seating: 5, mileage: "16–20 km/l", safety: "5-star BNCAP", variants: [{ name: "Smart Petrol MT", price: 1000000 }, { name: "Accomplished+ Diesel DCA", price: 1925000 }] },
  { brand: "Maruti Suzuki", model: "Swift", bodyType: "Hatchback", fuel: "Petrol / CNG", seating: 5, mileage: "24–33 km/l", safety: "ESC available", variants: [{ name: "LXi Petrol MT", price: 649000 }, { name: "ZXi+ AMT", price: 999000 }] },
  { brand: "Maruti Suzuki", model: "Baleno", bodyType: "Hatchback", fuel: "Petrol / CNG", seating: 5, mileage: "22–30 km/l", safety: "6 airbags available", variants: [{ name: "Sigma Petrol MT", price: 665000 }, { name: "Alpha AMT", price: 996000 }] },
  { brand: "Maruti Suzuki", model: "Fronx", bodyType: "Crossover", fuel: "Petrol / CNG", seating: 5, mileage: "21–29 km/l", safety: "6 airbags available", variants: [{ name: "Sigma 1.2 MT", price: 749000 }, { name: "Turbo Alpha AT", price: 1320000 }] },
  { brand: "Maruti Suzuki", model: "Ertiga", bodyType: "MPV", fuel: "Petrol / CNG", seating: 7, mileage: "20–26 km/l", safety: "6 airbags available", variants: [{ name: "LXi Petrol MT", price: 869000 }, { name: "ZXi+ AT", price: 1350000 }] },
  { brand: "Hyundai", model: "i20", bodyType: "Hatchback", fuel: "Petrol", seating: 5, mileage: "17–20 km/l", safety: "6 airbags standard", variants: [{ name: "Magna Petrol MT", price: 735000 }, { name: "Asta(O) Turbo DCT", price: 1160000 }] },
  { brand: "Hyundai", model: "Exter", bodyType: "Micro SUV", fuel: "Petrol / CNG", seating: 5, mileage: "19–27 km/l", safety: "6 airbags standard", variants: [{ name: "HX 2 Petrol MT", price: 579900 }, { name: "HX 10 Petrol AMT", price: 941900 }] },
  { brand: "Hyundai", model: "Verna", bodyType: "Sedan", fuel: "Petrol", seating: 5, mileage: "18–21 km/l", safety: "5-star GNCAP", variants: [{ name: "EX Petrol MT", price: 1100000 }, { name: "SX(O) Turbo DCT", price: 1750000 }] },
  { brand: "Kia", model: "Carens", bodyType: "MPV", fuel: "Petrol / Diesel", seating: 7, mileage: "16–21 km/l", safety: "6 airbags standard", variants: [{ name: "Premium Petrol MT", price: 1060000 }, { name: "Luxury+ Diesel AT", price: 1990000 }] },
  { brand: "Mahindra", model: "XUV 3XO", bodyType: "Compact SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "17–21 km/l", safety: "5-star GNCAP", variants: [{ name: "MX1 Petrol MT", price: 779000 }, { name: "AX7L Diesel AT", price: 1549000 }] },
  { brand: "Mahindra", model: "Bolero", bodyType: "SUV", fuel: "Diesel", seating: 7, mileage: "16 km/l", safety: "2 airbags", variants: [{ name: "B4 Diesel MT", price: 998000 }, { name: "B6(O) Diesel MT", price: 1119000 }] },
  { brand: "Toyota", model: "Fortuner", bodyType: "SUV", fuel: "Diesel", seating: 7, mileage: "10–15 km/l", safety: "7 airbags", variants: [{ name: "4x2 MT", price: 3343000 }, { name: "Legender 4x4 AT", price: 5134000 }] },
  { brand: "Toyota", model: "Glanza", bodyType: "Hatchback", fuel: "Petrol / CNG", seating: 5, mileage: "22–30 km/l", safety: "6 airbags available", variants: [{ name: "E Petrol MT", price: 674000 }, { name: "V AMT", price: 999000 }] },
  { brand: "Renault", model: "Kiger", bodyType: "Compact SUV", fuel: "Petrol", seating: 5, mileage: "19–20 km/l", safety: "Check current rating", variants: [{ name: "Authentic 1.0 MT", price: 581000 }, { name: "RXZ Turbo CVT", price: 1150000 }] },
  { brand: "Nissan", model: "Magnite", bodyType: "Compact SUV", fuel: "Petrol / CNG", seating: 5, mileage: "18–20 km/l", safety: "4-star GNCAP", variants: [{ name: "XE Petrol MT", price: 620000 }, { name: "Turbo CVT", price: 1146000 }] },
  { brand: "MG", model: "Astor", bodyType: "SUV", fuel: "Petrol", seating: 5, mileage: "14–16 km/l", safety: "5-star GNCAP", variants: [{ name: "Style Petrol MT", price: 1050000 }, { name: "Savvy Turbo CVT", price: 1800000 }] },
  { brand: "MG", model: "Hector", bodyType: "SUV", fuel: "Petrol / Diesel", seating: 5, mileage: "13–18 km/l", safety: "ADAS available", variants: [{ name: "Style Petrol MT", price: 1500000 }, { name: "Savvy Pro Diesel MT", price: 2240000 }] },
] as const;

const brands = [...new Set(modelPriceOptions.map((option) => option.brand))];
const modelsForBrand = (brand: string) => modelPriceOptions.filter((option) => option.brand === brand);
const optionForModel = (brand: string, model: string) =>
  modelPriceOptions.find((option) => option.brand === brand && option.model === model);
const variantsForModel = (brand: string, model: string) => optionForModel(brand, model)?.variants ?? [];
export const priceForModel = (
  brand: string,
  model: string,
  variant = variantsForModel(brand, model)[0]?.name ?? "",
  state: string = defaultPriceState,
  status: ShortlistItem["status"] = "New",
): number => {
  const basePrice = variantsForModel(brand, model).find((option) => option.name === variant)?.price ?? 0;
  void state;
  void status;
  return basePrice;
};
const firstModelForBrand = (brand: string) => modelsForBrand(brand)[0]?.model ?? "";
const firstVariantForModel = (brand: string, model: string) => variantsForModel(brand, model)[0]?.name ?? "";
const modelDetailsFor = (brand: string, model: string) => optionForModel(brand, model);
const stateForCity = (city: string): PriceState | "" => cityStateMap[city.trim()] ?? "";
const priceSourceFor = (state: string, _status: ShortlistItem["status"]) =>
  `Example price only; confirm a dealer quote in ${state || defaultPriceState}`;
type AppProps = {
  clerkEnabled?: boolean;
};

type AppAuthState = {
  userId?: string;
  cloudClient?: SupabaseClient | null;
  cloudToken?: ClerkTokenGetter | null;
  cloudError?: string;
  isLoaded: boolean;
  isSignedIn: boolean;
  requireSignIn: (destination?: string) => void;
};

const clerkReturnUrl = (destination?: string) => {
  const url = new URL(window.location.href);
  if (destination) url.hash = destination;
  url.searchParams.set("clerk_return", "1");
  return url.toString();
};

const ClerkAccountPanel = ({ savedCount }: { savedCount: number }) => {
  const clerk = useClerk();
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
        <button className="secondary-action" type="button" onClick={() => void clerk.signOut({ redirectUrl: "/" })}>
          <LogOut size={18} aria-hidden="true" /> Log out
        </button>
      </div>
    </>
  ) : (
    <>
      <h2>Make yourself at home</h2>
      <p>Keep your favourite advice and car comparisons together.</p>
      <div className="auth-actions">
        <SignInButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
          <button className="primary-action" type="button">
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
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
      <h2>Your Otofolks starts here</h2>
      <p>Sign in to join other owners and save what helps.</p>
    </div>
    <div className="auth-actions">
      <SignInButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
        <button className="primary-action" disabled={!isLoaded} type="button">
          Log in
        </button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl={clerkReturnUrl()}>
        <button className="secondary-action" disabled={!isLoaded} type="button">
          Create account
        </button>
      </SignUpButton>
    </div>
  </section>
);

const ClerkConnectedApp = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const clerk = useClerk();
  const cloud = useMemo(() => {
    try {
      const config = readCloudConfig(import.meta.env);
      const getToken = config && session ? sessionTokenGetter(session, () => clerk.session) : null;
      return { client: config && getToken ? createClerkSupabaseClient(config, getToken) : null, getToken };
    } catch {
      return { client: null, error: "Account saving is temporarily unavailable. Your data stays on this device." };
    }
  }, [clerk, session]);
  const [pendingSignIn, setPendingSignIn] = useState<string | null>(null);
  useEffect(() => {
    if (!isLoaded || !pendingSignIn) return;
    setPendingSignIn(null);
    if (!isSignedIn) void clerk.openSignIn({ forceRedirectUrl: clerkReturnUrl(pendingSignIn) });
  }, [clerk, isLoaded, isSignedIn, pendingSignIn]);

  return (
    <OtofolksApp
      key={session?.id ?? user?.id ?? "signed-out"}
      auth={{
        userId: user?.id,
        cloudClient: cloud.client,
        cloudToken: cloud.getToken,
        cloudError: cloud.error,
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        requireSignIn: (destination = "#top") => {
          setPendingSignIn(destination);
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

type ComparisonSection = { title: string; rows: [string, string, string][] };
const comparisonSectionTitles = comparisonFields.map((section) => section.title);

const compareMetricSections = (comparisons: ShortlistComparison[]): ComparisonSection[] => {
  const [first, second] = comparisons;
  if (!first || !second) return [];

  const firstDetails = modelDetailsFor(first.item.brand, first.item.model);
  const secondDetails = modelDetailsFor(second.item.brand, second.item.model);
  const firstVerified = verifiedComparisonFor(first.item.brand, first.item.model, first.item.variant);
  const secondVerified = verifiedComparisonFor(second.item.brand, second.item.model, second.item.variant);
  const knownValue = (value?: string) => value ?? "Not verified";
  return comparisonFields.map((section) => {
    const rows: ComparisonSection["rows"] = section.fields.map(([key, label]) => [
      label,
      key === "bodyType" ? knownValue(firstDetails?.bodyType) : key === "seats" ? knownValue(firstDetails && String(firstDetails.seating)) : knownValue(firstVerified?.values[key]),
      key === "bodyType" ? knownValue(secondDetails?.bodyType) : key === "seats" ? knownValue(secondDetails && String(secondDetails.seating)) : knownValue(secondVerified?.values[key]),
    ]);
    if (section.title === "Basic Information") rows.unshift(
      ["Model", `${first.item.brand} ${first.item.model}`, `${second.item.brand} ${second.item.model}`],
      ["Variant", first.item.variant ?? "Not selected", second.item.variant ?? "Not selected"],
      ["Example price", formatMoney(first.item.budget), formatMoney(second.item.budget)],
      ["Price region", first.item.state ?? defaultPriceState, second.item.state ?? defaultPriceState],
      ["Your status", first.item.status, second.item.status],
    );
    return { title: section.title, rows };
  });
};

// Keep guidance descriptive until both selected variants have dependable data.
const buildCompareVerdict = (comparisons: ShortlistComparison[]) => {
  const [a, b] = comparisons;
  if (!a || !b) return null;
  const da = modelDetailsFor(a.item.brand, a.item.model);
  const db = modelDetailsFor(b.item.brand, b.item.model);
  const va = verifiedComparisonFor(a.item.brand, a.item.model, a.item.variant);
  const vb = verifiedComparisonFor(b.item.brand, b.item.model, b.item.variant);
  const nameA = `${a.item.brand} ${a.item.model}`;
  const nameB = `${b.item.brand} ${b.item.model}`;

  const diffs: string[] = [];
  if (da && db && da.bodyType !== db.bodyType) {
    diffs.push(`the ${nameA} is a ${da.bodyType.toLowerCase()}, while the ${nameB} is a ${db.bodyType.toLowerCase()}`);
  }
  if (da && db && da.seating !== db.seating) {
    const roomier = da.seating > db.seating ? nameA : nameB;
    diffs.push(`${roomier} seats more (${Math.max(da.seating, db.seating)})`);
  }
  if (va?.values.fuel && vb?.values.fuel && va.values.fuel !== vb.values.fuel) {
    diffs.push(`these variants use different fuels (${va.values.fuel} vs ${vb.values.fuel})`);
  }
  if (va?.values.mileage && vb?.values.mileage && va.values.mileage !== vb.values.mileage) {
    diffs.push(`their certified mileage differs (${va.values.mileage} vs ${vb.values.mileage})`);
  }
  if (a.item.priceSource === "Your dealer quote" && b.item.priceSource === "Your dealer quote" && a.item.budget !== b.item.budget) {
    const cheaper = a.item.budget < b.item.budget ? nameA : nameB;
    diffs.push(`your quote for the ${cheaper} is ${formatMoney(Math.abs(a.item.budget - b.item.budget))} lower`);
  }
  const coreDifference = diffs.length
    ? `${diffs.slice(0, 2).join(", and ")}.`
    : "The verified details are not enough to identify a clear difference yet.";
  const reason = va && vb
    ? "Compare your dealer quotes, test-drive both variants and check service support near you before deciding."
    : "We cannot recommend one from incomplete variant specs. Check the manufacturer links, get dealer quotes and test-drive both.";
  return { coreDifference, reason };
};

// Turn an Instagram permalink into its embeddable player URL. Reel/post/tv
// permalinks support /embed; anything else is returned as-is (and the modal
// offers an "Open on Instagram" fallback if the page refuses to frame).
const isEmbeddableReel = (url: string) => {
  try {
    const u = new URL(url);
    return u.hostname.includes("instagram.com") && /\/(reel|p|tv)\//.test(u.pathname);
  } catch {
    return false;
  }
};
const toEmbedSrc = (url: string) => {
  if (!isEmbeddableReel(url)) return url;
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/$/, "")}/embed`;
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

export function OtofolksApp({ auth, clerkEnabled = false }: AppProps & { auth: AppAuthState }) {
  setStorageUser(auth.isSignedIn ? auth.userId ?? null : null);
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [sharedPosts, setSharedPosts] = useState<OwnerPost[]>([]);
  const [communityStatus, setCommunityStatus] = useState("Loading shared notes...");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityRefresh, setCommunityRefresh] = useState(0);
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
  const [activeReel, setActiveReel] = useState<PitStopClip | null>(null);
  const [selectedPost, setSelectedPost] = useState<OwnerPost | null>(posts[0] ?? null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPost>(initialDraft);
  const [vehicleDraft, setVehicleDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [timelineDraft, setTimelineDraft] = useState<DraftTimelineEntry>(() => ({
    ...initialTimelineDraft,
    vehicleId: loadGarage()[0]?.id ?? "",
  }));
  const [shortlistDraft, setShortlistDraft] = useState<DraftShortlistItem>(initialShortlistDraft);
  const [dealerQuote, setDealerQuote] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportDraft, setReportDraft] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [helpfulIds, setHelpfulIds] = useState<string[]>(() => readStoredJson("otofolks.helpful.v1", []));
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() => readStoredJson("otofolks.confirmed.v1", []));
  const [activeView, setActiveView] = useState<AppView>(viewFromHash);
  useEffect(() => {
    const syncView = () => {
      setActiveView(viewFromHash());
      setNavMenuOpen(false);
      setActiveReel(null);
      setComposerOpen(false);
      window.scrollTo({ top: 0 });
    };
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavMenuOpen(false);
        setActiveReel(null);
        document.querySelector<HTMLButtonElement>(".nav-toggle")?.focus();
      }
    };
    window.addEventListener("hashchange", syncView);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("hashchange", syncView);
      window.removeEventListener("keydown", closeMenu);
    };
  }, []);
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const feedPosts = useMemo(() => [...sharedPosts, ...posts], [sharedPosts, posts]);

  useEffect(() => {
    if (!auth.isSignedIn) { setSharedPosts([]); return; }
    if (!auth.cloudClient || !auth.cloudToken) {
      setCommunityStatus("Shared community is not configured. Local examples remain available.");
      return;
    }
    if (!isOnline) { setCommunityStatus("Offline. Shared notes cannot refresh right now."); return; }
    let active = true;
    loadCommunityPosts(auth.cloudClient, auth.cloudToken).then(next => {
      if (active) { setSharedPosts(next); setCommunityStatus(""); }
    }).catch(error => {
      if (active) setCommunityStatus(error instanceof Error ? error.message : "Shared notes could not load.");
    });
    return () => { active = false; };
  }, [auth.cloudClient, auth.cloudToken, auth.isSignedIn, communityRefresh, isOnline]);

  useEffect(() => {
    if (!auth.isSignedIn || !auth.cloudClient || !auth.cloudToken || !selectedPost || !isSharedPost(selectedPost.id) || !isOnline) return;
    const id = selectedPost.id;
    let active = true;
    loadCommunityComments(auth.cloudClient, auth.cloudToken, id).then(comments => {
      if (active) setSharedPosts(current => current.map(post => post.id === id ? { ...post, comments } : post));
    }).catch(() => {
      if (active) setCommunityStatus("Comments could not load. Please retry when connected.");
    });
    return () => { active = false; };
  }, [auth.cloudClient, auth.cloudToken, auth.isSignedIn, isOnline, selectedPost?.id]);

  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  const filteredPosts = useMemo(() => {
    const modeFilteredPosts = filterPostsByMode(feedPosts, {
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
  }, [feedPosts, followedModelSet, followedTopicSet, mode, query, saved, selectedFeedState, selectedLabel]);
  useEffect(() => {
    const next = filteredPosts.find(post => post.id === selectedPost?.id) ?? filteredPosts[0] ?? null;
    if (next !== selectedPost) setSelectedPost(next);
  }, [filteredPosts, selectedPost]);
  useEffect(() => { setCommentDraft(""); setReportDraft(""); }, [selectedPost?.id]);
  useEffect(() => { setDealerQuote(0); }, [shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, shortlistDraft.state]);

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
  const comparisonSections = useMemo(() => compareMetricSections(shortlistComparisons), [shortlistComparisons]);
  const displayedComparisonSections: ComparisonSection[] = comparisonSections.length
    ? comparisonSections : comparisonSectionTitles.map((title) => ({ title, rows: [] }));
  const compareVerdict = useMemo(() => buildCompareVerdict(shortlistComparisons), [shortlistComparisons]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, posts), [posts, shortlist]);
  const inspectionChecklistByItemId = useMemo(
    () => new Map(inspectionChecklists.map((checklist) => [checklist.item.id, checklist])),
    [inspectionChecklists],
  );
  const draftQuality = useMemo(() => assessPostQuality(draft), [draft]);
  const selectedPostQuality = useMemo(() => (selectedPost ? assessPostQuality(selectedPost) : null), [selectedPost]);
  const shortlistDraftPrice = dealerQuote || priceForModel(
    shortlistDraft.brand,
    shortlistDraft.model,
    shortlistDraft.variant,
    shortlistDraft.state,
    shortlistDraft.status,
  );
  const shortlistDraftSource = dealerQuote ? "Your dealer quote" : priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status);
  const shortlistDraftDetails = modelDetailsFor(shortlistDraft.brand, shortlistDraft.model);

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
    if (isSharedPost(postId)) return;
    const removing = helpfulIds.includes(postId);
    const ids = removing ? helpfulIds.filter(id => id !== postId) : [...helpfulIds, postId];
    setHelpfulIds(ids);
    writeStoredJson("otofolks.helpful.v1", ids);
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: Math.max(0, post.helpful + (removing ? -1 : 1)) } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const confirmFix = (postId: string) => {
    if (isSharedPost(postId)) return;
    const removing = confirmedIds.includes(postId);
    const ids = removing ? confirmedIds.filter(id => id !== postId) : [...confirmedIds, postId];
    setConfirmedIds(ids);
    writeStoredJson("otofolks.confirmed.v1", ids);
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: Math.max(0, post.fixesConfirmed + (removing ? -1 : 1)) } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !commentDraft.trim()) return;
    if (!isSharedPost(selectedPost.id)) {
      setCommunityStatus("This is a local example. Select a shared note to join its discussion.");
      return;
    }
    if (!auth.isSignedIn) { auth.requireSignIn("#feed"); return; }
    if (!auth.cloudClient || !isOnline) { setCommunityStatus("Connect to publish a comment."); return; }
    const id = selectedPost.id;
    const author = (profile.displayName.trim() || "Anonymous garage member").slice(0, 80);
    const body = commentDraft.trim();
    setCommunityBusy(true);
    try {
      await publishCommunityComment(auth.cloudClient, id, author, body);
      setSharedPosts(current => current.map(post => post.id === id
        ? { ...post, comments: [`${author}: ${body}`, ...post.comments] } : post));
      setCommentDraft("");
      setCommunityStatus("");
      try {
        if (!auth.cloudToken) throw new Error("Sign in to read comments.");
        const comments = await loadCommunityComments(auth.cloudClient, auth.cloudToken, id);
        setSharedPosts(current => current.map(post => post.id === id ? { ...post, comments } : post));
      } catch {
        setCommunityStatus("Comment published. Discussion could not refresh yet.");
      }
    } catch (error) {
      setCommunityStatus(error instanceof Error ? error.message : "Comment failed. Please retry.");
    } finally { setCommunityBusy(false); }
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
    setActionMessage("Report draft saved on this device. It has not been sent to moderators.");
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
    if (shortlist.some(item => item.brand === shortlistDraft.brand && item.model === shortlistDraft.model && item.variant === shortlistDraft.variant && item.state === shortlistDraft.state)) {
      setActionMessage("That car and variant are already in your comparison.");
      return;
    }
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
    setDealerQuote(0);
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

  const publishPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.isSignedIn) { auth.requireSignIn("#feed"); return; }
    if (!auth.cloudClient || !isOnline) {
      setCommunityStatus("Shared publishing is unavailable. Connect and retry.");
      return;
    }
    setCommunityBusy(true);
    try {
      const post = await publishCommunityPost(auth.cloudClient, {
        ...draft,
        author: (draft.author.trim() || "Anonymous owner").slice(0, 80),
        odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
      });
      setSharedPosts(current => [post, ...current]);
      setSelectedPost(post);
      setDraft(initialDraft);
      setQuery("");
      setMode("latest");
      setSelectedLabel("All");
      setSelectedFeedState("All");
      window.location.hash = "feed";
      setCommunityStatus("Published to the shared community.");
    } catch (error) {
      setCommunityStatus(error instanceof Error ? error.message : "Publishing failed. Please retry.");
    } finally { setCommunityBusy(false); }
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
    setActionMessage("Vehicle saved on this device.");
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
    setActionMessage("Maintenance entry saved on this device.");
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
  };

  const shouldShowFeatures = auth.isSignedIn;
  const requireSignIn = (destination = "#top") => {
    if (shouldShowFeatures) return true;
    auth.requireSignIn(destination);
    if (!auth.isLoaded) {
      setActionMessage("Loading sign-in...");
      return false;
    }
    setActionMessage(clerkEnabled ? "Sign in to continue." : "Sign-in is temporarily unavailable. Please try again later.");
    return false;
  };
  const handleFeatureNav = (event: MouseEvent<HTMLAnchorElement>) => {
    setNavMenuOpen(false);
    if (event.currentTarget.hash !== "#top" && !shouldShowFeatures) {
      event.preventDefault();
      requireSignIn(event.currentTarget.hash);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" onClick={() => setNavMenuOpen(false)}>
            <span className="logo-mark" aria-hidden="true"><span className="logo-car" /><span className="logo-wrench" /></span>
            Otofolks
          </a>
          <button aria-controls="primary-nav-links" aria-expanded={navMenuOpen}
            aria-label={navMenuOpen ? "Close menu" : "Open menu"} className="nav-toggle"
            onClick={() => setNavMenuOpen((open) => !open)} type="button">
            {navMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className={`nav-actions ${navMenuOpen ? "is-open" : ""}`} id="primary-nav-links">
            {destinations.map(({ id, label, icon: Icon }) => (
              <a href={`#${id}`} key={id} onClick={handleFeatureNav} aria-current={activeView === id ? "page" : undefined}>
                <Icon size={20} aria-hidden="true" />{label}
              </a>
            ))}
            <a href="#account" onClick={handleFeatureNav} aria-current={activeView === "account" ? "page" : undefined}>
              <UserRound size={20} aria-hidden="true" />{auth.isSignedIn ? "Account" : "Sign in"}
            </a>
          </div>
        </nav>
      </header>

      <section className="home-view" hidden={activeView !== "top"} aria-label="Home">
        <div className="home-heading">
          <p className="eyebrow">Your car companion</p>
          <h1>A little help for every drive.</h1>
          <p>Real owners. Useful advice. Happier kilometres.</p>
        </div>
        <div className="home-shortcuts">
          {[
            { id: "garage", label: "My garage", detail: "Vehicles and maintenance", icon: Car },
            { id: "feed", label: "Ask the community", detail: "Advice from fellow owners", icon: MessageCircle },
            { id: "pit-stop", label: "Take a Pit Stop", detail: "Car stories and inspiration", icon: Play },
            { id: "compare", label: "Find your next car", detail: "Compare your favourites", icon: Scale },
            { id: "feed", label: "Saved advice", detail: "Good tips, kept close", icon: Bookmark },
          ].map(({ id, label, detail, icon: Icon }) => (
            <a className="home-shortcut" href={`#${id}`} key={label} onClick={(event) => {
              handleFeatureNav(event);
              if (id === "feed" && shouldShowFeatures) { setMode(label === "Saved advice" ? "saved" : "latest"); setQuery(""); }
            }}>
              <Icon size={25} aria-hidden="true" />
              <h2>{label}</h2><p>{detail}</p>
              <ArrowRight size={18} aria-hidden="true" className="shortcut-arrow" />
            </a>
          ))}
        </div>
        <div className="owner-topics">
          <h2>What is on your mind?</h2>
          <div className="topic-links">
            {["Service costs", "Tyres", "Mileage", "Road trips"].map((topic) => (
              <a href="#feed" key={topic} onClick={(event) => {
                handleFeatureNav(event);
                if (shouldShowFeatures) { setQuery(topic === "Service costs" ? "service" : topic); setMode("latest"); }
              }}>{topic}<ArrowRight size={16} aria-hidden="true" /></a>
            ))}
          </div>
        </div>
        <div className="service-coming">
          <div><span className="eyebrow">Coming to Otofolks</span><h2>Car care, all together.</h2>
            <p>Service bookings are on the way. Track your vehicles in My garage today.</p></div>
          <div className="service-screens">
            <img src="/app-screens/service-home.png" alt="Preview of the upcoming Otofolks service home" />
            <img src="/app-screens/provider-about.png" alt="Preview of service provider details" />
            <img src="/app-screens/booking-schedule.png" alt="Preview of service scheduling" />
          </div>
        </div>
      </section>

      <section className="panel account-view" id="account" hidden={activeView !== "account"} aria-label="Account">
        {clerkEnabled ? <ClerkAccountPanel savedCount={saved.size} /> :
          <><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></>}
        {auth.isSignedIn && auth.userId ? <CloudWorkspacePanel
          client={auth.cloudClient ?? null} owner={auth.userId} configurationError={auth.cloudError}
          workspace={{ version: 1, profile, garage, timeline, shortlist, follows, saved: [...saved] }}
          onRestore={(data: PrivateWorkspace) => {
            persistProfile(data.profile);
            persistGarage(data.garage);
            persistTimeline(data.timeline);
            persistShortlist(data.shortlist);
            persistFollows(data.follows);
            setSaved(new Set(data.saved));
            saveSaved(new Set(data.saved));
            setTimelineDraft({ ...initialTimelineDraft, vehicleId: data.garage[0]?.id ?? "" });
          }}
        /> : null}
      </section>

      {actionMessage ? (
        <div className="action-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <section hidden={isOnline} className={`connection-strip ${connectionStatus.tone}`} aria-label="Connection status">
        <strong>{connectionStatus.label}</strong>
        <span>{connectionStatus.detail}</span>
      </section>

      {shouldShowFeatures ? (
        <>
      {activeView !== "top" && activeView !== "account" && activeView !== "pit-stop" ? (
        <p className="data-notice" role="note">{activeView === "feed" || activeView === "write"
          ? "Shared notes are visible to signed-in members. Local examples stay on this device."
          : auth.cloudClient ? "Changes stay on this device until you save them in Account."
            : "Saved on this device for your account."}</p>
      ) : null}
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

      <section className="panel" id="feed" hidden={activeView !== "feed"}>
        {communityStatus ? <p role="status">{communityStatus}</p> : null}
        {auth.cloudClient && isOnline ? <button className="save-button" type="button" onClick={() => {
          setCommunityStatus("Loading shared notes...");
          setCommunityRefresh(current => current + 1);
        }}>Refresh shared notes</button> : null}
        <div className="feed-composer">
          {!composerOpen ? (
            <button className="composer-prompt" type="button" onClick={() => setComposerOpen(true)}>
              <span className="composer-avatar" aria-hidden="true">
                {(profile.displayName.trim() || "O").charAt(0).toUpperCase()}
              </span>
              <span className="composer-placeholder">Share advice with the community…</span>
              <PenLine size={18} aria-hidden="true" />
            </button>
          ) : (
            <form className="composer composer-expanded" onSubmit={publishPost}>
              <div className="composer-expanded-head">
                <span className="composer-avatar" aria-hidden="true">
                  {(profile.displayName.trim() || "O").charAt(0).toUpperCase()}
                </span>
                <strong>Post to the community</strong>
                <button className="composer-close" type="button" aria-label="Close composer" onClick={() => setComposerOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <input
                value={draft.title}
                maxLength={160}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Title — e.g. Nexon clutch got heavy at 38k km"
                required
              />
              <textarea
                rows={3}
                maxLength={10000}
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                placeholder="Share what happened, what you tried, and what helped…"
                required
              />
              <div className="form-row">
                <select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
                  {knowledgeLabels.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
                <select value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
                  {brands.map((brand) => (
                    <option key={brand}>{brand}</option>
                  ))}
                </select>
                <input
                  value={draft.model}
                  onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                  placeholder="Model (optional)"
                />
              </div>
              <div className="composer-actions">
                <span className="form-note">Posting as {profile.displayName.trim() || "Anonymous owner"}</span>
                <button className="primary-action" disabled={communityBusy || !auth.cloudClient || !isOnline} type="submit">Post</button>
              </div>
            </form>
          )}
        </div>

        <div className="section-head">
          <div>
            <p className="eyebrow">Community feed</p>
            <h2>From one owner to another</h2>
            <a className="primary-action" href="#write">Write an owner note</a>
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
                >
                  <div>
                    <span className="pill">{post.label}</span>
                    <span className="pill">{postSource(post.id)}</span>
                    <h3><button className="post-open" type="button" onClick={() => {
                      setSelectedPost(post);
                      requestAnimationFrame(() => document.getElementById("note-detail")?.focus());
                    }}>{post.title}</button></h3>
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

          <aside className="detail-card" id="note-detail" tabIndex={-1} aria-label="Owner note">
            {selectedPost ? (
              <>
                <span className="pill">{selectedPost.label}</span>
                <span className="pill">{postSource(selectedPost.id)}</span>
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
                  <button disabled={isSharedPost(selectedPost.id)} type="button" aria-pressed={helpfulIds.includes(selectedPost.id)} onClick={() => markHelpful(selectedPost.id)}>
                    Helpful · {selectedPost.helpful}
                  </button>
                  {selectedPost.label === "Fix" ? (
                    <button disabled={isSharedPost(selectedPost.id)} type="button" aria-pressed={confirmedIds.includes(selectedPost.id)} onClick={() => confirmFix(selectedPost.id)}>
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
                    maxLength={4000}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Add a useful reply, correction, bill detail, or ownership question."
                  />
                  <button className="primary-action" disabled={communityBusy || !isOnline || !isSharedPost(selectedPost.id)} type="submit">
                    Add comment
                  </button>
                </form>
                <details className="report-disclosure"><summary>Report this note</summary>
                <form className="inline-form report-form" onSubmit={reportSelectedPost}>
                  <textarea
                    required
                    rows={3}
                    value={reportDraft}
                    onChange={(event) => setReportDraft(event.target.value)}
                    placeholder="Tell us what is wrong with this note."
                  />
                  <button className="save-button" type="submit">
                    Save report draft
                  </button>
                </form>
                </details>
              </>
            ) : (
              <p>Select a post to inspect owner details.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="panel pit-stop-panel" id="pit-stop" hidden={activeView !== "pit-stop"}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Pit Stop</p>
            <h2>A break for your car obsession</h2>
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
              className="pit-stop-card"
              href={clip.embedUrl}
              key={clip.id}
              type="button"
              onClick={() => setActiveReel(clip)}
            >
              <div className="pit-stop-thumb" aria-hidden="true">
                <span className="play-badge"><Play size={20} /></span>
                <strong>{clip.thumbnailLabel}</strong>
                <small>{clip.brand ?? "Cars"}</small>
              </div>
              <span>{clip.category}</span>
              <h3>{clip.title}</h3>
              <p>{clip.summary}</p>
              {clip.brand && clip.model ? <small>Related: {clip.brand} {clip.model}</small> : null}
              <em>Explore on Instagram (opens a new tab)</em>
            </a>
          ))}
        </div>
        {selectedPitStopCollection && selectedPitStopReels.length > 0 ? (
        <div className="pit-stop-reel-section" id={pitStopCollectionUrl(selectedPitStopCollection).slice(2)}>
          <div className="section-head compact">
            <div>
              <p className="eyebrow">{selectedPitStopCollection}</p>
              <h3>Selected clips</h3>
            </div>
            <span className="form-note">{selectedPitStopReels.length} clips</span>
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

      <section className="panel" id="compare" hidden={activeView !== "compare"}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Compare</p>
            <h2>Which car feels right?</h2>
          </div>
        </div>
        <div className="shortlist-grid">
          <form className="composer" onSubmit={addShortlistItem}>
            <h3>Add model to compare</h3>
            <div className="form-row">
              <select
                aria-label="Car brand"
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
                aria-label="Car model"
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
                aria-label="Variant"
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
                aria-label="State"
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
            {legacyVariantSourceFor(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant) ? (
              <p className="form-note">This variant is not listed in the manufacturer's current online range. It may still be available as old stock or used.</p>
            ) : null}
            <div className="form-row">
              <div className="price-display" aria-label="Model price">
                <span>{dealerQuote ? "Your dealer quote" : "Example price"}</span>
                <strong>{formatMoney(shortlistDraftPrice)}</strong>
                <small>{shortlistDraftSource}</small>
              </div>
              <select
                aria-label="Car condition"
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
            <label>Dealer quote (INR, optional)
              <input type="number" min="1" value={dealerQuote || ""} onChange={event => setDealerQuote(Number(event.target.value))} placeholder="Enter the price quoted to you" />
            </label>
            <button className="primary-action" type="submit">
              Add to compare
            </button>
          </form>

          <div className="compare-side">
            <article className="comparison-card one-to-one-card" aria-label="One to one comparison">
              <span className="confidence high">Side by side</span>
              <h3>{comparisonSections.length
                ? `${shortlistComparisons[0].item.brand} ${shortlistComparisons[0].item.model} vs ${shortlistComparisons[1].item.brand} ${shortlistComparisons[1].item.model}`
                : `Add ${2 - shortlistComparisons.length} more ${shortlistComparisons.length ? "car" : "cars"} to compare`}</h3>
              {comparisonSections.length ? (
                <div className="comparison-sources">
                  <p className="form-note">Manufacturer-verified specs are shown where available. "Not verified" does not mean "No". Catalog body type, seats and example prices still need a dealer check.</p>
                  {shortlistComparisons.slice(0, 2).map((comparison) => {
                    const verified = verifiedComparisonFor(comparison.item.brand, comparison.item.model, comparison.item.variant);
                    const legacy = legacyVariantSourceFor(comparison.item.brand, comparison.item.model, comparison.item.variant);
                    return <p key={comparison.item.id} className="form-note">
                      <strong>{comparison.item.brand} {comparison.item.model} {comparison.item.variant}:</strong>{" "}
                      {verified ? <a href={verified.source.url} target="_blank" rel="noopener noreferrer">{verified.source.label} specifications</a>
                        : legacy ? <>Not listed in the current online range. <a href={legacy.url} target="_blank" rel="noopener noreferrer">Check {legacy.label}</a></>
                          : "Manufacturer specs pending for this variant"}
                    </p>;
                  })}
                </div>
              ) : null}
              <div className="comparison-sections" role="region" aria-label="Comparison categories">
                {displayedComparisonSections.map((section, index) => (
                  <details className="comparison-section" key={section.title} open={index === 0}>
                    <summary><span className="comparison-section-number">{String(index + 1).padStart(2, "0")}</span>
                      <span>{section.title}</span><ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    {comparisonSections.length && section.rows.length ? (
                      <div className="compare-table" role="table" aria-label={`${section.title} comparison`}>
                        <div role="row">
                          <strong role="columnheader">Metric</strong>
                          <strong role="columnheader">{shortlistComparisons[0].item.model}</strong>
                          <strong role="columnheader">{shortlistComparisons[1].item.model}</strong>
                        </div>
                        {section.rows.map(([metric, first, second]) => (
                          <div role="row" key={metric}>
                            <span role="rowheader">{metric}</span>
                            <span role="cell">{first}</span>
                            <span role="cell">{second}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="form-note comparison-section-note">{comparisonSections.length
                      ? "Details for this category are not available yet."
                      : "Add two cars to see this comparison."}</p>}
                  </details>
                ))}
              </div>
              {compareVerdict ? (
                  <div className="compare-verdict">
                    <div className="verdict-block">
                      <h4>What is the core difference?</h4>
                      <p>{compareVerdict.coreDifference}</p>
                    </div>
                    <div className="verdict-block verdict-pick">
                      <h4>What should you check next?</h4>
                      <p>{compareVerdict.reason}</p>
                    </div>
                  </div>
              ) : null}
            </article>
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

        </>
      ) : null}

      <section className="panel split-panel" id="write" hidden={activeView !== "write"}>
        <div>
          <p className="eyebrow">Owner note</p>
          <h2>What did you learn about your car?</h2>
          <p>Your note will be published to signed-in community members.</p>
          {communityStatus ? <p role="status">{communityStatus}</p> : null}
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
            maxLength={160}
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
            maxLength={10000}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
          />
          <button className="primary-action" disabled={communityBusy || !auth.cloudClient || !isOnline} type="submit">
            Publish owner note
          </button>
        </form>
      </section>

      <section className="panel" id="garage" hidden={activeView !== "garage"}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Garage timeline</p>
            <h2>Your vehicles and maintenance</h2>
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
            {!garage.length ? <p>Add a vehicle first to record its maintenance.</p> : null}
            <select
              aria-label="Vehicle"
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
            <button className="primary-action" type="submit" disabled={!garage.length}>
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

      {showDeferredCommunityModules ? (
        <>
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
        activeView !== "top" && activeView !== "account" ? (
          clerkEnabled ? <LoginGate isLoaded={auth.isLoaded} /> :
          <section className="panel auth-gate"><h2>Sign-in is temporarily unavailable</h2><p>Please try again later.</p></section>
        ) : null
      )}

      <footer className="app-footer">
        <span>Otofolks</span>
      </footer>

      {activeReel ? (
        <div className="reel-modal" role="dialog" aria-modal="true" aria-label={activeReel.title}
          onClick={(event) => { if (event.target === event.currentTarget) setActiveReel(null); }}>
          <div className="reel-modal-card">
            <div className="reel-modal-head">
              <div>
                <span className="pill">{activeReel.category}</span>
                <h3>{activeReel.title}</h3>
              </div>
              <button className="composer-close" type="button" aria-label="Close" onClick={() => setActiveReel(null)}>
                <X size={20} />
              </button>
            </div>
            {isEmbeddableReel(activeReel.embedUrl) ? (
              <div className="reel-frame">
                <iframe
                  src={toEmbedSrc(activeReel.embedUrl)}
                  title={activeReel.title}
                  loading="lazy"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="reel-collection" aria-hidden="true">
                <span className="play-badge"><Play size={24} /></span>
                <strong>{activeReel.thumbnailLabel}</strong>
                <small>{activeReel.category} · curated collection</small>
              </div>
            )}
            <p>{activeReel.summary}</p>
            <a className="secondary-action" href={activeReel.embedUrl} target="_blank" rel="noreferrer">
              {isEmbeddableReel(activeReel.embedUrl) ? "Open on Instagram" : "Watch the collection on Instagram"}
            </a>
          </div>
        </div>
      ) : null}

      <nav className="tab-bar" aria-label="Primary">
        {destinations.map(({ id, label, icon: Icon }) => (
          <a href={`#${id}`} key={id} onClick={handleFeatureNav}
            className={activeView === id ? "is-active" : undefined}
            aria-current={activeView === id ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
        <a href="#account" onClick={handleFeatureNav}
          className={activeView === "account" ? "is-active" : undefined}
          aria-current={activeView === "account" ? "page" : undefined}>
          <UserRound size={22} aria-hidden="true" />
          <span>{auth.isSignedIn ? "Account" : "Sign in"}</span>
        </a>
      </nav>
    </main>
  );
}
