// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncBoundary } from "./AsyncBoundary";
import { ErrorState } from "./ErrorState";
import { LiveRegion } from "./LiveRegion";
import { EmptyState, PrimaryButton } from "./primitives";
import { Skeleton, SkeletonCard, SkeletonList, SkeletonText } from "./Skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("is decorative: hidden from assistive tech", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("animates only when motion is safe", () => {
    const { container } = render(<Skeleton />);
    const cls = container.firstElementChild?.className ?? "";
    expect(cls).toContain("motion-safe:animate-pulse");
    expect(cls).not.toMatch(/(^|\s)animate-pulse/);
  });

  it("takes explicit dimensions so it reserves the real content's box", () => {
    const { container } = render(<Skeleton height="2.5rem" width="12rem" />);
    const style = (container.firstElementChild as HTMLElement).style;
    expect(style.width).toBe("12rem");
    expect(style.height).toBe("2.5rem");
  });

  it("renders the requested number of text lines with a short last line", () => {
    const { container } = render(<SkeletonText lines={4} />);
    const lines = container.querySelectorAll('[data-skeleton="text"]');
    expect(lines.length).toBe(4);
    expect((lines[3] as HTMLElement).style.width).toBe("60%");
  });

  it("shapes the card placeholder like the real Card box", () => {
    const { container } = render(<SkeletonCard />);
    const cls = container.firstElementChild?.className ?? "";
    // Same border, radius and padding as <Card>, so swapping in the real card
    // moves nothing on the page.
    expect(cls).toContain("border-outline-variant");
    expect(cls).toContain("rounded-lg");
  });

  it("stacks the requested number of card placeholders", () => {
    const { container } = render(<SkeletonList count={5} />);
    expect(container.querySelectorAll('[data-skeleton="circle"]').length).toBe(5);
  });
});

describe("ErrorState", () => {
  it("is a polite status, never an interrupting alert", () => {
    render(<ErrorState message="We could not refresh from the server." />);
    const notice = screen.getByRole("status");
    expect(notice.getAttribute("aria-live")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(notice.textContent).toContain("We could not refresh from the server.");
  });

  it("leads with words, not colour", () => {
    render(<ErrorState message="Sync failed." />);
    expect(screen.getByText("Showing your saved copy")).toBeTruthy();
  });

  it("offers retry as an optional, named secondary action", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="Sync failed." />);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<ErrorState message="Sync failed." onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the app-level offline strip without changing its markup contract", () => {
    render(<ErrorState message="You are offline." variant="banner" />);
    const banner = screen.getByRole("status");
    expect(banner.className).toContain("offline-banner");
    expect(banner.textContent).toBe("You are offline.");
  });
});

describe("LiveRegion", () => {
  it("stays mounted while silent so the next message is actually announced", () => {
    const { rerender } = render(<LiveRegion className="action-message" message="" />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");

    rerender(<LiveRegion className="action-message" message="Saved on this device." />);
    // Same node, new text: a change an observer can hear.
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe("Saved on this device.");
  });

  it("only paints its visual styling when it has something to say", () => {
    const { rerender } = render(<LiveRegion className="action-message" message="" />);
    expect(screen.getByRole("status").className).toBe("sr-only");
    rerender(<LiveRegion className="action-message" message="Copied." />);
    expect(screen.getByRole("status").className).toBe("action-message");
  });

  it("announces the whole message at once", () => {
    render(<LiveRegion message="Your Autoflex data is in sync." />);
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
  });
});

const empty = <EmptyState body="Nothing saved yet." title="No notes" />;

describe("AsyncBoundary", () => {
  it("shows the skeleton only when loading with nothing local to show", () => {
    const { container } = render(
      <AsyncBoundary isEmpty label="Owner notes" loading skeleton={<SkeletonList count={2} />}>
        <p>notes</p>
      </AsyncBoundary>,
    );
    expect(container.querySelectorAll('[data-skeleton="circle"]').length).toBe(2);
    expect(screen.queryByText("notes")).toBeNull();
  });

  it("never blanks out local data for a background refresh", () => {
    const { container } = render(
      <AsyncBoundary isEmpty={false} label="Owner notes" loading>
        <p>a note the owner already has</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText("a note the owner already has")).toBeTruthy();
    expect(container.querySelector("[data-skeleton]")).toBeNull();
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });

  it("announces loading politely and goes quiet when settled", () => {
    const { rerender } = render(
      <AsyncBoundary isEmpty label="owner notes" loading>
        <p>notes</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole("status").textContent).toBe("Loading owner notes…");

    rerender(
      <AsyncBoundary isEmpty={false} label="owner notes">
        <p>notes</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps content on screen when a hosted read fails, with a quiet notice above it", () => {
    render(
      <AsyncBoundary error={{ message: "We could not reach the server." }} isEmpty={false}>
        <p>your saved garage</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText("your saved garage")).toBeTruthy();
    expect(screen.getByText("We could not reach the server.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("wires the error retry through", () => {
    const onRetry = vi.fn();
    render(
      <AsyncBoundary error={{ message: "Offline.", onRetry }} isEmpty={false}>
        <p>local data</p>
      </AsyncBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty slot only once the read has settled", () => {
    const { rerender } = render(
      <AsyncBoundary empty={empty} isEmpty loading skeleton={<SkeletonList count={1} />}>
        <p>notes</p>
      </AsyncBoundary>,
    );
    // Still loading: an empty state here would be a lie.
    expect(screen.queryByRole("heading", { name: "No notes" })).toBeNull();

    rerender(
      <AsyncBoundary empty={empty} isEmpty>
        <p>notes</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole("heading", { name: "No notes" })).toBeTruthy();
  });

  it("renders children when there is content and nothing in flight", () => {
    render(
      <AsyncBoundary empty={empty} isEmpty={false}>
        <p>three owner notes</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText("three owner notes")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No notes" })).toBeNull();
  });

  it("falls back to a default skeleton when the caller supplies none", () => {
    const { container } = render(
      <AsyncBoundary isEmpty loading>
        <p>notes</p>
      </AsyncBoundary>,
    );
    expect(container.querySelector("[data-skeleton]")).toBeTruthy();
  });

  it("keeps an empty state actionable", () => {
    render(
      <AsyncBoundary
        empty={<EmptyState action={<PrimaryButton>Add a car</PrimaryButton>} title="Nothing to compare yet" />}
        isEmpty
      >
        <p>rows</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole("button", { name: "Add a car" })).toBeTruthy();
  });
});
