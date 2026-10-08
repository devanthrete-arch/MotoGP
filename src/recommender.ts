export type FuelType = "Petrol" | "Diesel" | "CNG" | "Electric";
export type LocalityTier = "metro" | "urban" | "semi-urban" | "rural";

export type SourcedFact<T> = {
  value: T;
  source: { label: string; url: string; checkedOn: string };
};

export type RecommenderCandidate = {
  id: string;
  brand: string;
  model: string;
  variant: string;
  fuel: FuelType;
  source?: SourcedFact<unknown>;
  prices?: Partial<Record<string, SourcedFact<number>>>;
  consumption?: SourcedFact<number>;
  consumptionUnit?: "km-per-litre" | "km-per-kg" | "kwh-per-100km";
  serviceSchedule?: SourcedFact<{ intervalKm: number; visitCostRupees: number }[]>;
  serviceCoverage?: SourcedFact<Partial<Record<LocalityTier, number>>>;
  firstCarFit?: SourcedFact<number>;
  safetyRatingOutOfFive?: SourcedFact<number>;
};

export type RecommenderPreferences = {
  state: string;
  localityTier: LocalityTier;
  budgetRupees: number;
  monthlyKm: number;
  monthlyServiceBudgetRupees?: number;
  fuel: FuelType | "Any";
  firstCar: boolean;
  fuelPricePerLitre?: number;
  fuelPricePerKg?: number;
  electricityPricePerKwh?: number;
};

export type RankedCandidate = {
  candidate: RecommenderCandidate;
  score: number;
  monthlyEnergyRupees: number;
  monthlyServiceRupees: number;
  reasons: string[];
};

