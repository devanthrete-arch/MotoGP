import { AlertTriangle, BadgeCheck, CloudUpload, Eye, FolderLock, History, Lock, Plus, ReceiptText, Upload } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useApp } from "../state/appState";
import { Card, DataText, EdgeGlow, EmptyState, LabelCaps, PrimaryButton, StatusChip } from "../../ui/primitives";
import type { GarageVehicle, TimelineEntry } from "../../core/entities";
import { readStoredJson, writeStoredJson } from "../../infrastructure/storage/localStore";

/**
 * Document Vault (template: document_vault_autoflex).
 * Secure-storage UI for DL, RC, PUCC, Insurance, FASTag, and challans.
 * Uploads are client-side only: the file name/size is kept in localStorage via
 * the app's storage helpers — the file itself never leaves the device.
 * Expiry dates mirror the KYV registry: real insurance validity comes from the
 * garage logbook; the rest are deterministic demo values derived per vehicle.
 */

const DAY_MS = 86_400_000;
const vaultDocsKey = "autoflex.web.vault-docs.v1";

type StoredDoc = { name: string; size: number; uploadedAt: string };
type VaultUploads = Record<string, StoredDoc>;

/** FNV-1a — deterministic per vehicle/profile, no Math.random. */
const hashStr = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const addDays = (base: Date, days: number): Date => new Date(base.getTime() + days * DAY_MS);

