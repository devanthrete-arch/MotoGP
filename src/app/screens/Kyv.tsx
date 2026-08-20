import { AlertTriangle, BadgeCheck, Cpu, FileUp, IdCard, Nfc, Plus, Share2, ShieldCheck, Wrench } from "lucide-react";
import { useApp } from "../state/appState";
import { findModel } from "../../core/catalog/carData";
import { Card, DataText, EmptyState, LabelCaps, PrimaryButton, StatusChip } from "../../ui/primitives";
import { cn } from "../../ui";
import { VehicleFactGrid } from "../../ui/VehicleFactGrid";
import { PLACEHOLDER } from "../../core/catalog/vehicleFacts";
import type { GarageVehicle, TimelineEntry } from "../../core/entities";

/**
 * Know-Your-Vehicle dashboard (template: kyv_dashboard_autoflex).
 * Everything on the RC: reg number, keeper, chassis/engine (masked), RC status,
 * fitness/tax, insurance, PUCC, FASTag, and pending challans for the selected
 * garage vehicle. Where the app has no real record (e.g. chassis numbers), values
 * are derived deterministically from the vehicle entry — no randomness, stable
 * across renders — and the screen is labelled as a demo registry mirror.
 */

const DAY_MS = 86_400_000;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** FNV-1a — deterministic per vehicle, no Math.random. */
const hashStr = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const stateCodeFor = (city: string, h: number): string => {
  const rules: Array<[RegExp, string]> = [
    [/pune|mumbai|nagpur|nashik|thane/i, "MH"],
    [/delhi|ncr|noida|gurgaon|gurugram/i, "DL"],
    [/bengaluru|bangalore|mysuru/i, "KA"],
    [/chennai|coimbatore|madurai/i, "TN"],
    [/hyderabad|secunderabad/i, "TS"],
    [/ahmedabad|surat|vadodara/i, "GJ"],
    [/chandigarh/i, "CH"],
    [/jaipur|jodhpur|udaipur/i, "RJ"],
    [/kolkata|howrah/i, "WB"],
    [/kochi|cochin|thiruvananthapuram/i, "KL"],
    [/lucknow|kanpur|varanasi/i, "UP"],
  ];
  for (const [pattern, code] of rules) if (pattern.test(city)) return code;
  const fallback = ["MH", "DL", "KA", "TN", "GJ", "UP"];
  return fallback[h % fallback.length];
};

const addDays = (base: Date, days: number): Date => new Date(base.getTime() + days * DAY_MS);

