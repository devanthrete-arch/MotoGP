// Shared data, types and pure helpers for the app shell and its views.
import { isSharedPost } from "../communityCloud";
import { comparisonFields, verifiedComparisonFor } from "../comparisonCatalog";
import type { ClerkTokenGetter, CloudClient } from "../supabase";
import { Car, House, MessageCircle, Play, Scale } from "lucide-react";
import type { ComponentType } from "react";
import { matchRoutes } from "react-router";
import { pitStopCategories, type PitStopClip } from "../pitstop";
import {
  seedPosts, type DraftPost, type DraftShortlistItem, type DraftTimelineEntry, type DraftVehicle,
  type ShortlistItem,
} from "../domain";
import { formatMoney, type ShortlistComparison } from "../insights";

export type FeedMode = "latest" | "helpful" | "saved" | "following";

export const seedPostIds = new Set(seedPosts.map(post => post.id));

export const postSource = (id: string) => isSharedPost(id) ? "Shared" : seedPostIds.has(id) ? "Example" : "On this device";

export type AppView = "top" | "feed" | "pit-stop" | "compare" | "account" | "garage" | "write" | "owner-onboarding";

// Where each view lives. Links, redirects and the route table all read this one map.
export const viewPaths: Record<AppView, string> = {
  top: "/",
  garage: "/garage",
  feed: "/community",
  write: "/community/write",
  "pit-stop": "/pit-stop",
  compare: "/compare",
  account: "/account",
  "owner-onboarding": "/owner/onboarding",
};

// Views that need an account. Every other view is open to visitors. The route guard, the
// ahead-of-time fetching and the landing page's "needs sign-in" tags all read this one set.
export type MemberView = "garage" | "feed" | "write";
export const memberViews: ReadonlySet<AppView> = new Set<MemberView>(["garage", "feed", "write"]);

// Browser tab and history titles.
export const viewTitles: Record<AppView, string> = {
  top: "Otofolks",
  garage: "My garage · Otofolks",
  feed: "Community · Otofolks",
  write: "Write an owner note · Otofolks",
  "pit-stop": "Pit Stop · Otofolks",
  compare: "Compare · Otofolks",
  account: "Account · Otofolks",
  "owner-onboarding": "Add your vehicle · Otofolks",
};

// Asks the router's own matcher, so the navigation cannot mark one view while another is shown:
// letter case, a trailing slash and percent-encoding are all treated as the route table treats them.
const viewRoutes = (Object.keys(viewPaths) as AppView[]).map((view) => ({ id: view, path: viewPaths[view] }));
export const viewFromPath = (pathname: string): AppView =>
  (matchRoutes(viewRoutes, { pathname })?.[0]?.route.id as AppView | undefined) ?? "top";

