import type { ComponentType } from "react";
import {
  BarChart3,
  CarFront,
  CircleUserRound,
  FolderLock,
  Gauge,
  House,
  ListChecks,
  MessageCircle,
  Plus,
  ScanSearch,
  Search,
  UsersRound,
} from "lucide-react";
import { workspacePaths, type WorkspaceScreen } from "../routing";
import { useApp } from "../appState";
import { LabelCaps } from "./ui";

type NavScreen = Exclude<WorkspaceScreen, "account">;

type NavItem = {
  screen: NavScreen;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  count?: number;
};

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

function useNavItems(): { primary: NavItem[]; modules: NavItem[] } {
  const app = useApp();
  return {
    primary: [
      { screen: "home", label: "Today", icon: House },
      { screen: "community", label: "Community", icon: MessageCircle },
      { screen: "garage", label: "Garage", icon: CarFront, count: app.garage.length },
      { screen: "shortlist", label: "Compare", icon: ListChecks, count: app.shortlist.length },
    ],
    modules: [
      { screen: "kyv", label: "KYV", icon: ScanSearch },
      { screen: "vault", label: "Vault", icon: FolderLock },
      { screen: "analytics", label: "Analytics", icon: BarChart3 },
      { screen: "creators", label: "Creators", icon: UsersRound },
    ],
  };
}

function navigateTo(app: ReturnType<typeof useApp>, item: NavItem) {
  if (item.screen === "community") app.openWorkspace("community", "community", "latest");
  else app.openWorkspace(item.screen);
}

export function Sidebar() {
  const app = useApp();
  const { primary, modules } = useNavItems();

  const renderItem = (item: NavItem) => {
    const isActive = app.activeNav === item.screen;
    const Icon = item.icon;
    return (
      <a
        key={item.screen}
        href={workspacePaths[item.screen]}
        aria-current={isActive ? "page" : undefined}
        onClick={(event) => {
          event.preventDefault();
          navigateTo(app, item);
        }}
        className={cx(
          "flex items-center gap-3 px-3 py-2.5 rounded border-l-2 transition-colors",
          "font-mono text-[10px] font-bold tracking-[0.2em] uppercase",
          isActive
            ? "bg-primary-container text-primary border-primary"
            : "text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container-low",
        )}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        {item.count ? <span className="font-mono text-[10px] text-outline tracking-[0.1em]">{String(item.count).padStart(2, "0")}</span> : null}
      </a>
    );
  };

  return (
    <aside
      aria-label="Autoflex navigation"
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-surface-container-lowest border-r border-outline-variant"
    >
      <a
        className="flex items-center gap-2.5 px-4 h-16 border-b border-outline-variant text-on-surface no-underline"
        href="/"
        aria-label="Autoflex Today"
        onClick={(event) => {
          event.preventDefault();
          app.openWorkspace("home", "home");
        }}
      >
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-sm bg-primary text-on-primary flex items-center justify-center font-display font-bold text-sm shadow-[0_0_12px_rgba(199,198,203,0.35)]"
        >
          A
        </span>
        <span className="font-display font-semibold tracking-tight text-lg uppercase">
          Auto<strong className="text-primary">flex</strong>
        </span>
      </a>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <LabelCaps className="text-outline px-3 mb-2">Cockpit</LabelCaps>
          <nav aria-label="Primary destinations" className="flex flex-col gap-1">
            {primary.map(renderItem)}
          </nav>
        </div>
        <div className="flex flex-col gap-1">
          <LabelCaps className="text-outline px-3 mb-2">Modules</LabelCaps>
          <nav aria-label="Secondary destinations" className="flex flex-col gap-1">
            {modules.map(renderItem)}
          </nav>
        </div>
      </div>

      <div className="px-4 py-4 border-t border-outline-variant flex items-center gap-3">
        <span className={cx("status-dot", app.connectionStatus.tone)} aria-hidden="true" />
        <div className="flex flex-col">
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface">{app.connectionStatus.label}</span>
          <small className="font-mono text-[10px] text-outline tracking-[0.05em]">Records stay available offline.</small>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  const app = useApp();
  const copy = app.workspaceCopy[app.activeScreen];

  return (
    <header className="sticky top-0 z-30 glass border-b border-outline-variant">
      <nav aria-label="Page and account navigation" className="h-16 px-4 lg:px-6 flex items-center gap-4">
        <a
          className="lg:hidden flex items-center gap-2 text-on-surface no-underline"
          href="/"
          aria-label="Autoflex Today"
          onClick={(event) => {
            event.preventDefault();
            app.openWorkspace("home", "home");
          }}
        >
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-sm bg-primary text-on-primary flex items-center justify-center font-display font-bold text-sm"
          >
            A
          </span>
          <span className="font-display font-semibold tracking-tight uppercase">
            Auto<strong className="text-primary">flex</strong>
          </span>
        </a>

        <div className="hidden sm:flex flex-col justify-center min-w-0" aria-label="Current screen">
          <LabelCaps className="text-primary">{copy.eyebrow}</LabelCaps>
          <strong className="font-display text-sm text-on-surface uppercase tracking-tight truncate">{copy.title}</strong>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center relative w-64">
          <Search aria-hidden="true" className="absolute left-3 w-4 h-4 text-outline pointer-events-none" />
          <input
            aria-label="Search owner notes"
            className="w-full !bg-surface-container-high !border-outline-variant !rounded !py-2 !pl-9 !pr-3 font-mono !text-xs tracking-[0.05em] text-on-surface placeholder:text-outline focus:!border-primary"
            placeholder="SEARCH NOTES…"
            type="search"
            value={app.query}
            onChange={(event) => app.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") app.openWorkspace("community", "community", "latest");
            }}
          />
        </div>

        <button
          aria-label="Open Profile"
          className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-full px-2 py-1.5 sm:px-3 text-on-surface hover:border-outline transition-colors"
          type="button"
          onClick={(event) => app.openProfile(event.currentTarget)}
        >
          <CircleUserRound className="w-5 h-5 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-[0.2em] uppercase">Profile</span>
        </button>
      </nav>
    </header>
  );
}

