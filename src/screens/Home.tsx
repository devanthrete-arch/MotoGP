import { lazy, Suspense } from "react";
import {
  BarChart3,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  FolderLock,
  Gauge,
  IndianRupee,
  ListChecks,
  MessageCircle,
  Plus,
  ScanSearch,
  Search,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useApp } from "../appState";
import { formatMoney } from "../insights";
import { Badge, DataText, EdgeGlow, GhostButton, LabelCaps, StatusChip } from "../components/ui";

const Hero3D = lazy(() => import("../components/Hero3D"));

/** Telemetry-style stat tile for the live grid. */
function StatTile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden bg-surface-container-high border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
      <EdgeGlow />
      <LabelCaps className="text-on-surface-variant">{label}</LabelCaps>
      <DataText size="lg" className="text-on-surface">
        {value}
        {unit ? <span className="font-mono text-xs text-on-surface-variant ml-1.5 tracking-[0.1em]">{unit}</span> : null}
      </DataText>
      {sub ? <DataText className="text-outline">{sub}</DataText> : null}
      <svg aria-hidden="true" className="absolute bottom-2 right-2 w-12 h-6 text-primary/25" fill="none" viewBox="0 0 48 24">
        <path d="M2 20h8l6-14 8 10 10-12 12 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function Home() {
  const app = useApp();
  const {
    currentVehicle,
    currentReminder,
    currentLedger,
    isFirstRun,
    garage,
    vehicleMenuOpen,
    posts,
  } = app;

  const dueSoonCount =
    app.shortlistDecisionLanes.filter((lane) => lane.priority === "High").length +
    app.garageReminders.filter((reminder) => reminder.urgency === "Soon").length;

  const entryPoints = [
    {
      key: "garage",
      title: "Garage",
      icon: CarFront,
      count: garage.length,
      sub: "SERVICE // COSTS // DOCS",
      open: () => app.openWorkspace("garage"),
    },
    {
      key: "community",
      title: "Community",
      icon: MessageCircle,
      count: posts.length,
      sub: "OWNER NOTES // FIXES",
      open: () => app.openWorkspace("community", "community", "latest"),
    },
    {
      key: "compare",
      title: "Compare",
      icon: ListChecks,
      count: app.shortlist.length,
      sub: "SHORTLIST // PRICING",
      open: () => app.openWorkspace("shortlist"),
    },
  ];

  return (
    <div className="flex flex-col gap-10 pb-24 lg:pb-8" id="top">
      {/* HERO */}
      <section aria-label="Cockpit overview" className="relative">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex items-center gap-2">
              <StatusChip>{isFirstRun ? "SYS.INIT" : "SYS.RDY"}</StatusChip>
              <DataText className="text-outline hidden sm:inline">AUTOFLEX // COCKPIT</DataText>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight leading-[1.05] text-on-surface">
              {currentVehicle ? (
                <>
                  {currentVehicle.nickname || currentVehicle.model}
                  <br />
                  <span className="text-primary glow-text">at a glance.</span>
                </>
              ) : (
                <>
                  Where precision meets{" "}
                  <span className="text-primary glow-text">digital telemetry.</span>
                </>
              )}
            </h1>
            <p className="text-on-surface-variant max-w-md">
              {currentVehicle
                ? "Maintenance, costs, and what owners report — decoded in one place."
                : "Start with the car you own or the cars you are considering."}
            </p>

            {isFirstRun ? (
              <>
                <div aria-label="Choose how to start" className="flex flex-col sm:flex-row gap-3">
                  <button
                    className="flex items-center gap-3 bg-primary text-on-primary rounded px-5 py-4 min-h-[44px] shadow-[0_0_15px_rgba(199,198,203,0.3)] transition-transform active:scale-95 text-left"
                    type="button"
                    onClick={app.openVehicleComposer}
                  >
                    <CarFront aria-hidden="true" className="w-5 h-5 shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <LabelCaps className="opacity-70">I already own a car</LabelCaps>
                      <span className="font-display font-semibold uppercase tracking-tight">Add my car</span>
                    </span>
                  </button>
                  <button
                    className="flex items-center gap-3 bg-transparent text-on-surface border border-outline-variant hover:border-outline rounded px-5 py-4 min-h-[44px] transition-colors text-left"
                    type="button"
                    onClick={app.openShortlistComposer}
                  >
                    <ListChecks aria-hidden="true" className="w-5 h-5 shrink-0" />
                    <span className="flex flex-col gap-0.5">
                      <LabelCaps className="text-outline">I'm buying a car</LabelCaps>
                      <span className="font-display font-semibold uppercase tracking-tight">Start my shortlist</span>
                    </span>
                  </button>
                </div>
                <DataText className="text-outline">Choose one path to begin. You can add the other later.</DataText>
              </>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                {garage.length === 1 && currentVehicle ? (
                  <div aria-label="Current vehicle" className="relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg px-4 py-3 flex flex-col gap-0.5">
                    <EdgeGlow />
                    <LabelCaps className="text-outline">My car</LabelCaps>
                    <strong className="font-display uppercase tracking-tight text-on-surface">
                      {currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`}
                    </strong>
                    <DataText className="text-on-surface-variant">
                      {currentVehicle.brand} {currentVehicle.model}
                      {currentVehicle.variant ? ` · ${currentVehicle.variant}` : ""}
                    </DataText>
                  </div>
                ) : currentVehicle ? (
                  <div className="relative">
                    <LabelCaps className="text-outline block mb-1.5">Current vehicle</LabelCaps>
                    <button
                      aria-controls="vehicle-menu"
                      aria-expanded={vehicleMenuOpen}
                      aria-haspopup="listbox"
                      className="flex items-center justify-between gap-3 min-w-[220px] min-h-[44px] bg-surface-container-high border border-outline-variant hover:border-outline rounded px-4 py-2.5 text-left transition-colors"
                      ref={app.vehicleTriggerRef}
                      type="button"
                      onClick={() => (vehicleMenuOpen ? app.setVehicleMenuOpen(false) : app.openVehicleMenu())}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          app.openVehicleMenu();
                        }
                      }}
                    >
                      <span className="flex flex-col min-w-0">
                        <strong className="font-display text-sm uppercase tracking-tight text-on-surface truncate">
                          {currentVehicle.nickname || currentVehicle.model}
                        </strong>
                        <DataText className="text-outline truncate">
                          {currentVehicle.brand} {currentVehicle.model}
                        </DataText>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`w-4 h-4 shrink-0 text-on-surface-variant transition-transform ${vehicleMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      aria-label="Choose a vehicle"
                      className={`${vehicleMenuOpen ? "flex" : "hidden"} absolute left-0 top-full mt-2 z-30 w-72 max-w-[80vw] flex-col gap-0.5 bg-surface-container-high border border-outline-variant rounded-lg shadow-xl shadow-black/40 p-1.5`}
                      id="vehicle-menu"
                      onKeyDown={app.handleVehicleMenuKeyDown}
                      ref={app.vehicleMenuRef}
                      role="listbox"
                    >
                      {garage.map((vehicle) => (
                        <button
                          aria-selected={vehicle.id === currentVehicle.id}
                          className={`flex items-center gap-2 w-full rounded px-3 py-2.5 min-h-[44px] text-left transition-colors hover:bg-surface-container-highest ${
                            vehicle.id === currentVehicle.id ? "text-primary" : "text-on-surface"
                          }`}
                          key={vehicle.id}
                          role="option"
                          type="button"
                          onClick={() => app.selectVehicle(vehicle.id)}
                        >
                          <span aria-hidden="true" className="w-4 shrink-0">
                            {vehicle.id === currentVehicle.id ? <Check className="w-4 h-4" /> : null}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <strong className="text-sm truncate">{vehicle.nickname || vehicle.model}</strong>
                            <DataText className="text-outline truncate">
                              {vehicle.brand} {vehicle.model}
                              {vehicle.variant ? ` · ${vehicle.variant}` : ""}
                            </DataText>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <GhostButton className="min-h-[44px]" onClick={app.openVehicleComposer}>
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  Add another car
                </GhostButton>
              </div>
            )}
          </div>

          {/* Hero visual — 3D module with HUD overlays */}
          <div className="relative min-h-[280px] rounded-lg overflow-hidden border border-outline-variant bg-surface-container-lowest edge-highlight">
            <Suspense fallback={<div className="h-[420px] bg-surface-container-lowest" />}>
              <Hero3D />
            </Suspense>
            <div aria-hidden="true" className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
              <span className="label-caps text-primary bg-primary-container/80 backdrop-blur-sm px-2 py-1 rounded shadow-[0_0_8px_rgba(199,198,203,0.3)]">
                {isFirstRun ? "SYS.INIT" : "SYS.RDY"}
              </span>
              <DataText className="text-on-surface-variant">ENG: OPTIMAL</DataText>
            </div>
            <div aria-hidden="true" className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
              <DataText size="lg" className="text-primary glow-text">
                {currentVehicle ? `${currentVehicle.odometerKm.toLocaleString("en-IN")} KM` : "0-100 // 9.5s"}
              </DataText>
              <div className="w-24 h-1 bg-surface-container rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-primary shadow-[0_0_10px_rgba(199,198,203,0.8)]" />
              </div>
            </div>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none z-[5]" />
          </div>
        </div>
      </section>

      {!isFirstRun ? (
        <>
          {/* NEXT ACTION */}
          <section aria-label="Next action">
            <div className="relative overflow-hidden bg-surface-container border border-outline-variant rounded-lg">
              <EdgeGlow />
              <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
                <div className="p-5 flex flex-col items-start gap-3">
                  <LabelCaps className="text-primary">Next action</LabelCaps>
                  <h2 className="font-display text-xl font-semibold uppercase tracking-tight text-on-surface">
                    {currentReminder?.title ?? "Add your car"}
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {currentReminder?.detail ?? "Add one vehicle to track service, repairs, and costs."}
                  </p>
                  <GhostButton
                    className="mt-1 min-h-[44px]"
                    onClick={
                      currentReminder?.title.toLowerCase().includes("insurance")
                        ? app.openInsuranceRecordComposer
                        : app.openGarageRecordComposer
                    }
                  >
                    <Wrench aria-hidden="true" className="w-4 h-4" />
                    {currentReminder?.title.toLowerCase().includes("insurance") ? "Log insurance details" : "Add service record"}
                  </GhostButton>
                </div>
                <img
                  alt="Compact SUV in a dark service bay"
                  className="h-44 md:h-full w-full object-cover mix-blend-luminosity opacity-80"
                  decoding="async"
                  height="941"
                  loading="lazy"
                  sizes="(max-width: 600px) 100vw, (max-width: 1080px) 45vw, 385px"
                  src="/autoflex-garage.jpg"
                  width="1672"
                />
              </div>
            </div>
          </section>

          {/* LIVE TELEMETRY GRID */}
          <section aria-label="Current car summary">
            <div className="flex items-center gap-2 mb-3">
              <Gauge aria-hidden="true" className="w-4 h-4 text-primary" />
              <LabelCaps className="text-on-surface">Live telemetry grid</LabelCaps>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile
                label="Odometer"
                unit={currentVehicle ? "KM" : undefined}
                value={currentVehicle ? currentVehicle.odometerKm.toLocaleString("en-IN") : "--"}
              />
              <StatTile label="Total spent" value={currentLedger ? formatMoney(currentLedger.totalSpend) : "--"} />
              <StatTile label="Due soon" sub="HIGH-PRIORITY ITEMS" value={String(dueSoonCount).padStart(2, "0")} />
              <StatTile label="Owner notes" sub="COMMUNITY FEED" value={String(posts.length).padStart(2, "0")} />
            </div>
          </section>
        </>
      ) : null}

      {/* DIGITAL PIT LANE — entry points */}
      <section aria-label="Open a workspace">
        <div className="flex items-center gap-2 mb-3">
          <ChevronRight aria-hidden="true" className="w-4 h-4 text-primary" />
          <LabelCaps className="text-on-surface">Digital pit lane</LabelCaps>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {entryPoints.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                className="group relative overflow-hidden flex flex-col gap-2 text-left bg-surface-container border border-outline-variant rounded-lg p-4 min-h-[44px] hover:bg-surface-container-high transition-colors"
                key={entry.key}
                type="button"
                onClick={entry.open}
              >
                <EdgeGlow />
                <span className="flex items-center justify-between w-full">
                  <Icon aria-hidden="true" className="w-5 h-5 text-primary" />
                  <DataText className="text-outline">{String(entry.count).padStart(2, "0")}</DataText>
                </span>
                <span className="font-display font-semibold uppercase tracking-tight text-on-surface">{entry.title}</span>
                <DataText className="text-on-surface-variant">{entry.sub}</DataText>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-primary mt-1">
                  Open
                  <ChevronRight aria-hidden="true" className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
        {/* Modules row — primary route to KYV/Vault/Analytics/Creators on mobile,
            where the sidebar rail is hidden and the dock only carries cockpit items. */}
        <nav aria-label="Modules" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[
            { key: "kyv" as const, label: "KYV", sub: "DECODE // RECALLS", icon: ScanSearch },
            { key: "vault" as const, label: "Vault", sub: "DOCS // EXPIRY", icon: FolderLock },
            { key: "analytics" as const, label: "Analytics", sub: "SPEND // TRENDS", icon: BarChart3 },
            { key: "creators" as const, label: "Creators", sub: "REVIEWS // NETWORK", icon: UsersRound },
          ].map((module) => {
            const Icon = module.icon;
            return (
              <button
                className="flex items-center gap-3 text-left bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3 min-h-[44px] hover:bg-surface-container-high hover:border-outline transition-colors"
                key={module.key}
                type="button"
                onClick={() => app.openWorkspace(module.key)}
              >
                <Icon aria-hidden="true" className="w-4 h-4 shrink-0 text-primary" />
                <span className="flex flex-col min-w-0">
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface">{module.label}</span>
                  <DataText className="text-outline truncate">{module.sub}</DataText>
                </span>
              </button>
            );
          })}
        </nav>
      </section>

      {/* RECENT OWNER NOTES */}
      <section aria-label="Recent useful activity">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <LabelCaps className="text-primary block mb-1">New in community</LabelCaps>
            <h2 className="font-display text-xl font-semibold uppercase tracking-tight text-on-surface">Recent owner notes</h2>
          </div>
          <GhostButton className="min-h-[44px]" onClick={() => app.openWorkspace("community", "community", "latest")}>
            <Search aria-hidden="true" className="w-4 h-4" />
            Search notes
          </GhostButton>
        </div>
        <div className="flex flex-col gap-2">
          {posts.slice(0, 3).map((post) => (
            <a
              className="group flex items-center gap-3 bg-surface-container border border-outline-variant rounded px-4 py-3 min-h-[44px] no-underline hover:bg-surface-container-high transition-colors"
              href="#feed"
              key={post.id}
              onClick={(event) => {
                event.preventDefault();
                app.openWorkspace("community", "community", "latest");
                app.openPostDetail(post);
              }}
            >
              <Badge className="shrink-0">{post.label}</Badge>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <strong className="text-sm text-on-surface truncate">{post.title}</strong>
                <DataText className="text-outline uppercase truncate">
                  {post.brand} {post.model} · {post.city || "Community note"}
                </DataText>
              </span>
              <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-outline group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </section>

      {/* FOOTER MICROCOPY */}
      <footer aria-hidden="true" className="flex flex-col items-center gap-1.5 pt-2 text-center">
        <div className="w-16 h-px bg-outline-variant mb-2" />
        <DataText className="text-on-surface-variant">SYS.UPTIME: 99.998%</DataText>
        <DataText className="text-outline flex items-center gap-2">
          <IndianRupee aria-hidden="true" className="w-3 h-3" />
          GRID: IN // AUTOFLEX COCKPIT
        </DataText>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rotate-45 shadow-[0_0_5px_rgba(199,198,203,0.5)]" />
          <span className="w-2 h-2 bg-surface-container-highest rotate-45" />
          <span className="w-2 h-2 bg-surface-container-highest rotate-45" />
        </div>
      </footer>
    </div>
  );
}