// Views used to be URL fragments (/#feed, /#pit-stop-builds). Bookmarks, shared links and
// installed-app shortcuts in that form are sent to the matching path; null means "not one of ours".
export const pathForLegacyHash = (hash: string): { pathname: string; hash: string } | null => {
  const name = hash.replace(/^#/, "");
  // A Pit Stop collection keeps its fragment, which is what selects the collection.
  if (name.startsWith("pit-stop-")) return { pathname: viewPaths["pit-stop"], hash: `#${name}` };
  if (name === "top" || !Object.hasOwn(viewPaths, name)) return null;
  return { pathname: viewPaths[name as AppView], hash: "" };
};

export const destinations = [
  { id: "top", label: "Home", icon: House },
  { id: "garage", label: "My garage", icon: Car },
  { id: "feed", label: "Community", icon: MessageCircle },
  { id: "pit-stop", label: "Pit Stop", icon: Play },
  { id: "compare", label: "Compare", icon: Scale },
] as const;

export const adminModeratorEmails = [
  "piyushdtu23@gmail.com",
  "priyansht1999@gmail.com",
  "shauryashivam38@gmail.com",
  "hemangdtu@gmail.com",
] as const;

export const isAdminModeratorEmail = (email: string): boolean =>
  adminModeratorEmails.includes(email.toLowerCase() as (typeof adminModeratorEmails)[number]);

// A Pit Stop collection is addressed by a fragment on the Pit Stop page: /pit-stop#pit-stop-builds.
export const pitStopCollectionId = (category: PitStopClip["category"]) => `pit-stop-${category.toLowerCase()}`;

export const pitStopCategoryFromHash = (hash: string): PitStopClip["category"] | null => {
  const name = hash.replace("#pit-stop-", "").toLowerCase();
  return pitStopCategories.find((category): category is PitStopClip["category"] => category !== "All" && category.toLowerCase() === name) ?? null;
};

export const priceStates = [
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

export type PriceState = (typeof priceStates)[number];

export const defaultPriceState: PriceState = "Maharashtra";

export const cityStateMap: Record<string, PriceState> = {
  Bengaluru: "Karnataka",
  Chandigarh: "Chandigarh",
  "Delhi NCR": "Delhi",
  Pune: "Maharashtra",
};

export const modelPriceOptions = [
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

export const brands = [...new Set(modelPriceOptions.map((option) => option.brand))];

export const modelsForBrand = (brand: string) => modelPriceOptions.filter((option) => option.brand === brand);

export const optionForModel = (brand: string, model: string) =>
  modelPriceOptions.find((option) => option.brand === brand && option.model === model);

export const variantsForModel = (brand: string, model: string) => optionForModel(brand, model)?.variants ?? [];

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

export const firstModelForBrand = (brand: string) => modelsForBrand(brand)[0]?.model ?? "";

export const firstVariantForModel = (brand: string, model: string) => variantsForModel(brand, model)[0]?.name ?? "";

export const modelDetailsFor = (brand: string, model: string) => optionForModel(brand, model);

export const stateForCity = (city: string): PriceState | "" => cityStateMap[city.trim()] ?? "";

export const priceSourceFor = (state: string, _status: ShortlistItem["status"]) =>
  `Example price only; confirm a dealer quote in ${state || defaultPriceState}`;

export type AppProps = {
  /** Sign-in is configured. Without it every visitor stays signed out. */
  clerkEnabled?: boolean;
  /** The sign-in provider's own account panel, shown in Account. Passed in so the app can run without the provider. */
  accountPanel?: ComponentType<{ savedCount: number }>;
};

export type SignInMode = "sign-in" | "sign-up";

export type AppAuthState = {
  userId?: string;
  cloudClient?: CloudClient | null;
  cloudToken?: ClerkTokenGetter | null;
  cloudError?: string;
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Opens sign-in (or sign-up); `destination` is the path to come back to afterwards. */
  requireSignIn: (destination?: string, mode?: SignInMode) => void;
};

export type ComparisonSection = { title: string; rows: [string, string, string][] };

export const comparisonSectionTitles = comparisonFields.map((section) => section.title);

export const compareMetricSections = (comparisons: ShortlistComparison[]): ComparisonSection[] => {
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
export const buildCompareVerdict = (comparisons: ShortlistComparison[]) => {
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
export const isEmbeddableReel = (url: string) => {
  try {
    const u = new URL(url);
    return u.hostname.includes("instagram.com") && /\/(reel|p|tv)\//.test(u.pathname);
  } catch {
    return false;
  }
};

export const toEmbedSrc = (url: string) => {
  if (!isEmbeddableReel(url)) return url;
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/$/, "")}/embed`;
};

export const initialDraft: DraftPost = {
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

export const initialVehicleDraft: DraftVehicle = {
  nickname: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  purchaseMonth: "",
  kind: "car",
  source: "manual",
};

export const catalogueVehicleId = (brand: string, model: string) =>
  `car:${brand}:${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const initialTimelineDraft: DraftTimelineEntry = {
  vehicleId: "",
  kind: "Service",
  title: "",
  amount: 0,
  odometerKm: 0,
  happenedOn: new Date().toISOString().slice(0, 10),
  note: "",
};

export const initialShortlistDraft: DraftShortlistItem = {
  brand: "Tata",
  budget: priceForModel("Tata", "Nexon", "Smart Petrol MT", defaultPriceState, "New"),
  model: "Nexon",
  notes: "",
  priceSource: priceSourceFor(defaultPriceState, "New"),
  state: defaultPriceState,
  status: "New",
  variant: "Smart Petrol MT",
};

export const getInitialOnlineStatus = (): boolean => {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  } catch {
    return true;
  }
};
