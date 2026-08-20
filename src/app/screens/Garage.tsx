import { Download, Heart, Plus, Wrench, X } from "lucide-react";
import { useApp } from "../state/appState";
import { formatINR } from "../../core/catalog/carData";
import {
  Badge,
  Card,
  DataText,
  EdgeGlow,
  EmptyState,
  GhostButton,
  LabelCaps,
  PrimaryButton,
  SectionHeader,
  StatusChip,
} from "../../ui/primitives";
import { VehicleFactGrid } from "../../ui/VehicleFactGrid";
import {
  timelineKinds,
  vehicleFuels,
  vehicleOwnerships,
  vehicleTransmissions,
  type GarageVehicle,
  type TimelineEntryKind,
  type VehicleFuel,
  type VehicleOwnership,
  type VehicleTransmission,
} from "../../core/entities";
import { formatMoney } from "../../insights";
import { modelsForBrand, vehicleBrands } from "../../core/catalog/vehicleCatalog";
import { vehicleFactRows, vehicleTitle } from "../../core/catalog/vehicleFacts";

/** My-cars screen (template: my_garage_autoflex). */

const yearFor = (vehicle: GarageVehicle): string => (vehicle.purchaseMonth ? vehicle.purchaseMonth.slice(0, 4) : "----");

export function Garage() {
  const app = useApp();
  const {
    garage,
    timeline,
    shortlist,
    currentVehicle,
    currentReminder,
    currentLedger,
    garageForm,
    vehicleDraft,
    timelineDraft,
    garageReminders,
    garageCostLedger,
  } = app;

  const soonReminders = garageReminders.filter((reminder) => reminder.urgency === "Soon");

  return (
    <section className="screen-garage flex flex-col gap-6 pb-24 lg:pb-8" id="garage">
      {/* ---- Garage status strip ---- */}
      <Card className="bg-surface-container-low/80 glass">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <LabelCaps className="text-primary block mb-1">My cars</LabelCaps>
            <h2 className="font-display text-2xl font-semibold tracking-tight uppercase text-on-surface" ref={app.garageHeadingRef} tabIndex={-1}>
              Garage status
            </h2>
          </div>
          <DataText size="lg" className="text-primary glow-text">{String(garage.length).padStart(2, "0")}</DataText>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {soonReminders.length ? (
            <StatusChip error>{soonReminders.length} due soon</StatusChip>
          ) : (
            <StatusChip>All clear</StatusChip>
          )}
          <StatusChip on={timeline.length > 0}>{timeline.length} records</StatusChip>
          {currentVehicle ? <StatusChip>{`Unit: ${(currentVehicle.nickname || currentVehicle.model).toUpperCase()}`}</StatusChip> : null}
        </div>
        {currentVehicle ? (
          <div aria-label="Selected vehicle record" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className="flex flex-col gap-1.5 p-3 rounded bg-surface-container-lowest/60 border border-outline-variant/40">
              <LabelCaps className="text-on-surface-variant">Car</LabelCaps>
              <DataText className="text-on-surface truncate">
                {(currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`).toUpperCase()}
              </DataText>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded bg-surface-container-lowest/60 border border-outline-variant/40">
              <LabelCaps className="text-on-surface-variant">Odometer</LabelCaps>
              <DataText className="text-on-surface">{currentVehicle.odometerKm.toLocaleString("en-IN")} KM</DataText>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded bg-surface-container-lowest/60 border border-outline-variant/40">
              <LabelCaps className="text-on-surface-variant">Total spent</LabelCaps>
              <DataText className="text-on-surface">{currentLedger && currentLedger.totalSpend ? formatMoney(currentLedger.totalSpend) : "—"}</DataText>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded bg-surface-container-lowest/60 border border-outline-variant/40">
              <LabelCaps className="text-on-surface-variant">Service due</LabelCaps>
              <DataText className="text-on-surface truncate">{(currentReminder?.title ?? "Nothing due").toUpperCase()}</DataText>
            </div>
          </div>
        ) : null}
        {currentVehicle ? (
          <div className="mt-5">
            <LabelCaps className="text-on-surface-variant block mb-2">{vehicleTitle(currentVehicle)}</LabelCaps>
            <VehicleFactGrid vehicle={currentVehicle} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <GhostButton className="min-h-[44px]" onClick={app.exportGarage}>
            <Download aria-hidden="true" className="w-4 h-4" />
            Export garage
          </GhostButton>
          <PrimaryButton className="min-h-[44px]" onClick={app.openVehicleComposer}>
            <Plus aria-hidden="true" className="w-4 h-4" />
            Add car
          </PrimaryButton>
        </div>
      </Card>

      {!currentVehicle ? (
        <EmptyState title="Your garage is empty">
          <p>Track service, costs, and ownership notes for every car you own — in one place, on this device.</p>
          <PrimaryButton className="min-h-[44px]" onClick={app.openVehicleComposer}>
            <Plus aria-hidden="true" className="w-4 h-4" />
            Add my car
          </PrimaryButton>
        </EmptyState>
      ) : null}

      {/* ---- Composers ---- */}
      {garageForm ? (
        <div className="grid gap-4">
          {garageForm === "vehicle" ? (
            <Card>
              <form className="flex flex-col gap-3" id="vehicle-form" onSubmit={app.addVehicle}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <LabelCaps className="text-primary block mb-1">Registration</LabelCaps>
                    <h3 className="font-display text-lg font-semibold uppercase text-on-surface">Add vehicle</h3>
                  </div>
                  <GhostButton aria-label="Close vehicle form" className="min-h-[44px]" onClick={() => app.setGarageForm(null)}>
                    <X aria-hidden="true" className="w-4 h-4" />
                  </GhostButton>
                </div>
                <input
                  aria-label="Vehicle nickname"
                  ref={app.vehicleNicknameRef}
                  value={vehicleDraft.nickname}
                  onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
                  placeholder="Nickname"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <select aria-label="Vehicle brand" value={vehicleDraft.brand} onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, brand: event.target.value, model: "" })}>
                    {vehicleBrands.map((brand) => (
                      <option key={brand}>{brand}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Vehicle model"
                    list="vehicle-model-suggestions"
                    required
                    value={vehicleDraft.model}
                    onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
                    placeholder="Model"
                  />
                  <datalist id="vehicle-model-suggestions">
                    {modelsForBrand(vehicleDraft.brand).map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    aria-label="Variant (trim only)"
                    value={vehicleDraft.variant}
                    onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, variant: event.target.value })}
                    placeholder="e.g. XZ+"
                  />
                  <input
                    aria-label="City"
                    value={vehicleDraft.city}
                    onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, city: event.target.value })}
                    placeholder="City"
                  />
                </div>
                {/* Fuel, gearbox and ownership are their own fields so nobody has
                    to type them into the variant box — and "Not set" stays the
                    default rather than the app assuming a petrol manual. */}
                <div className="grid sm:grid-cols-3 gap-3">
                  <select
                    aria-label="Fuel"
                    className="min-h-[44px]"
                    value={vehicleDraft.fuel ?? ""}
                    onChange={(event) =>
                      app.setVehicleDraft({ ...vehicleDraft, fuel: event.target.value as VehicleFuel | "" })
                    }
                  >
                    <option value="">Fuel — not set</option>
                    {vehicleFuels.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Transmission"
                    className="min-h-[44px]"
                    value={vehicleDraft.transmission ?? ""}
                    onChange={(event) =>
                      app.setVehicleDraft({ ...vehicleDraft, transmission: event.target.value as VehicleTransmission | "" })
                    }
                  >
                    <option value="">Transmission — not set</option>
                    {vehicleTransmissions.map((transmission) => (
                      <option key={transmission} value={transmission}>
                        {transmission}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ownership"
                    className="min-h-[44px]"
                    value={vehicleDraft.ownership ?? ""}
                    onChange={(event) =>
                      app.setVehicleDraft({ ...vehicleDraft, ownership: event.target.value as VehicleOwnership | "" })
                    }
                  >
                    <option value="">Ownership — not set</option>
                    {vehicleOwnerships.map((ownership) => (
                      <option key={ownership} value={ownership}>
                        {ownership}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    min="0"
                    type="number"
                    aria-label="Current odometer"
                    value={vehicleDraft.odometerKm || ""}
                    onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, odometerKm: Number(event.target.value) })}
                    placeholder="Current odometer"
                  />
                  <input
                    type="month"
                    value={vehicleDraft.purchaseMonth}
                    onChange={(event) => app.setVehicleDraft({ ...vehicleDraft, purchaseMonth: event.target.value })}
                    aria-label="Purchase month"
                  />
                </div>
                <PrimaryButton className="min-h-[44px] self-start" type="submit">
                  Save vehicle
                </PrimaryButton>
              </form>
            </Card>
          ) : null}

          {garageForm === "record" && currentVehicle ? (
            <Card>
              <form className="flex flex-col gap-3" id="timeline-form" onSubmit={app.addTimelineNote}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <LabelCaps className="text-primary block mb-1">Logbook</LabelCaps>
                    <h3 className="font-display text-lg font-semibold uppercase text-on-surface">
                      {timelineDraft.kind === "Insurance" ? "Log insurance details" : "Add service or cost record"}
                    </h3>
                  </div>
                  <GhostButton aria-label="Close record form" className="min-h-[44px]" onClick={() => app.setGarageForm(null)}>
                    <X aria-hidden="true" className="w-4 h-4" />
                  </GhostButton>
                </div>
                <select
                  aria-label="Vehicle"
                  required
                  value={timelineDraft.vehicleId}
                  onChange={(event) => app.setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })}
                >
                  {garage.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.nickname || vehicle.model}
                    </option>
                  ))}
                </select>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    aria-label="Record type"
                    value={timelineDraft.kind}
                    onChange={(event) => app.setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })}
                  >
                    {timelineKinds.map((kind) => (
                      <option key={kind}>{kind}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={timelineDraft.happenedOn}
                    onChange={(event) => app.setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })}
                    aria-label="Record date"
                  />
                </div>
                <input
                  required
                  ref={app.timelineTitleRef}
                  value={timelineDraft.title}
                  onChange={(event) => app.setTimelineDraft({ ...timelineDraft, title: event.target.value })}
                  placeholder="Service, repair, fuel, or other record"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    min="0"
                    type="number"
                    aria-label="Amount paid"
                    value={timelineDraft.amount || ""}
                    onChange={(event) => app.setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
                    placeholder="Amount paid"
                  />
                  <input
                    min="0"
                    type="number"
                    aria-label="Record odometer"
                    value={timelineDraft.odometerKm || ""}
                    onChange={(event) => app.setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
                    placeholder="Odometer"
                  />
                </div>
                <textarea
                  aria-label="Service record details"
                  rows={4}
                  value={timelineDraft.note}
                  onChange={(event) => app.setTimelineDraft({ ...timelineDraft, note: event.target.value })}
                  placeholder="Bill details, symptoms, shop notes, or what you would do differently."
                />
                <PrimaryButton className="min-h-[44px] self-start" type="submit">
                  Save record
                </PrimaryButton>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}

      {currentVehicle ? (
        <>
          {/* ---- Service due ---- */}
          <div aria-label="Service due">
            <SectionHeader eyebrow="Reminders" title="Service due" />
            {garageReminders.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {garageReminders.map((reminder) => (
                  <Card
                    className={`flex flex-col gap-2 ${reminder.urgency === "Soon" ? "border-error/40" : ""}`}
                    key={reminder.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={reminder.urgency === "Soon" ? "error" : reminder.urgency === "Plan" ? "tertiary" : "default"}>
                        {reminder.urgency}
                      </Badge>
                      <Wrench aria-hidden="true" className={`w-4 h-4 ${reminder.urgency === "Soon" ? "text-error" : "text-outline"}`} />
                    </div>
                    <h3 className="font-display text-base font-semibold text-on-surface">{reminder.title}</h3>
                    <p className="text-sm text-on-surface-variant">
                      {reminder.vehicleName}: {reminder.detail}
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing due right now">
                <p>Log a service or insurance renewal and this panel starts tracking what is next, and when.</p>
              </EmptyState>
            )}
          </div>

          {/* ---- Active fleet ---- */}
          <div aria-label="Active fleet">
            <SectionHeader
              eyebrow="My cars"
              title="Active fleet"
              detail="Every car you own, with its recorded details and latest logbook entries."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {garage.map((vehicle) => {
                const entries = timeline.filter((entry) => entry.vehicleId === vehicle.id).slice(0, 3);
                const ledger = garageCostLedger.find((item) => item.vehicle.id === vehicle.id) ?? null;
                const reminder = garageReminders.find((item) => item.vehicleId === vehicle.id) ?? null;
                return (
                  <article
                    className="relative overflow-hidden rounded-lg bg-surface-container-high border border-outline-variant edge-highlight"
                    key={vehicle.id}
                  >
                    <EdgeGlow />
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <LabelCaps className="text-primary tracking-widest">{yearFor(vehicle)} · {vehicle.brand}</LabelCaps>
                          <h3 className="font-display text-xl font-semibold uppercase leading-tight text-on-surface mt-1.5 truncate">
                            {vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}
                          </h3>
                          <p className="text-sm text-on-surface-variant truncate mt-1">
                            {vehicleTitle(vehicle)}
                            {vehicle.city ? ` · ${vehicle.city}` : ""}
                          </p>
                        </div>
                      </div>
                      {/* Variant, fuel, gearbox and ownership as their own fields:
                          an unrecorded value reads as "Not set", never as a spec. */}
                      <div aria-label={`${vehicle.nickname || vehicle.model} details`} className="grid grid-cols-2 gap-2 mt-5" role="group">
                        {vehicleFactRows(vehicle).map((row) => (
                          <div
                            className="flex flex-col gap-1.5 p-2 rounded bg-surface-container-lowest/50 border border-outline-variant/30"
                            key={row.label}
                          >
                            <LabelCaps className="text-on-surface-variant">{row.label}</LabelCaps>
                            <span
                              className={`font-mono text-[11px] tracking-[0.08em] truncate ${
                                row.fact.source === "unknown" ? "text-outline" : "text-on-surface"
                              }`}
                            >
                              {row.fact.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-5">
                        <div className="flex flex-col gap-1.5 p-2 rounded bg-surface-container-lowest/50 border border-outline-variant/30">
                          <LabelCaps className="text-on-surface-variant">Odometer</LabelCaps>
                          <span className="font-mono text-[11px] tracking-[0.08em] text-on-surface">
                            {vehicle.odometerKm.toLocaleString("en-IN")} KM
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 p-2 rounded bg-surface-container-lowest/50 border border-outline-variant/30">
                          <LabelCaps className="text-on-surface-variant">Spend</LabelCaps>
                          <span className="font-mono text-[11px] tracking-[0.08em] text-on-surface">
                            {ledger && ledger.totalSpend ? formatMoney(ledger.totalSpend) : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 p-2 rounded bg-surface-container-lowest/50 border border-outline-variant/30">
                          <LabelCaps className="text-on-surface-variant">Status</LabelCaps>
                          <span className={`font-mono text-[11px] tracking-[0.08em] ${reminder?.urgency === "Soon" ? "text-error" : "text-on-surface"}`}>
                            {reminder ? reminder.urgency.toUpperCase() : "PARKED"}
                          </span>
                        </div>
                      </div>
                      {entries.length ? (
                        <div className="mt-5 border-t border-outline-variant/60 pt-4 flex flex-col gap-4">
                          {entries.map((entry) => (
                            <div className="flex flex-col gap-1" key={entry.id}>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-on-surface truncate">
                                  {entry.kind}: {entry.title}
                                </span>
                                <DataText className="shrink-0 text-on-surface-variant">{entry.happenedOn}</DataText>
                              </div>
                              <DataText className="text-on-surface-variant">
                                {formatMoney(entry.amount)} · {entry.odometerKm.toLocaleString("en-IN")} KM
                              </DataText>
                              {entry.note ? <p className="text-xs text-on-surface-variant line-clamp-2">{entry.note}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* ---- Running costs ---- */}
          <div aria-label="Running costs">
            <SectionHeader eyebrow="Cost ledger" title="Running costs" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {garageCostLedger.map((ledger) => (
                <Card className="flex flex-col gap-3" key={ledger.vehicle.id}>
                  <div>
                    <LabelCaps className="text-primary">{ledger.vehicle.brand}</LabelCaps>
                    <h3 className="font-display text-lg font-semibold uppercase text-on-surface mt-1">
                      {ledger.vehicle.nickname || ledger.vehicle.model}
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <DataText className="text-on-surface">{ledger.totalSpend ? formatMoney(ledger.totalSpend) : "—"}</DataText>
                      <LabelCaps className="text-on-surface-variant">Total</LabelCaps>
                    </div>
                    <div className="flex flex-col gap-1">
                      <DataText className="text-on-surface">
                        {ledger.costPerKm === null ? "—" : `${formatMoney(ledger.costPerKm, 2)}/km`}
                      </DataText>
                      <LabelCaps className="text-on-surface-variant">Cost/km</LabelCaps>
                    </div>
                    <div className="flex flex-col gap-1">
                      <DataText className="text-on-surface">{String(ledger.entryCount).padStart(2, "0")}</DataText>
                      <LabelCaps className="text-on-surface-variant">Records</LabelCaps>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant border-t border-outline-variant/60 pt-3 mt-1">
                    {ledger.latestEntry
                      ? `Latest: ${ledger.latestEntry.kind.toLowerCase()} · ${ledger.latestEntry.title}`
                      : "No costs recorded. Add service, repair, tyre, fuel, or insurance costs."}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* ---- Favorite cars / watchlist ---- */}
      <div aria-label="Favorite cars">
        <SectionHeader
          eyebrow="Favorite cars"
          title="Watchlist"
          detail="Models saved in your shortlist."
          actions={
            <GhostButton className="min-h-[44px]" onClick={app.openShortlistComposer}>
              <Plus aria-hidden="true" className="w-4 h-4" />
              Add favorite
            </GhostButton>
          }
        />
        {shortlist.length ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {shortlist.map((item) => (
              <Card className="flex flex-col gap-2" key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <LabelCaps className="text-on-surface-variant">{item.brand}</LabelCaps>
                  <Heart aria-hidden="true" className="w-4 h-4 text-primary fill-current" />
                </div>
                <h3 className="font-mono text-sm font-semibold tracking-[0.05em] text-on-surface truncate">{item.model}</h3>
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <LabelCaps className="text-primary">{item.budget ? formatINR(item.budget) : "No budget"}</LabelCaps>
                  <Badge tone={item.status === "Bought" ? "primary" : item.status === "Rejected" ? "error" : "default"}>{item.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No favourite cars yet">
            <p>Shortlist the models you are considering to compare price, owner reports, and inspection notes side by side.</p>
            <GhostButton className="min-h-[44px]" onClick={app.openShortlistComposer}>
              <Plus aria-hidden="true" className="w-4 h-4" />
              Shortlist a car
            </GhostButton>
          </EmptyState>
        )}
      </div>
    </section>
  );
}
