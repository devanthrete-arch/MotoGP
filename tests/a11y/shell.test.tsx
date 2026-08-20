// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Local-first means the shell renders with no network at all. Stubbing the
// Supabase client keeps this suite hermetic and offline, which is also the
// state the app must be correct in.
vi.mock("../../src/infrastructure/supabase/client", () => ({
  getSupabaseClient: () => null,
  isCloudSyncConfigured: false,
}));
import { AppStateProvider } from "../../src/app/state/appState";
import { MobileDock, Sidebar, Topbar } from "../../src/app/shell/Shell";
import { CommunityFeed } from "../../src/app/screens/CommunityFeed";
import { Home } from "../../src/app/screens/Home";
import { LiveRegion } from "../../src/ui";

/**
 * Accessibility contract for the app shell and the screens that use the design
 * system. Everything here is queried by role and accessible name — never by
 * class — so a restyle cannot quietly break the contract and a passing test
 * cannot be satisfied by markup that only *looks* right.
 */

const garageKey = "autoflex.web.garage.v1";

const twoCarGarage = [
  {
    id: "garage-nexon",
    nickname: "Daily drive",
    brand: "Tata",
    model: "Nexon",
    variant: "XZ+",
    city: "Pune",
    odometerKm: 42000,
    purchaseMonth: "2021-08",
    fuel: "Diesel",
    transmission: "MT",
    ownership: "First owner",
  },
  {
    id: "garage-altroz",
    nickname: "Weekend car",
    brand: "Tata",
    model: "Altroz",
    variant: "XT",
    city: "Pune",
    odometerKm: 18000,
    purchaseMonth: "2023-02",
    fuel: "Petrol",
    transmission: "MT",
    ownership: "First owner",
  },
];

const renderWithApp = (ui: ReactNode, path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>{ui}</AppStateProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe("navigation landmarks", () => {
  it("gives the mobile dock a named navigation landmark", () => {
    renderWithApp(<MobileDock />, "/garage");
    expect(screen.getByRole("navigation", { name: "Primary mobile navigation" })).toBeTruthy();
  });

  it("marks the destination the owner is on with aria-current=page in the dock", () => {
    renderWithApp(<MobileDock />, "/garage");
    const dock = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    const current = within(dock)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain("Garage");
  });

  it("names both sidebar navigation groups and marks the current page once", () => {
    renderWithApp(<Sidebar />, "/community");
    expect(screen.getByRole("navigation", { name: "Primary destinations" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Secondary destinations" })).toBeTruthy();

    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain("Community");
  });

  it("moves aria-current with the route rather than pinning it to one screen", () => {
    renderWithApp(<Sidebar />, "/kyv");
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain("KYV");
  });

  it("keeps every dock destination reachable by keyboard", () => {
    renderWithApp(<MobileDock />, "/");
    const dock = screen.getByRole("navigation", { name: "Primary mobile navigation" });
    for (const link of within(dock).getAllByRole("link")) {
      link.focus();
      expect(document.activeElement).toBe(link);
    }
  });

  it("gives the icon-and-label profile control an accessible name", () => {
    renderWithApp(<Topbar />, "/");
    expect(screen.getByRole("button", { name: "Open Profile" })).toBeTruthy();
  });

  it("labels the topbar search field", () => {
    renderWithApp(<Topbar />, "/");
    expect(screen.getByRole("searchbox", { name: "Search owner notes" })).toBeTruthy();
  });
});

describe("action toast", () => {
  it("keeps the polite live region mounted while it has nothing to say", () => {
    const { rerender } = render(<LiveRegion className="action-message" message="" />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");

    rerender(<LiveRegion className="action-message" message="Saved on this device." />);
    // Same node: an already-observed region changing text announces once.
    expect(screen.getByRole("status")).toBe(region);
  });
});

describe("vehicle menu (#vehicle-menu)", () => {
  const openMenu = () => {
    window.localStorage.setItem(garageKey, JSON.stringify(twoCarGarage));
    renderWithApp(<Home />, "/");
    const trigger = screen.getByRole("button", { name: /Daily drive/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-controls")).toBe("vehicle-menu");
    fireEvent.click(trigger);
    return trigger;
  };

  it("announces itself as a collapsed listbox and expands on activation", () => {
    const trigger = openMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox", { name: "Choose a vehicle" })).toBeTruthy();
  });

  it("marks exactly one option as selected", () => {
    openMenu();
    const selected = screen.getAllByRole("option").filter((option) => option.getAttribute("aria-selected") === "true");
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toContain("Daily drive");
  });

  it("opens with ArrowDown from the trigger, not only with a pointer", () => {
    window.localStorage.setItem(garageKey, JSON.stringify(twoCarGarage));
    renderWithApp(<Home />, "/");
    const trigger = screen.getByRole("button", { name: /Daily drive/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("cycles the options with ArrowDown and wraps", () => {
    openMenu();
    const options = screen.getAllByRole("option");
    options[0].focus();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(options[0]);
  });

  it("traps Tab inside the open menu instead of stranding focus behind it", () => {
    openMenu();
    const options = screen.getAllByRole("option");
    options[options.length - 1].focus();

    fireEvent.keyDown(options[options.length - 1], { key: "Tab" });
    expect(document.activeElement).toBe(options[0]);

    fireEvent.keyDown(options[0], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(options[options.length - 1]);
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    const trigger = openMenu();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});

describe("community feed controls", () => {
  it("exposes every feed mode as a labelled toggle with a pressed state", () => {
    renderWithApp(<CommunityFeed />, "/community");
    const latest = screen.getByRole("button", { name: "Sort owner notes: Latest" });
    expect(latest.getAttribute("aria-pressed")).toBe("true");

    const trending = screen.getByRole("button", { name: "Sort owner notes: Trending" });
    expect(trending.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(trending);
    expect(screen.getByRole("button", { name: "Sort owner notes: Trending" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("names the icon-only composer shortcuts", () => {
    renderWithApp(<CommunityFeed />, "/community");
    expect(screen.getByRole("button", { name: "Write a review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share a photo note" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share a video note" })).toBeTruthy();
  });

  it("offers a recovery action from the filtered-empty state", () => {
    renderWithApp(<CommunityFeed />, "/community");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search owner notes" }), {
      target: { value: "zzzz-no-such-car" },
    });

    expect(screen.getByRole("heading", { name: "No notes match these filters" })).toBeTruthy();
    const reset = screen.getByRole("button", { name: "Show all notes" });
    fireEvent.click(reset);
    expect(screen.queryByRole("heading", { name: "No notes match these filters" })).toBeNull();
  });
});
