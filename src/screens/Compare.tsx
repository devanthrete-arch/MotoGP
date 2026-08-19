import { ArrowLeftRight, MapPin, Plus, Share2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../appState";
import {
  carCatalog,
  findModel,
  formatINR,
  indianStates,
  onRoadPriceINR,
  type CarModel,
  type CarVariant,
} from "../carData";
import { Badge, Card, DataText, EmptyState, GhostButton, LabelCaps, PrimaryButton } from "../components/ui";
import { knowledgeLabels, shortlistStatuses, type ShortlistItem } from "../domain";
import { formatMoney } from "../insights";
import { modelsForBrand, vehicleBrands } from "../vehicleCatalog";

const inputCls =
  "w-full min-h-[44px] bg-surface-container-lowest text-on-surface text-sm border border-outline-variant rounded px-3 py-2.5 placeholder:text-outline focus:outline-none focus:border-primary transition-colors";
const selectCls = inputCls + " appearance-none";

/* ============================================================
   Compare engine (template: compare_engine_autoflex)
   Pick 2-3 cars from the market catalog, side-by-side matrix.
   ============================================================ */

type CompareSlot = { brand: string; model: string; variant: string };

type Resolved = { model: CarModel; variant: CarVariant } | null;

type SpecRow = {
  label: string;
  best: "min" | "max" | "none";
  value: (r: { model: CarModel; variant: CarVariant }) => number | string | undefined;
  format: (r: { model: CarModel; variant: CarVariant }) => string;
};

const unitLabels = ["UNIT A", "UNIT B", "UNIT C"];

function slotForCatalogIndex(index: number): CompareSlot | null {
  const model = carCatalog[Math.min(index, carCatalog.length - 1)];
  if (!model) return null;
  return { brand: model.brand, model: model.model, variant: model.variants[0]?.name ?? "" };
}

function CompareEngine() {
  const app = useApp();
  const [regState, setRegState] = useState<string>(indianStates[0] ?? "Delhi");
  const [diffOnly, setDiffOnly] = useState(false);
  const [slots, setSlots] = useState<CompareSlot[]>(() =>
    [slotForCatalogIndex(0), slotForCatalogIndex(1)].filter((slot): slot is CompareSlot => slot !== null),
  );

  const brands = useMemo(() => [...new Set(carCatalog.map((entry) => entry.brand))], []);

  const resolved: Resolved[] = useMemo(
    () =>
      slots.map((slot) => {
        const model = findModel(slot.brand, slot.model);
        if (!model) return null;
        const variant = model.variants.find((item) => item.name === slot.variant) ?? model.variants[0];
        return variant ? { model, variant } : null;
      }),
    [slots],
  );

  const rows: SpecRow[][] = useMemo(() => {
    const cost: SpecRow[] = [
      {
        label: "Ex-showroom (Delhi)",
        best: "min",
        value: (r) => r.variant.priceExShowroomINR,
        format: (r) => formatINR(r.variant.priceExShowroomINR),
      },
      {
        label: `On-road · ${regState}`,
        best: "min",
        value: (r) => onRoadPriceINR(r.variant.priceExShowroomINR, regState),
        format: (r) => formatINR(onRoadPriceINR(r.variant.priceExShowroomINR, regState)),
      },
    ];
    const propulsion: SpecRow[] = [
      {
        label: "Displacement",
        best: "max",
        value: (r) => r.variant.engineCC,
        format: (r) => (r.variant.engineCC ? `${r.variant.engineCC} cc` : "—"),
      },
      {
        label: "Max power",
        best: "max",
        value: (r) => r.variant.powerBHP,
        format: (r) => (r.variant.powerBHP ? `${r.variant.powerBHP} bhp` : "—"),
      },
      {
        label: "Peak torque",
        best: "max",
        value: (r) => r.variant.torqueNM,
        format: (r) => (r.variant.torqueNM ? `${r.variant.torqueNM} Nm` : "—"),
      },
      {
        label: "Transmission",
        best: "none",
        value: (r) => r.variant.transmission,
        format: (r) => r.variant.transmission,
      },
      { label: "Fuel", best: "none", value: (r) => r.variant.fuel, format: (r) => r.variant.fuel },
    ];
    const cabin: SpecRow[] = [
      {
        label: "ARAI mileage",
        best: "max",
        value: (r) => r.variant.mileageKMPL,
        format: (r) =>
          r.variant.mileageKMPL ? `${r.variant.mileageKMPL} ${r.variant.fuel === "Electric" ? "km" : "kmpl"}` : "—",
      },
      {
        label: "Seats",
        best: "max",
        value: (r) => r.variant.seats,
        format: (r) => (r.variant.seats ? `${r.variant.seats}` : "—"),
      },
      {
        label: "Safety rating",
        best: "max",
        value: (r) => r.model.safetyRatingStars,
        format: (r) => (r.model.safetyRatingStars ? `${r.model.safetyRatingStars} STAR` : "—"),
      },
    ];
    return [cost, propulsion, cabin];
  }, [regState]);

  const updateSlot = (index: number, patch: Partial<CompareSlot>) => {
    setSlots((current) =>
      current.map((slot, i) => {
        if (i !== index) return slot;
        let next = { ...slot, ...patch };
        if (patch.brand && patch.brand !== slot.brand) {
          const firstModel = carCatalog.find((entry) => entry.brand === patch.brand);
          next = { brand: patch.brand, model: firstModel?.model ?? "", variant: firstModel?.variants[0]?.name ?? "" };
        } else if (patch.model && patch.model !== slot.model) {
          const model = findModel(next.brand, patch.model);
          next = { ...next, variant: model?.variants[0]?.name ?? "" };
        }
        return next;
      }),
    );
  };

  const addSlot = () => {
    const fallback = slotForCatalogIndex(slots.length);
    if (fallback) setSlots((current) => (current.length >= 3 ? current : [...current, fallback]));
  };

  const removeSlot = (index: number) => {
    setSlots((current) => (current.length <= 2 ? current : current.filter((_, i) => i !== index)));
  };

  const bestIndexFor = (row: SpecRow): number => {
    if (row.best === "none") return -1;
    let bestIndex = -1;
    let bestValue: number | null = null;
    resolved.forEach((entry, index) => {
      if (!entry) return;
      const value = row.value(entry);
      if (typeof value !== "number") return;
      if (bestValue === null || (row.best === "min" ? value < bestValue : value > bestValue)) {
        bestValue = value;
        bestIndex = index;
      }
    });
    // Only highlight when there is a real difference to win.
    const numeric = resolved
      .map((entry) => (entry ? row.value(entry) : undefined))
      .filter((value): value is number => typeof value === "number");
    if (numeric.length < 2 || numeric.every((value) => value === numeric[0])) return -1;
    return bestIndex;
  };

  const rowIsUniform = (row: SpecRow): boolean => {
    const values = resolved.map((entry) => (entry ? row.format(entry) : "—"));
    return values.every((value) => value === values[0]);
  };

  const shareComparison = () => {
    const summary = resolved
      .filter((entry): entry is NonNullable<Resolved> => entry !== null)
      .map(
        (entry) =>
          `${entry.model.brand} ${entry.model.model} ${entry.variant.name} — ${formatINR(
            onRoadPriceINR(entry.variant.priceExShowroomINR, regState),
          )} on-road ${regState}`,
      )
      .join("\n");
    app.setActionMessage("Comparison copied for sharing.");
    void navigator.clipboard?.writeText(`Autoflex compare\n${summary}`).catch(() => undefined);
  };

  if (!carCatalog.length) {
    return (
      <Card>
        <EmptyState className="border-0 p-0"><p>Market catalog is loading. Compare data will appear here.</p></EmptyState>
      </Card>
    );
  }

  const groupTitles = ["Cost Matrix", "Propulsion Matrix", "Energy & Cabin"];
  const columns = { gridTemplateColumns: `repeat(${resolved.length}, minmax(0, 1fr))` };

  return (
    <section aria-label="Compare engine" className="mb-8" id="compare-engine">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <LabelCaps className="text-primary block mb-1">Compare engine</LabelCaps>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface uppercase flex items-center gap-2">
            <ArrowLeftRight aria-hidden="true" className="w-5 h-5 text-primary" />
            Matrix Compare
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Pick 2-3 cars for a side-by-side spec readout.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
            <MapPin aria-hidden="true" className="w-4 h-4 text-on-surface-variant shrink-0" />
            <span className="sr-only">Registration state for on-road price</span>
            <select className={selectCls + " w-auto"} value={regState} onChange={(event) => setRegState(event.target.value)}>
              {indianStates.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 min-h-[44px] px-1 cursor-pointer select-none">
            <input
              checked={diffOnly}
              className="w-4 h-4 accent-primary"
              type="checkbox"
              onChange={(event) => setDiffOnly(event.currentTarget.checked)}
            />
            <LabelCaps className="text-on-surface-variant">Diff only</LabelCaps>
          </label>
        </div>
      </div>

      {/* Unit pickers */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        {slots.map((slot, index) => {
          const model = findModel(slot.brand, slot.model);
          return (
            <Card className="flex flex-col gap-2" key={`slot-${index}`}>
              <div className="flex items-center justify-between">
                <LabelCaps className="text-primary">{unitLabels[index]}</LabelCaps>
                {slots.length > 2 ? (
                  <button
                    aria-label={`Remove ${unitLabels[index]}`}
                    className="w-11 h-11 -m-2.5 flex items-center justify-center text-outline hover:text-error transition-colors"
                    type="button"
                    onClick={() => removeSlot(index)}
                  >
                    <X aria-hidden="true" className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
              <label className="block">
                <span className="sr-only">{unitLabels[index]} brand</span>
                <select className={selectCls} value={slot.brand} onChange={(event) => updateSlot(index, { brand: event.target.value })}>
                  {brands.map((brand) => (
                    <option key={brand}>{brand}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">{unitLabels[index]} model</span>
                <select className={selectCls} value={slot.model} onChange={(event) => updateSlot(index, { model: event.target.value })}>
                  {carCatalog
                    .filter((entry) => entry.brand === slot.brand)
                    .map((entry) => (
                      <option key={entry.model}>{entry.model}</option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">{unitLabels[index]} variant</span>
                <select
                  className={selectCls}
                  value={slot.variant}
                  onChange={(event) => updateSlot(index, { variant: event.target.value })}
                >
                  {(model?.variants ?? []).map((variant) => (
                    <option key={variant.name} value={variant.name}>
                      {variant.name} · {variant.fuel} {variant.transmission}
                    </option>
                  ))}
                </select>
              </label>
            </Card>
          );
        })}
        {slots.length < 3 ? (
          <button
            className="min-h-[120px] border border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center gap-2 text-outline hover:text-on-surface hover:border-outline transition-colors"
            type="button"
            onClick={addSlot}
          >
            <Plus aria-hidden="true" className="w-5 h-5" />
            <LabelCaps>Add unit</LabelCaps>
          </button>
        ) : null}
      </div>

      {/* Sticky unit header strip */}
      <div className="sticky top-[68px] z-20 glass border border-outline-variant rounded-lg px-3 py-3 mb-4 edge-highlight">
        <div className="grid gap-2 divide-x divide-outline-variant/40" style={columns}>
          {resolved.map((entry, index) => (
            <div className="min-w-0 px-2 text-center" key={`head-${index}`}>
              <LabelCaps className="text-primary block mb-1">{unitLabels[index]}</LabelCaps>
              <p className="font-mono text-sm sm:text-base font-medium tracking-[0.05em] uppercase text-on-surface truncate">
                {entry ? `${entry.model.model}` : "—"}
              </p>
              <DataText className="text-on-surface-variant block truncate">
                {entry ? entry.variant.name : ""}
              </DataText>
              <DataText className="text-on-surface block mt-1">
                {entry ? formatINR(onRoadPriceINR(entry.variant.priceExShowroomINR, regState)) : "—"}
              </DataText>
            </div>
          ))}
        </div>
      </div>

      {/* Spec matrix */}
      <div className="flex flex-col gap-6">
        {rows.map((group, groupIndex) => {
          const visible = group.filter((row) => !diffOnly || !rowIsUniform(row));
          if (!visible.length) return null;
          return (
            <div className="flex flex-col gap-2" key={groupTitles[groupIndex]}>
              <div className="flex items-center gap-2 mb-1">
                <LabelCaps className="text-on-surface-variant">{groupTitles[groupIndex]}</LabelCaps>
                <div aria-hidden="true" className="flex-1 h-px bg-gradient-to-r from-outline-variant/60 to-transparent" />
              </div>
              {visible.map((row) => {
                const winner = bestIndexFor(row);
                return (
                  <div className="bg-surface-container/60 border border-outline-variant/60 rounded-lg p-3" key={row.label}>
                    <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-on-surface-variant text-center mb-2">
                      {row.label}
                    </p>
                    <div className="grid gap-2 divide-x divide-outline-variant/40" style={columns}>
                      {resolved.map((entry, index) => (
                        <div
                          className={
                            "px-1 text-center font-mono text-xs sm:text-sm tracking-[0.05em] break-words " +
                            (index === winner ? "text-primary font-bold glow-text" : "text-on-surface")
                          }
                          key={`${row.label}-${index}`}
                        >
                          {entry ? row.format(entry) : "—"}
                          {index === winner ? <span className="sr-only"> (best in row)</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <GhostButton className="min-h-[44px]" onClick={shareComparison}>
          <Share2 aria-hidden="true" className="w-4 h-4" />
          Share comparison
        </GhostButton>
      </div>
    </section>
  );
}

/* ============================================================
   Shortlist notebook (existing app logic, restyled)
   ============================================================ */

const priorityTone = (priority: string) => (priority === "High" ? "error" : priority === "Medium" ? "tertiary" : "default") as
  | "error"
  | "tertiary"
  | "default";

/** Shortlist / compare engine screen (template: compare_engine_autoflex). */
export function Compare() {
  const app = useApp();
  const {
    shortlist,
    shortlistDraft,
    shortlistFormOpen,
    shortlistComparisons,
    shortlistDecisionLanes,
    inspectionChecklistByItemId,
    notebooks,
    followedModelSet,
    followedTopicSet,
  } = app;

  return (
    <div className="pb-24 lg:pb-8">
      <CompareEngine />

      <section aria-label="Shortlist" id="shortlist">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <LabelCaps className="text-primary block mb-1">Cars saved</LabelCaps>
            <h2
              className="font-display text-2xl font-semibold tracking-tight text-on-surface uppercase"
              ref={app.shortlistHeadingRef}
              tabIndex={-1}
            >
              Compare cars
            </h2>
          </div>
        </div>

        <div aria-label="What to check next" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {shortlistDecisionLanes.length ? (
            shortlistDecisionLanes.map((lane) => (
              <Card className="flex flex-col gap-2" key={lane.item.id}>
                <div className="flex items-center justify-between gap-2">
                  <LabelCaps className="text-on-surface-variant">Next check</LabelCaps>
                  <Badge aria-label={`${lane.priority} priority`} title={`${lane.priority} priority`} tone={priorityTone(lane.priority)}>
                    {lane.priority}
                  </Badge>
                </div>
                <h3 className="font-mono text-base font-medium tracking-[0.05em] uppercase text-on-surface">
                  {lane.item.brand} {lane.item.model}
                </h3>
                <p className="text-sm text-on-surface-variant">{lane.signal}</p>
                <p className="text-sm font-semibold text-on-surface">{lane.nextAction}</p>
              </Card>
            ))
          ) : (
            <EmptyState className="sm:col-span-2 lg:col-span-3" title="Nothing to compare yet">
              <p>Add the cars you are considering to line up price, what owners actually report, and what to inspect before you pay.</p>
              <PrimaryButton onClick={app.openShortlistComposer}>
                <Plus aria-hidden="true" className="w-4 h-4" />
                Add a car
              </PrimaryButton>
            </EmptyState>
          )}
        </div>

        {shortlistFormOpen ? (
          <Card className="mb-6" id="shortlist-form">
            <form className="flex flex-col gap-3" onSubmit={app.addShortlistItem}>
              <h3 className="font-display text-lg font-semibold text-on-surface uppercase">Add model to compare</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  aria-label="Car brand"
                  className={selectCls}
                  value={shortlistDraft.brand}
                  onChange={(event) => app.setShortlistDraft({ ...shortlistDraft, brand: event.target.value, model: "" })}
                >
                  {vehicleBrands.map((brand) => (
                    <option key={brand}>{brand}</option>
                  ))}
                </select>
                <input
                  aria-label="Car model"
                  className={inputCls}
                  list="shortlist-model-suggestions"
                  placeholder="Model"
                  ref={app.shortlistModelRef}
                  required
                  value={shortlistDraft.model}
                  onChange={(event) => app.setShortlistDraft({ ...shortlistDraft, model: event.target.value })}
                />
                <datalist id="shortlist-model-suggestions">
                  {modelsForBrand(shortlistDraft.brand).map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  aria-label="Target budget"
                  className={inputCls}
                  min="0"
                  placeholder="Budget"
                  type="number"
                  value={shortlistDraft.budget || ""}
                  onChange={(event) => app.setShortlistDraft({ ...shortlistDraft, budget: Number(event.target.value) })}
                />
                <select
                  aria-label="Shortlist status"
                  className={selectCls}
                  value={shortlistDraft.status}
                  onChange={(event) => app.setShortlistDraft({ ...shortlistDraft, status: event.target.value as ShortlistItem["status"] })}
                >
                  {shortlistStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <textarea
                aria-label="Decision notes"
                className={inputCls}
                placeholder="Why is it on the list? Dealer quote, family need, must-check concern..."
                rows={4}
                value={shortlistDraft.notes}
                onChange={(event) => app.setShortlistDraft({ ...shortlistDraft, notes: event.target.value })}
              />
              <PrimaryButton className="self-start" type="submit">
                Add to shortlist
              </PrimaryButton>
            </form>
          </Card>
        ) : null}

        {shortlist.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {shortlistComparisons.length ? (
              shortlistComparisons.map((comparison) => {
                const inspection = inspectionChecklistByItemId.get(comparison.item.id);
                return (
                  <Card className="flex flex-col gap-3" key={comparison.item.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Badge tone={comparison.confidence === "High" ? "primary" : comparison.confidence === "Medium" ? "tertiary" : "default"}>
                          {comparison.confidence} confidence
                        </Badge>
                        <h3 className="font-mono text-lg font-medium tracking-[0.05em] uppercase text-on-surface mt-2 truncate">
                          {comparison.item.brand} {comparison.item.model}
                        </h3>
                        <DataText className="text-on-surface-variant">{formatMoney(comparison.item.budget)} target budget</DataText>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: "Notes", value: comparison.relatedNotes },
                        { label: "Reviews", value: comparison.ownerReviews },
                        { label: "Issues", value: comparison.knownIssues },
                        { label: "Fixes", value: comparison.fixes },
                      ].map((stat) => (
                        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded p-2 text-center" key={stat.label}>
                          <DataText className="text-on-surface block">{stat.value}</DataText>
                          <LabelCaps className="text-on-surface-variant">{stat.label}</LabelCaps>
                        </div>
                      ))}
                    </div>

                    {inspection ? (
                      <div className="border border-outline-variant/60 rounded-lg p-3 flex flex-col gap-2">
                        <LabelCaps className="text-on-surface-variant">Inspection checklist</LabelCaps>
                        {inspection.checklist.map((item) => (
                          <div className="flex items-start gap-2" key={item.id}>
                            <Badge className="mt-0.5 shrink-0" tone={priorityTone(item.priority)}>
                              {item.priority}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                              <p className="text-sm text-on-surface-variant">{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        aria-label={`Status for ${comparison.item.brand} ${comparison.item.model}`}
                        className={selectCls}
                        value={comparison.item.status}
                        onChange={(event) =>
                          app.updateShortlistItem(comparison.item.id, { status: event.target.value as ShortlistItem["status"] })
                        }
                      >
                        {shortlistStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <GhostButton className="min-h-[44px]" onClick={() => app.removeShortlistItem(comparison.item.id)}>
                        Remove car
                      </GhostButton>
                    </div>
                    <textarea
                      aria-label={`Decision notes for ${comparison.item.brand} ${comparison.item.model}`}
                      className={inputCls}
                      placeholder="Decision notes"
                      rows={3}
                      value={comparison.item.notes}
                      onChange={(event) => app.updateShortlistItem(comparison.item.id, { notes: event.target.value })}
                    />
                  </Card>
                );
              })
            ) : (
              <EmptyState className="lg:col-span-2" title="No cars on the shortlist">
                <p>Save a model here to track its price, owner reports, and inspection checklist as you decide.</p>
              </EmptyState>
            )}
          </div>
        ) : null}
      </section>

      {shortlist.length ? (
        <section aria-label="Owner notes by car" className="mt-8" id="notebooks">
          <div className="mb-4">
            <LabelCaps className="text-primary block mb-1">Owner notes by car</LabelCaps>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface uppercase">
              Notes for cars you are comparing
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((notebook) => {
              const isFollowing = followedModelSet.has(notebook.key);
              return (
                <Card className="flex flex-col gap-2" key={notebook.key}>
                  <Badge className="self-start">{notebook.brand}</Badge>
                  <h3 className="font-mono text-lg font-medium tracking-[0.05em] uppercase text-on-surface">{notebook.model}</h3>
                  <DataText className="text-on-surface-variant">{notebook.posts.length} owner notes</DataText>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <GhostButton
                      className={"min-h-[44px] " + (isFollowing ? "border-primary text-primary" : "")}
                      onClick={() => app.toggleFollowModel(notebook.brand, notebook.model)}
                    >
                      {isFollowing ? "Following" : "Follow model"}
                    </GhostButton>
                    <GhostButton className="min-h-[44px]" onClick={() => app.shareModelNotebook(notebook.brand, notebook.model)}>
                      Share notes
                    </GhostButton>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {knowledgeLabels
                      .filter((label) => notebook.posts.some((post) => post.label === label))
                      .map((label) => (
                        <button
                          className={
                            "font-mono text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-2 rounded border transition-colors " +
                            (followedTopicSet.has(label)
                              ? "border-primary text-primary bg-primary/10"
                              : "border-outline-variant text-on-surface-variant hover:text-on-surface")
                          }
                          key={label}
                          type="button"
                          onClick={() => app.toggleFollowTopic(label)}
                        >
                          {followedTopicSet.has(label) ? `Following ${label}` : label}
                        </button>
                      ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
