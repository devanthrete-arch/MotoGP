// The frame around every view: header, status surfaces, footer and the phone tab bar.
import { Menu, UserRound, X } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { destinations } from "./model";
import { useOtofolks } from "./state";

/** Brand, desktop navigation and the theme switch. */
export function AppHeader() {
  const { auth, navMenuOpen, setNavMenuOpen, activeView, handleFeatureNav } = useOtofolks();
  return (
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

/** Says where what is on screen is stored. */
export function DataNotice() {
  const { auth, activeView } = useOtofolks();
  return (
    <>
      {activeView !== "top" && activeView !== "account" && activeView !== "pit-stop" ? (
        <p className="data-notice" role="note">{activeView === "feed" || activeView === "write"
          ? "Shared notes are visible to signed-in members. Local examples stay on this device."
          : auth.cloudClient ? "Changes stay on this device until you save them in Account."
            : "Saved on this device for your account."}</p>
      ) : null}
    </>
  );
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
  const { auth, activeView, handleFeatureNav } = useOtofolks();
  return (
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
  );
}