export type RankingResult = {
  recommendations: RankedCandidate[];
  notEnoughVerifiedData: string[];
  excluded: Record<"fuel" | "budget" | "locality", string[]>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SOURCE_AGE_DAYS = 365;

function validSource(source: SourcedFact<unknown>["source"] | undefined, today: string): boolean {
  if (!source || !source.label.trim()) return false;
  try {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return false;
  } catch {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedOn)) return false;
  const checked = Date.parse(`${source.checkedOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(checked) || !Number.isFinite(now)
    || new Date(checked).toISOString().slice(0, 10) !== source.checkedOn) return false;
  return checked <= now && now - checked <= MAX_SOURCE_AGE_DAYS * DAY_MS;
}

function usable<T>(fact: SourcedFact<T> | undefined, today: string): fact is SourcedFact<T> {
  return Boolean(fact && validSource(fact.source, today));
}

function energyPrice(preferences: RecommenderPreferences, fuel: FuelType): number | undefined {
  if (fuel === "Electric") return preferences.electricityPricePerKwh;
  if (fuel === "CNG") return preferences.fuelPricePerKg;
  return preferences.fuelPricePerLitre;
}

function energyUse(candidate: RecommenderCandidate, preferences: RecommenderPreferences, price: number): number {
  const consumption = candidate.consumption!.value;
  const units = candidate.consumptionUnit === "kwh-per-100km"
    ? preferences.monthlyKm * consumption / 100
    : preferences.monthlyKm / consumption;
  return units * price;
}

function missingVerifiedFacts(candidate: RecommenderCandidate, preferences: RecommenderPreferences, today: string): boolean {
  const price = candidate.prices?.[preferences.state];
  const consumptionSource = candidate.consumption;
  const service = candidate.serviceSchedule;
  const coverage = candidate.serviceCoverage;
  const firstCarFit = candidate.firstCarFit;
  const safety = candidate.safetyRatingOutOfFive;
  const rate = energyPrice(preferences, candidate.fuel);
  return ![
    candidate.source,
    price,
    consumptionSource,
    service,
    coverage,
    firstCarFit,
    safety,
  ].every(fact => usable(fact, today))
    || !candidate.brand.trim() || !candidate.model.trim() || !candidate.variant.trim()
    || !Number.isFinite(price?.value) || price!.value <= 0
    || !Number.isFinite(consumptionSource?.value) || consumptionSource!.value <= 0
    || !candidate.consumptionUnit
    || !service!.value.length
    || service!.value.some(item => !Number.isFinite(item.intervalKm) || item.intervalKm <= 0
      || !Number.isFinite(item.visitCostRupees) || item.visitCostRupees < 0)
    || !Number.isFinite(coverage!.value[preferences.localityTier])
    || coverage!.value[preferences.localityTier]! < 0 || coverage!.value[preferences.localityTier]! > 1
    || !Number.isFinite(firstCarFit!.value) || firstCarFit!.value < 0 || firstCarFit!.value > 1
    || !Number.isFinite(safety!.value) || safety!.value < 0 || safety!.value > 5
    || !Number.isFinite(rate) || rate! <= 0
    || (candidate.fuel === "Electric" && candidate.consumptionUnit !== "kwh-per-100km")
    || (candidate.fuel === "CNG" && candidate.consumptionUnit !== "km-per-kg")
    || ((candidate.fuel === "Petrol" || candidate.fuel === "Diesel") && candidate.consumptionUnit !== "km-per-litre");
}

export function rankCars(
  candidates: readonly RecommenderCandidate[],
  preferences: RecommenderPreferences,
  today = new Date().toISOString().slice(0, 10),
): RankingResult {
  const result: RankingResult = { recommendations: [], notEnoughVerifiedData: [], excluded: { fuel: [], budget: [], locality: [] } };
  if (!preferences.state.trim() || !Number.isFinite(preferences.budgetRupees) || preferences.budgetRupees <= 0
    || !Number.isFinite(preferences.monthlyKm) || preferences.monthlyKm <= 0
    || (preferences.monthlyServiceBudgetRupees !== undefined
      && (!Number.isFinite(preferences.monthlyServiceBudgetRupees) || preferences.monthlyServiceBudgetRupees <= 0))) return result;

  for (const candidate of candidates) {
    if (missingVerifiedFacts(candidate, preferences, today)) {
      result.notEnoughVerifiedData.push(candidate.id);
      continue;
    }
    if (preferences.fuel !== "Any" && candidate.fuel !== preferences.fuel) {
      result.excluded.fuel.push(candidate.id);
      continue;
    }
    const price = candidate.prices![preferences.state]!.value;
    if (price > preferences.budgetRupees) {
      result.excluded.budget.push(candidate.id);
      continue;
    }
    const coverage = candidate.serviceCoverage!.value[preferences.localityTier];
    if (coverage === undefined || coverage <= 0) {
      result.excluded.locality.push(candidate.id);
      continue;
    }

    const monthlyEnergyRupees = energyUse(candidate, preferences, energyPrice(preferences, candidate.fuel)!);
    const annualKm = preferences.monthlyKm * 12;
    const annualServiceRupees = candidate.serviceSchedule!.value.reduce((total, visit) =>
      total + Math.floor(annualKm / visit.intervalKm) * visit.visitCostRupees, 0);
    const monthlyServiceRupees = annualServiceRupees / 12;
    const serviceCostFit = preferences.monthlyServiceBudgetRupees === undefined
      ? 1 / (1 + monthlyServiceRupees / 2_000)
      : Math.min(1, preferences.monthlyServiceBudgetRupees / Math.max(1, monthlyServiceRupees));
    const firstCarFit = candidate.firstCarFit!.value;
    const safety = candidate.safetyRatingOutOfFive!.value / 5;
    const score = Math.round(100 * (
      0.25 * ((preferences.budgetRupees - price) / preferences.budgetRupees)
      + 0.25 / (1 + monthlyEnergyRupees / 10_000)
      + 0.2 * serviceCostFit
      + 0.1 * coverage
      + 0.1 * (preferences.firstCar ? firstCarFit : 0.5)
      + 0.1 * safety
    ));
    const reasons = [
      `Within your budget by ₹${Math.round(preferences.budgetRupees - price).toLocaleString("en-IN")}`,
      `About ₹${Math.round(monthlyEnergyRupees).toLocaleString("en-IN")}/month for energy at your rate`,
      `About ₹${Math.round(monthlyServiceRupees).toLocaleString("en-IN")}/month for scheduled service`,
      ...(preferences.monthlyServiceBudgetRupees === undefined ? [] : [
        monthlyServiceRupees <= preferences.monthlyServiceBudgetRupees
          ? `Scheduled service fits your ₹${preferences.monthlyServiceBudgetRupees.toLocaleString("en-IN")}/month comfort range`
          : `Scheduled service is above your ₹${preferences.monthlyServiceBudgetRupees.toLocaleString("en-IN")}/month comfort range`,
      ]),
      `Service support is recorded for your ${preferences.localityTier} area`,
      ...(preferences.firstCar ? [`${Math.round(firstCarFit * 100)}% first-car fit`] : []),
      `${candidate.safetyRatingOutOfFive!.value}/5 safety rating from its cited source`,
    ];
    result.recommendations.push({ candidate, score, monthlyEnergyRupees, monthlyServiceRupees, reasons });
  }
  result.recommendations.sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
  result.notEnoughVerifiedData.sort();
  for (const list of Object.values(result.excluded)) list.sort();
  return result;
}
