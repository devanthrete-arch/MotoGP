// The frame around every view: header, status surfaces, footer and the phone tab bar.
import { Menu, UserRound, X } from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "../ui/Surface";
import { ThemeToggle } from "../ui/ThemeToggle";
import { destinations, viewPaths } from "./model";
import { useOtofolks } from "./state";

/** Brand, desktop navigation and the theme switch. */
export function AppHeader() {
  const { auth, navMenuOpen, setNavMenuOpen, activeView, handleFeatureNav, handleAccountNav } = useOtofolks();
  return (
    <header className="app-header">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" to={viewPaths.top} onClick={handleFeatureNav}>
          <span className="logo-mark" aria-hidden="true"><span className="logo-car" /><span className="logo-wrench" /></span>
          Otofolks
        </Link>
        <button aria-controls="primary-nav-links" aria-expanded={navMenuOpen}
          aria-label={navMenuOpen ? "Close menu" : "Open menu"} className="nav-toggle"
          onClick={() => setNavMenuOpen((open) => !open)} type="button">
          {navMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={`nav-actions ${navMenuOpen ? "is-open" : ""}`} id="primary-nav-links">
          {destinations.map(({ id, label, icon: Icon }) => (
            <Link to={viewPaths[id]} key={id} onClick={handleFeatureNav} aria-current={activeView === id ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" />{label}
            </Link>
          ))}
          <Link to={viewPaths.account} onClick={handleAccountNav} aria-current={activeView === "account" ? "page" : undefined}>
            <UserRound size={20} aria-hidden="true" />{auth.isSignedIn ? "Account" : "Sign in"}
          </Link>
        </div>
        <ThemeToggle tone="header" className="theme-toggle" />
      </nav>
    </header>
  );
}

/** The transient status message. */
export function ToastRegion() {
  const { toast } = useOtofolks();
  return (
    <>
      {/* The live region stays mounted so each message is a change inside it, which is what
          screen readers announce reliably; only the visible toast remounts. */}
      <div className="action-message-region" role="status">
        {toast ? <div className="action-message" key={toast.id}>{toast.text}</div> : null}
      </div>
    </>
  );
}

/** Shown only while the device is offline. */
export function ConnectionStrip() {
  const { isOnline, connectionStatus } = useOtofolks();
  return (
    <section hidden={isOnline} className={`connection-strip ${connectionStatus.tone}`} aria-label="Connection status">
      <strong>{connectionStatus.label}</strong>
      <span>{connectionStatus.detail}</span>
    </section>
  );
}

/** Says where what is on screen is stored. Nothing is said above a sign-in prompt or a placeholder. */
export function DataNotice() {
  const { auth, activeView, audience, visitorPages } = useOtofolks();
  const memberNotice = activeView === "top" || activeView === "account" || activeView === "pit-stop" ? null
    : activeView === "feed" || activeView === "write"
      ? "Shared notes are visible to signed-in members. Local examples stay on this device."
      : auth.cloudClient ? "Changes stay on this device until you save them in Account."
        : "Saved on this device for your account.";
  // A visitor keeps data in one place only: the shortlist they build in Compare.
  const visitorNotice = activeView === "compare" ? "This shortlist lasts only as long as this tab. Sign in to keep it." : null;
  const notice = audience === "member" ? memberNotice : visitorPages ? visitorNotice : null;
  return notice ? <p className="data-notice" role="note">{notice}</p> : null;
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>Otofolks</span>
    </footer>
  );
}

/** Bottom navigation on phones. */
export function TabBar() {
  const { auth, activeView, handleFeatureNav, handleAccountNav } = useOtofolks();
  return (
    <nav className="tab-bar" aria-label="Primary">
      {destinations.map(({ id, label, icon: Icon }) => (
        <Link to={viewPaths[id]} key={id} onClick={handleFeatureNav}
          className={activeView === id ? "is-active" : undefined}
          aria-current={activeView === id ? "page" : undefined}>
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <Link to={viewPaths.account} onClick={handleAccountNav}
        className={activeView === "account" ? "is-active" : undefined}
        aria-current={activeView === "account" ? "page" : undefined}>
        <UserRound size={22} aria-hidden="true" />
        <span>{auth.isSignedIn ? "Account" : "Sign in"}</span>
      </Link>
    </nav>
  );
}

/**
 * Shown in place of a view that could not be shown: its code was not fetched (offline, or a tab
 * left open across an update) or it failed while rendering.
 */
export function ViewLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="panel view-error" role="alert">
      <h2>This page did not load</h2>
      <p>If you are offline, reconnect and try again. If it still does not load, reload Otofolks; anything typed but not yet saved will be lost.</p>
      <div className="view-error-actions">
        <button className="primary-action" type="button" onClick={onRetry}>Try again</button>
        <button className="secondary-action" type="button" onClick={() => window.location.reload()}>Reload Otofolks</button>
      </div>
    </section>
  );
}

/** Shown while a view's code is being fetched. */
export function ViewLoading() {
  return (
    <section className="panel view-loading" aria-busy="true">
      <p className="ui-visually-hidden" role="status">Loading</p>
      <Skeleton width="38%" height={30} />
      <Skeleton />
      <Skeleton width="82%" />
      <Skeleton width="64%" />
    </section>
  );
}