export function MobileDock() {
  const app = useApp();
  const { primary } = useNavItems();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-outline-variant pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex justify-around items-stretch h-16">
        {primary.map((item) => {
          const isActive = app.activeNav === item.screen;
          const Icon = item.icon;
          return (
            <a
              key={item.screen}
              href={workspacePaths[item.screen]}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(app, item);
              }}
              className={cx(
                "relative flex flex-col items-center justify-center w-1/4 gap-1 no-underline transition-colors border-t-2",
                isActive ? "text-primary border-primary" : "text-on-surface-variant border-transparent hover:text-on-surface",
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase">{item.label}</span>
              {item.count ? (
                <span className="absolute top-2 right-1/4 font-mono text-[9px] text-outline">{item.count}</span>
              ) : null}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/** Per-screen heading strip with contextual quick actions (moved from App.tsx). */
export function WorkspaceHeader() {
  const app = useApp();
  const copy = app.workspaceCopy[app.activeScreen];

  return (
    <section className="flex flex-wrap items-end justify-between gap-4 py-6" aria-label={`${copy.title} screen`}>
      <div className="min-w-0">
        {app.activeScreen === "account" ? (
          <button className="detail-back mb-3" type="button" onClick={app.returnFromAccount}>
            {app.accountBackLabel}
          </button>
        ) : null}
        <LabelCaps className="text-primary block mb-1">{copy.eyebrow}</LabelCaps>
        <h2
          className="font-display text-2xl lg:text-3xl font-semibold tracking-tight uppercase text-on-surface"
          ref={app.activeScreen === "account" ? (app.accountView === "settings" ? app.settingsHeadingRef : app.accountHeaderRef) : undefined}
          tabIndex={app.activeScreen === "account" ? -1 : undefined}
        >
          {copy.title}
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">{copy.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {app.activeScreen === "shortlist" && app.shortlist.length && !app.shortlistFormOpen ? (
          <button className="primary-action" type="button" onClick={app.openShortlistComposer}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add car
          </button>
        ) : null}
        {app.activeScreen === "garage" && app.currentVehicle && app.garageForm === null ? (
          <button className="primary-action" type="button" onClick={app.openGarageRecordComposer}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add service record
          </button>
        ) : null}
        {app.activeScreen === "community" && !app.postComposerOpen && !app.postDetailOpen ? (
          <button className="primary-action" type="button" onClick={app.openPostComposer}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Write a note
          </button>
        ) : null}
        {app.activeScreen === "home" && !app.isFirstRun ? (
          <span className="hidden md:inline-flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-outline">
            <Gauge className="w-4 h-4" aria-hidden="true" />
            SYS.RDY
          </span>
        ) : null}
      </div>
    </section>
  );
}