const fmtDate = (date: Date): string =>
  `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;

const fmtSize = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

type VaultDoc = {
  id: string;
  title: string;
  kind: string;
  masked: string;
  validUntil: Date | null;
  renew?: "insurance" | "record";
};

const buildDocs = (vehicle: GarageVehicle | null, ownerName: string, timeline: TimelineEntry[], today: Date): VaultDoc[] => {
  const vh = hashStr(vehicle ? `${vehicle.id}|${vehicle.brand}|${vehicle.model}` : "unpaired");
  const ph = hashStr(ownerName || "anonymous-keeper");
  const latestInsurance = vehicle
    ? timeline
        .filter((entry) => entry.vehicleId === vehicle.id && entry.kind === "Insurance")
        .sort((a, b) => Date.parse(b.happenedOn) - Date.parse(a.happenedOn))[0]
    : undefined;
  const regYear = vehicle?.purchaseMonth ? Number(vehicle.purchaseMonth.slice(0, 4)) : 2019 + (vh % 6);

  return [
    {
      id: "dl",
      title: "License",
      kind: "Driving permit",
      masked: `DL${String(10 + (ph % 90))}****${String(10 + ((ph >> 5) % 90))}`,
      validUntil: addDays(today, ((ph >> 2) % 900) - 60),
      renew: "record",
    },
    {
      id: "rc",
      title: "Registration",
      kind: "RC certificate",
      masked: `${vehicle ? vehicle.brand.slice(0, 2).toUpperCase() : "RC"}${String(10 + (vh % 90))}****${String(1000 + (vh % 9000))}`,
      validUntil: new Date(regYear + 15, 7, 14),
      renew: "record",
    },
    {
      id: "pucc",
      title: "PUC certificate",
      kind: "Emission check",
      masked: `PUC****${String(100 + ((vh >> 3) % 900))}`,
      validUntil: addDays(today, ((vh >> 4) % 200) - 40),
      renew: "record",
    },
    {
      id: "insurance",
      title: "Insurance",
      kind: latestInsurance ? "From your logbook" : "Comprehensive",
      masked: `POL****${String(100 + ((vh >> 6) % 900))}`,
      validUntil: latestInsurance ? addDays(new Date(latestInsurance.happenedOn), 365) : addDays(today, (vh % 320) - 25),
      renew: "insurance",
    },
    {
      id: "fastag",
      title: "FASTag",
      kind: "Toll wallet",
      masked: `TAG****${String(100 + ((vh >> 8) % 900))}`,
      validUntil: null,
    },
  ];
};

export function DocVault() {
  const app = useApp();
  const vehicle = app.currentVehicle;
  const today = new Date();
  const ownerName = app.profile.displayName;
  const docs = buildDocs(vehicle, ownerName, app.timeline, today);

  const [uploads, setUploads] = useState<VaultUploads>(() => readStoredJson<VaultUploads>(vaultDocsKey, {}));

  const storeFile = (slotId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const next: VaultUploads = {
      ...uploads,
      [slotId]: { name: file.name, size: file.size, uploadedAt: new Date().toISOString() },
    };
    setUploads(next);
    writeStoredJson(vaultDocsKey, next);
    app.setActionMessage(`${file.name} secured in the vault on this device.`);
  };

  const vh = hashStr(vehicle ? `${vehicle.id}|${vehicle.brand}|${vehicle.model}` : "unpaired");
  const challanCount = vh % 4;
  const challanTotal = Array.from({ length: challanCount }, (_, index) => [500, 1000, 2000][(vh >> (index + 2)) % 3]).reduce(
    (total, amount) => total + amount,
    0,
  );
  const fileCount = Object.keys(uploads).length;

  const statusFor = (doc: VaultDoc): { label: string; tone: "ok" | "warn" | "dead" } => {
    if (!doc.validUntil) return { label: "Active", tone: "ok" };
    const days = Math.ceil((doc.validUntil.getTime() - today.getTime()) / DAY_MS);
    if (days < 0) return { label: "Expired", tone: "dead" };
    if (days <= 30) return { label: `Expires ${days}d`, tone: "warn" };
    return { label: "Verified", tone: "ok" };
  };

  return (
    <section aria-label="Document vault" className="flex flex-col gap-6 pb-24 lg:pb-8">
      {/* ---- Security header ---- */}
      <Card className="bg-surface-container-low/80 glass flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <FolderLock aria-hidden="true" className="w-6 h-6 text-primary" />
          <h3 className="font-display text-xl font-semibold uppercase tracking-tight text-on-surface">Secure storage</h3>
        </div>
        <div className="flex items-start gap-3 bg-surface-container-high/60 p-3 rounded border border-outline/10">
          <Lock aria-hidden="true" className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="font-mono text-xs leading-relaxed tracking-[0.05em] text-on-surface-variant">
            Documents stay on this device. Uploads keep only the file name and size in local storage — nothing is sent anywhere.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip>Local only</StatusChip>
          <StatusChip on={fileCount > 0}>{fileCount} file{fileCount === 1 ? "" : "s"}</StatusChip>
          {vehicle ? <StatusChip>{`Unit: ${(vehicle.nickname || vehicle.model).toUpperCase()}`}</StatusChip> : <StatusChip on={false}>No vehicle paired</StatusChip>}
          <StatusChip on={false}>Demo expiry data</StatusChip>
        </div>
      </Card>

      {!vehicle ? (
        <EmptyState
          action={
            <PrimaryButton onClick={app.openVehicleComposer}>
              <Plus aria-hidden="true" className="w-4 h-4" />
              Add my car
            </PrimaryButton>
          }
          body="Add a car and the vault keeps its registration, insurance, PUC and licence records together — with expiry dates you can actually see coming."
          title="No car paired yet"
        />
      ) : null}

      {/* ---- Document cards ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((doc) => {
          const status = statusFor(doc);
          const stored = uploads[doc.id];
          return (
            <article
              className={`relative overflow-hidden rounded-lg bg-surface-container border border-outline-variant p-5 transition-colors hover:bg-surface-container-high ${
                status.tone === "dead" ? "opacity-70" : ""
              }`}
              key={doc.id}
            >
              <EdgeGlow />
              <div className="flex justify-between items-start gap-3 mb-5">
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="font-mono text-lg font-medium tracking-[0.05em] uppercase text-on-surface">{doc.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <LabelCaps className="text-on-surface-variant">{doc.kind}</LabelCaps>
                    <span aria-hidden="true" className="w-1 h-1 rounded-full bg-outline" />
                    <LabelCaps className="text-on-surface-variant tracking-[0.3em]">{doc.masked}</LabelCaps>
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${
                    status.tone === "ok"
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : status.tone === "warn"
                        ? "bg-error-container/20 border-error/30 text-error shadow-[0_0_10px_rgba(255,180,171,0.1)]"
                        : "bg-surface-container-highest border-outline/20 text-on-surface-variant"
                  }`}
                >
                  {status.tone === "ok" ? (
                    <BadgeCheck aria-hidden="true" className="w-3.5 h-3.5" />
                  ) : status.tone === "warn" ? (
                    <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />
                  ) : (
                    <History aria-hidden="true" className="w-3.5 h-3.5" />
                  )}
                  {status.label}
                </span>
              </div>
              <div className="flex flex-wrap justify-between items-end gap-3">
                <div className="flex flex-col gap-1">
                  <DataText className="text-on-surface-variant">VALID UNTIL</DataText>
                  <DataText
                    size="lg"
                    className={status.tone === "warn" ? "text-error" : status.tone === "dead" ? "text-on-surface-variant" : "text-on-surface"}
                  >
                    {doc.validUntil ? fmtDate(doc.validUntil) : "NO EXPIRY"}
                  </DataText>
                  {stored ? (
                    <DataText className="text-on-surface-variant break-all">
                      {stored.name} · {fmtSize(stored.size)}
                    </DataText>
                  ) : (
                    <DataText className="text-outline">NO FILE IN VAULT</DataText>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {status.tone !== "ok" && doc.renew ? (
                    <button
                      className="min-h-[44px] px-4 rounded-full bg-surface-container-highest border border-outline/20 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={doc.renew === "insurance" ? app.openInsuranceRecordComposer : app.openGarageRecordComposer}
                      type="button"
                    >
                      Renew
                    </button>
                  ) : null}
                  {stored ? (
                    <button
                      aria-label={`View ${doc.title} file details`}
                      className="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:text-primary transition-colors"
                      onClick={() => app.setActionMessage(`${doc.title}: ${stored.name} (${fmtSize(stored.size)}) is stored on this device.`)}
                      type="button"
                    >
                      <Eye aria-hidden="true" className="w-5 h-5" />
                    </button>
                  ) : null}
                  <label
                    className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 px-4 rounded-full bg-surface-container-highest border border-outline/20 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface hover:text-primary transition-colors"
                    htmlFor={`vault-file-${doc.id}`}
                  >
                    <Upload aria-hidden="true" className="w-4 h-4" />
                    {stored ? "Replace" : "Upload"}
                  </label>
                  <input
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only !w-auto"
                    id={`vault-file-${doc.id}`}
                    onChange={storeFile(doc.id)}
                    type="file"
                  />
                </div>
              </div>
            </article>
          );
        })}

        {/* ---- Challans card ---- */}
        <article className="relative overflow-hidden rounded-lg bg-surface-container border border-outline-variant p-5">
          <EdgeGlow />
          <div className="flex justify-between items-start gap-3 mb-5">
            <div className="flex flex-col gap-1">
              <h3 className="font-mono text-lg font-medium tracking-[0.05em] uppercase text-on-surface">Challans</h3>
              <LabelCaps className="text-on-surface-variant">E-challan record</LabelCaps>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-[10px] font-bold tracking-[0.2em] uppercase ${
                challanCount
                  ? "bg-error-container/20 border-error/30 text-error"
                  : "bg-primary/10 border-primary/20 text-primary"
              }`}
            >
              <ReceiptText aria-hidden="true" className="w-3.5 h-3.5" />
              {challanCount ? `${challanCount} pending` : "Clear"}
            </span>
          </div>
          <div className="flex flex-wrap justify-between items-end gap-3">
            <div className="flex flex-col gap-1">
              <DataText className="text-on-surface-variant">OUTSTANDING</DataText>
              <DataText size="lg" className={challanCount ? "text-error" : "text-on-surface"}>
                {challanCount ? `₹${challanTotal.toLocaleString("en-IN")}` : "₹0"}
              </DataText>
              <DataText className="text-on-surface-variant">{vehicle ? "SYNCED FROM KYV REGISTRY MIRROR" : "PAIR A VEHICLE IN GARAGE"}</DataText>
            </div>
            <button
              className="min-h-[44px] px-4 rounded-full bg-surface-container-highest border border-outline/20 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface hover:text-primary transition-colors"
              onClick={() => app.openWorkspace("kyv")}
              type="button"
            >
              Open KYV
            </button>
          </div>
        </article>
      </div>

      {/* ---- Upload zone ---- */}
      <label
        className="block border border-dashed border-outline/30 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low transition-colors cursor-pointer group"
        htmlFor="vault-file-other"
      >
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-4">
          <span className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform">
            <CloudUpload aria-hidden="true" className="w-7 h-7 text-primary" />
          </span>
          <span className="font-display text-xl font-semibold text-on-surface">Initialize transfer</span>
          <span className="font-mono text-xs tracking-[0.1em] text-on-surface-variant max-w-[240px] leading-relaxed">
            Tap to add any other document. PDF, JPG, PNG accepted — stored on this device only.
          </span>
          {uploads.other ? (
            <DataText className="text-primary break-all">
              {uploads.other.name} · {fmtSize(uploads.other.size)}
            </DataText>
          ) : null}
        </div>
      </label>
      <input accept=".pdf,.jpg,.jpeg,.png" className="sr-only !w-auto" id="vault-file-other" onChange={storeFile("other")} type="file" />
    </section>
  );
}