const fmtDate = (date: Date): string => `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

const daysUntil = (date: Date, today: Date): number => Math.ceil((date.getTime() - today.getTime()) / DAY_MS);

type KyvRecord = {
  regNumber: string;
  rto: string;
  regDate: string;
  chassisMasked: string;
  engineMasked: string;
  rcStatus: "Active" | "Suspended" | "Expired";
  fitnessUpto: string;
  taxStatus: string;
  insuranceUpto: Date;
  insuranceFromLog: boolean;
  puccUpto: Date;
  fastagBalance: number;
  challans: Array<{ id: string; label: string; amount: number; on: string }>;
};

const buildKyvRecord = (vehicle: GarageVehicle, timeline: TimelineEntry[], today: Date): KyvRecord => {
  const h = hashStr(`${vehicle.id}|${vehicle.brand}|${vehicle.model}|${vehicle.variant}`);
  const state = stateCodeFor(vehicle.city, h);
  const rtoNum = String(1 + (h % 29)).padStart(2, "0");
  const last4 = String(1000 + (h % 9000));
  const regYear = vehicle.purchaseMonth ? Number(vehicle.purchaseMonth.slice(0, 4)) : 2019 + (h % 6);
  const regMonth = vehicle.purchaseMonth ? Number(vehicle.purchaseMonth.slice(5, 7)) - 1 : h % 12;
  const serial = (h % 36 ** 3).toString(36).toUpperCase().padStart(3, "0");

  // Insurance: prefer the real logbook (latest Insurance timeline entry + 1 year).
  const latestInsurance = timeline
    .filter((entry) => entry.vehicleId === vehicle.id && entry.kind === "Insurance")
    .sort((a, b) => Date.parse(b.happenedOn) - Date.parse(a.happenedOn))[0];
  const insuranceUpto = latestInsurance
    ? addDays(new Date(latestInsurance.happenedOn), 365)
    : addDays(today, (h % 320) - 25);

  const challanCount = h % 4;
  const challanKinds = ["Over-speeding (radar)", "No-parking zone", "Signal jump (camera)"];
  const challans = Array.from({ length: challanCount }, (_, index) => ({
    id: `${vehicle.id}-challan-${index}`,
    label: challanKinds[(h + index) % challanKinds.length],
    amount: [500, 1000, 2000][(h >> (index + 2)) % 3],
    on: fmtDate(addDays(today, -(((h >> index) % 220) + 14))),
  }));

  return {
    regNumber: `${state} ${rtoNum} ** ${last4}`,
    rto: `${state}-${rtoNum}`,
    regDate: fmtDate(new Date(regYear, regMonth, 1 + (h % 27))),
    chassisMasked: `${serial}${state}**********${last4}`,
    engineMasked: `${vehicle.brand.slice(0, 2).toUpperCase()}${serial}*******${String(100 + (h % 900))}`,
    rcStatus: h % 13 === 0 ? "Expired" : h % 9 === 0 ? "Suspended" : "Active",
    fitnessUpto: `${regYear + 15}`,
    taxStatus: "OTT PAID (PRIVATE)",
    insuranceUpto,
    insuranceFromLog: Boolean(latestInsurance),
    puccUpto: addDays(today, ((h >> 4) % 200) - 40),
    fastagBalance: 120 + (h % 2400),
    challans,
  };
};

export function Kyv() {
  const app = useApp();
  const vehicle = app.currentVehicle;
  const today = new Date();
  const record = vehicle ? buildKyvRecord(vehicle, app.timeline, today) : null;
  const spec = vehicle ? findModel(vehicle.brand, vehicle.model) : undefined;
  // Only an actual trim match counts. Falling back to `variants[0]` used to
  // print one arbitrary trim's fuel, gearbox and mileage as if they were this
  // car's — a guess dressed up as registry data.
  const variantTrim = vehicle?.variant.trim().toLowerCase() ?? "";
  const variantSpec = variantTrim
    ? spec?.variants.find((v) => variantTrim === v.name.toLowerCase() || variantTrim.includes(v.name.toLowerCase()))
    : undefined;

  const insuranceDays = record ? daysUntil(record.insuranceUpto, today) : 0;
  const puccDays = record ? daysUntil(record.puccUpto, today) : 0;
  const rcOk = record?.rcStatus === "Active";
  const insuranceOk = insuranceDays > 0;
  const puccOk = puccDays > 0;
  const fastagLow = (record?.fastagBalance ?? 0) < 300;
  const challanTotal = record?.challans.reduce((total, item) => total + item.amount, 0) ?? 0;
  const syncStamp = record
    ? `14:${String(hashStr(vehicle?.id ?? "") % 60).padStart(2, "0")}:${String(hashStr(vehicle?.model ?? "") % 60).padStart(2, "0")}`
    : "--:--:--";

  const complianceCards = record
    ? [
        {
          id: "rc",
          label: "RC status",
          value: record.rcStatus.toUpperCase(),
          ok: rcOk,
          icon: rcOk ? BadgeCheck : AlertTriangle,
        },
        {
          id: "insurance",
          label: "Insurance",
          value: insuranceOk ? (insuranceDays <= 30 ? `RENEW ${insuranceDays}D` : "VALID") : "EXPIRED",
          ok: insuranceOk && insuranceDays > 30,
          icon: insuranceOk && insuranceDays > 30 ? ShieldCheck : AlertTriangle,
        },
        {
          id: "pucc",
          label: "PUCC emission",
          value: puccOk ? (puccDays <= 15 ? `EXPIRES ${puccDays}D` : "VALID") : "REQUIRED",
          ok: puccOk && puccDays > 15,
          icon: puccOk && puccDays > 15 ? BadgeCheck : AlertTriangle,
        },
        {
          id: "fastag",
          label: "FASTag wallet",
          value: fastagLow ? "LOW BAL" : "ACTIVE",
          ok: !fastagLow,
          icon: Nfc,
        },
      ]
    : [];

  const registryRows = record && vehicle
    ? [
        { label: "Registration no", value: record.regNumber },
        { label: "Registered keeper", value: (app.profile.displayName || "Private owner").toUpperCase() },
        { label: "Registration date", value: record.regDate },
        { label: "Chassis no", value: record.chassisMasked },
        { label: "Engine no", value: record.engineMasked },
        { label: "Fitness valid upto", value: record.fitnessUpto },
        { label: "Road tax", value: record.taxStatus },
        { label: "Insurance valid upto", value: `${fmtDate(record.insuranceUpto)}${record.insuranceFromLog ? " · FROM LOG" : ""}` },
        { label: "PUCC valid upto", value: fmtDate(record.puccUpto) },
        { label: "FASTag balance", value: `₹${record.fastagBalance.toLocaleString("en-IN")}` },
        { label: "Issuing RTO", value: `${record.rto} ${vehicle.city ? vehicle.city.toUpperCase() : "RTO"}` },
        {
          label: "Pending challans",
          value: record.challans.length ? `${record.challans.length} · ₹${challanTotal.toLocaleString("en-IN")}` : "NONE",
          alert: record.challans.length > 0,
        },
      ]
    : [];

  const hardwareRows = vehicle
    ? [
        {
          label: "Engine",
          value: variantSpec?.engineCC ? `${variantSpec.engineCC} CC` : PLACEHOLDER,
          muted: !variantSpec?.engineCC,
        },
        {
          label: "Output",
          value: variantSpec?.powerBHP
            ? `${variantSpec.powerBHP} BHP${variantSpec.torqueNM ? ` / ${variantSpec.torqueNM} NM` : ""}`
            : PLACEHOLDER,
          muted: !variantSpec?.powerBHP,
        },
        {
          label: "Efficiency (ARAI)",
          value: variantSpec?.mileageKMPL
            ? `${variantSpec.mileageKMPL} ${variantSpec.fuel === "Electric" ? "KM/CHARGE" : "KMPL"}`
            : PLACEHOLDER,
          muted: !variantSpec?.mileageKMPL,
        },
        { label: "Seating", value: variantSpec?.seats ? `${variantSpec.seats} SEATS` : PLACEHOLDER, muted: !variantSpec?.seats },
        { label: "Odometer", value: `${vehicle.odometerKm.toLocaleString("en-IN")} KM`, muted: false },
      ]
    : [];

  const quickActions = [
    { id: "upload", label: "Upload doc", icon: FileUp, onClick: () => app.openWorkspace("vault") },
    {
      id: "view-rc",
      label: "View RC",
      icon: IdCard,
      onClick: () => document.getElementById("kyv-registry")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
    { id: "maintain", label: "Maintain", icon: Wrench, onClick: app.openGarageRecordComposer },
    { id: "share", label: "Share", icon: Share2, onClick: app.exportGarage },
  ];

  return (
    <section aria-label="Know your vehicle" className="flex flex-col gap-6 pb-24 lg:pb-8">
      {/* ---- Vehicle picker ---- */}
      {app.garage.length > 1 ? (
        <div aria-label="Choose vehicle" className="flex flex-wrap gap-2" role="group">
          {app.garage.map((item) => (
            <button
              aria-pressed={item.id === vehicle?.id}
              className={cn(
                "min-h-[44px] px-4 rounded border font-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-colors",
                item.id === vehicle?.id
                  ? "bg-primary text-on-primary border-primary glow-ring"
                  : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-outline",
              )}
              key={item.id}
              onClick={() => app.selectVehicle(item.id)}
              type="button"
            >
              {item.nickname || item.model}
            </button>
          ))}
        </div>
      ) : null}

      {/* ---- Hero ---- */}
      <div className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest edge-highlight">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(145,144,149,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(145,144,149,0.15) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent pointer-events-none" />
        <div className="absolute top-4 right-4 flex flex-col items-end z-10">
          <div className="flex items-center gap-1.5 mb-1">
            <span aria-hidden="true" className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <LabelCaps className="text-primary">{vehicle ? "Link active" : "No link"}</LabelCaps>
          </div>
          <DataText className="text-on-surface-variant">SYNC: {syncStamp}</DataText>
        </div>
        <div className="relative z-10 p-4 lg:p-6 pt-16">
          <div className="inline-block px-2 py-1 bg-primary/10 mb-2 shadow-[0_0_0_1px_rgba(199,198,203,0.3)] backdrop-blur-sm rounded-sm">
            <LabelCaps className="text-primary tracking-widest">
              {vehicle ? `Nickname: ${vehicle.nickname || vehicle.model}` : "No vehicle paired"}
            </LabelCaps>
          </div>
          <h3 className="font-display text-2xl lg:text-3xl font-semibold text-on-surface mb-3">
            {vehicle ? `${yearLabel(vehicle)}${vehicle.brand} ${vehicle.model}` : "Pair a vehicle to decode it"}
          </h3>
          {vehicle ? <VehicleFactGrid className="mb-4 max-w-3xl" vehicle={vehicle} /> : null}
          {vehicle && record ? (
            <div className="inline-flex items-center gap-2 bg-surface-container/80 backdrop-blur-md px-4 py-2 rounded shadow-[0_0_0_1px_rgba(199,198,203,0.2)]">
              <IdCard aria-hidden="true" className="w-4 h-4 text-on-surface-variant" />
              <DataText size="lg" className="text-on-surface uppercase tracking-widest">{record.regNumber}</DataText>
            </div>
          ) : (
            <EmptyState
              action={
                <PrimaryButton onClick={app.openVehicleComposer}>
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  Add my car
                </PrimaryButton>
              }
              body="Add a car and KYV keeps its registration, insurance, PUC and FASTag status in one readable place."
              className="mt-2 max-w-md"
              title="No car paired yet"
            />
          )}
        </div>
      </div>

      {vehicle && record ? (
        <>
          {/* ---- Quick actions ---- */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((action) => (
              <button
                className="flex flex-col items-center justify-center gap-2 min-h-[44px] p-3 rounded bg-surface-container hover:bg-surface-container-high transition-colors shadow-[0_0_0_1px_rgba(199,198,203,0.1)] group"
                key={action.id}
                onClick={action.onClick}
                type="button"
              >
                <span className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shadow-inner group-hover:shadow-[0_0_10px_rgba(199,198,203,0.3)] transition-shadow">
                  <action.icon aria-hidden="true" className="w-5 h-5 text-primary" />
                </span>
                <LabelCaps className="text-on-surface-variant text-center">{action.label}</LabelCaps>
              </button>
            ))}
          </div>

          {/* ---- Compliance telemetry ---- */}
          <div aria-label="Compliance telemetry">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck aria-hidden="true" className="w-4 h-4 text-on-surface-variant" />
              <LabelCaps className="text-on-surface-variant tracking-widest">Compliance telemetry</LabelCaps>
              <div aria-hidden="true" className="flex-1 h-px bg-gradient-to-r from-outline/30 to-transparent ml-2" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {complianceCards.map((card) => (
                <div
                  className={`relative overflow-hidden flex flex-col justify-between h-28 p-4 rounded backdrop-blur-md ${
                    card.ok
                      ? "bg-surface-container shadow-[0_0_0_1px_rgba(199,198,203,0.15)]"
                      : "bg-error-container/20 shadow-[0_0_0_1px_rgba(255,180,171,0.3)]"
                  }`}
                  key={card.id}
                >
                  <div
                    aria-hidden="true"
                    className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r ${card.ok ? "from-primary/50" : "from-error/50"} to-transparent`}
                  />
                  <DataText className={card.ok ? "text-on-surface-variant" : "text-error"}>{card.label.toUpperCase()}</DataText>
                  <div className="flex items-center justify-between gap-2">
                    <DataText size="lg" className={`uppercase ${card.ok ? "text-on-surface" : "text-error"}`}>{card.value}</DataText>
                    <card.icon aria-hidden="true" className={`w-5 h-5 shrink-0 ${card.ok ? "text-primary" : "text-error animate-pulse"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Registry data (RC mirror) ---- */}
          <div aria-label="Registry data" id="kyv-registry">
            <div className="flex items-center gap-2 mb-4">
              <IdCard aria-hidden="true" className="w-4 h-4 text-on-surface-variant" />
              <LabelCaps className="text-on-surface-variant tracking-widest">Registry data</LabelCaps>
              <div aria-hidden="true" className="flex-1 h-px bg-gradient-to-r from-outline/30 to-transparent ml-2" />
            </div>
            <div className="flex flex-col gap-1.5">
              {registryRows.map((row) => (
                <div
                  className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1.5 p-3 rounded-sm bg-surface-container shadow-[0_0_0_1px_rgba(199,198,203,0.1)]"
                  key={row.label}
                >
                  <DataText className="text-on-surface-variant uppercase">{row.label}</DataText>
                  <DataText className={`text-right break-all ${"alert" in row && row.alert ? "text-error" : "text-on-surface"}`}>{row.value}</DataText>
                </div>
              ))}
            </div>
            {record.challans.length ? (
              <div className="flex flex-col gap-1 mt-2">
                {record.challans.map((challan) => (
                  <div
                    className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 p-3 rounded-sm bg-error-container/15 shadow-[0_0_0_1px_rgba(255,180,171,0.25)]"
                    key={challan.id}
                  >
                    <DataText className="text-error uppercase">{challan.label}</DataText>
                    <DataText className="text-on-surface text-right">₹{challan.amount.toLocaleString("en-IN")} · {challan.on}</DataText>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ---- Hardware specifications ---- */}
          <div aria-label="Hardware specifications">
            <div className="flex items-center gap-2 mb-4">
              <Cpu aria-hidden="true" className="w-4 h-4 text-on-surface-variant" />
              <LabelCaps className="text-on-surface-variant tracking-widest">Hardware specifications</LabelCaps>
              <div aria-hidden="true" className="flex-1 h-px bg-gradient-to-r from-outline/30 to-transparent ml-2" />
            </div>
            <div className="flex flex-col gap-1.5">
              {hardwareRows.map((row) => (
                <div
                  className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1.5 p-3 rounded-sm bg-surface-container shadow-[0_0_0_1px_rgba(199,198,203,0.1)]"
                  key={row.label}
                >
                  <DataText className="text-on-surface-variant uppercase">{row.label}</DataText>
                  <DataText className={`text-right ${row.muted ? "text-outline" : "text-on-surface"}`}>{row.value}</DataText>
                </div>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant mt-3">
              Specs come from the model catalog and only appear when your recorded variant matches a known trim.
            </p>
          </div>

          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip>Registry mirror</StatusChip>
              <StatusChip on={false}>Demo data</StatusChip>
            </div>
            <p className="text-xs text-on-surface-variant">
              Compliance and registry values are a local demonstration derived from your garage entry
              {record.insuranceFromLog ? " (insurance validity comes from your own logbook)" : ""}. Connect VAHAN sync in a future
              release for live RC data.
            </p>
          </Card>
        </>
      ) : null}
    </section>
  );
}

const yearLabel = (vehicle: GarageVehicle): string => (vehicle.purchaseMonth ? `${vehicle.purchaseMonth.slice(0, 4)} ` : "");
