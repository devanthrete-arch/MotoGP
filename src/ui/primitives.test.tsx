// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Bookmark } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge, Card, EmptyState, GhostButton, IconButton, PrimaryButton, SectionHeader, StatusChip, ToggleChip } from "./primitives";

afterEach(cleanup);

describe("button primitives", () => {
  it("exposes an accessible name from its children", () => {
    render(<PrimaryButton>Add my car</PrimaryButton>);
    expect(screen.getByRole("button", { name: "Add my car" })).toBeTruthy();
  });

  it("is operable by keyboard: focus then Enter fires the action", () => {
    const onClick = vi.fn();
    render(<GhostButton onClick={onClick}>Export garage</GhostButton>);
    const button = screen.getByRole("button", { name: "Export garage" });

    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("carries a :focus-visible ring rather than a :focus one", () => {
    render(<PrimaryButton>Publish note</PrimaryButton>);
    const cls = screen.getByRole("button", { name: "Publish note" }).className;
    expect(cls).toContain("focus-visible:ring-2");
    expect(cls).not.toMatch(/(^|\s)focus:ring/);
  });

  it("clears the 44px touch floor", () => {
    render(<GhostButton>Show all notes</GhostButton>);
    expect(screen.getByRole("button", { name: "Show all notes" }).className).toContain("min-h-[44px]");
  });

  it("defaults to type=button but lets a form override it", () => {
    const { rerender } = render(<PrimaryButton>Save</PrimaryButton>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
    rerender(<PrimaryButton type="submit">Save</PrimaryButton>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("submit");
  });

  it("forwards a ref so a parent can take focus control", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<GhostButton ref={ref}>Cancel</GhostButton>);
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("merges a caller className without dropping its own", () => {
    render(<GhostButton className="border-error/40">Remove post</GhostButton>);
    const cls = screen.getByRole("button", { name: "Remove post" }).className;
    expect(cls).toContain("border-error/40");
    expect(cls).toContain("min-h-[44px]");
  });

  it("renders the danger tone as a filled button, still named by its text", () => {
    render(<PrimaryButton tone="danger">Delete everything</PrimaryButton>);
    const button = screen.getByRole("button", { name: "Delete everything" });
    expect(button.className).toContain("bg-error-container");
  });

  it("passes disabled through and stops the click", () => {
    const onClick = vi.fn();
    render(<PrimaryButton disabled onClick={onClick}>Sync now</PrimaryButton>);
    const button = screen.getByRole("button", { name: "Sync now" });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("IconButton", () => {
  it("cannot ship without an accessible name", () => {
    render(<IconButton icon={Bookmark} label="Save note" />);
    expect(screen.getByRole("button", { name: "Save note" })).toBeTruthy();
  });

  it("hides its icon from assistive tech and keeps a 44px box", () => {
    const { container } = render(<IconButton icon={Bookmark} label="Save note" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Save note" }).className).toContain("h-11");
  });
});

describe("ToggleChip", () => {
  it("reports its pressed state through aria-pressed", () => {
    const { rerender } = render(<ToggleChip pressed={false}>Saved</ToggleChip>);
    expect(screen.getByRole("button", { name: "Saved", pressed: false })).toBeTruthy();
    rerender(<ToggleChip pressed>Saved</ToggleChip>);
    expect(screen.getByRole("button", { name: "Saved", pressed: true })).toBeTruthy();
  });
});

describe("StatusChip", () => {
  it("always spells the state out, so colour is never the only signal", () => {
    const { container } = render(<StatusChip error>Sync failed</StatusChip>);
    expect(screen.getByText("Sync failed")).toBeTruthy();
    // The coloured dot is decoration and is hidden from the accessibility tree.
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.textContent).toBe("Sync failed");
  });

  it("reads identically when off, differing only in the hidden dot", () => {
    const { container } = render(<StatusChip on={false}>No vehicle paired</StatusChip>);
    expect(container.textContent).toBe("No vehicle paired");
  });
});

describe("EmptyState", () => {
  it("renders the full anatomy: icon, title, body and both actions", () => {
    render(
      <EmptyState
        action={<PrimaryButton>Add my car</PrimaryButton>}
        body="Track service, costs and ownership notes."
        icon={Bookmark}
        secondaryAction={<GhostButton>Learn more</GhostButton>}
        title="Your garage is empty"
      />,
    );

    expect(screen.getByRole("heading", { name: "Your garage is empty", level: 3 })).toBeTruthy();
    expect(screen.getByText("Track service, costs and ownership notes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add my car" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Learn more" })).toBeTruthy();
  });

  it("lets the heading level follow the document outline", () => {
    render(<EmptyState title="No reports yet" titleAs="h2" />);
    expect(screen.getByRole("heading", { name: "No reports yet", level: 2 })).toBeTruthy();
  });

  it("still accepts bespoke children next to the fixed slots", () => {
    render(
      <EmptyState body="Nothing here." title="Empty">
        <p>Extra detail.</p>
      </EmptyState>,
    );
    expect(screen.getByText("Nothing here.")).toBeTruthy();
    expect(screen.getByText("Extra detail.")).toBeTruthy();
  });

  it("passes an id through for anchor targets", () => {
    const { container } = render(<EmptyState id="feed-empty" title="Empty" />);
    expect(container.querySelector("#feed-empty")).toBeTruthy();
  });
});

describe("Card and SectionHeader", () => {
  it("keeps arbitrary DOM props such as id and aria-label", () => {
    const { container } = render(<Card aria-label="Cost ledger" id="ledger">body</Card>);
    expect(container.querySelector("#ledger")?.getAttribute("aria-label")).toBe("Cost ledger");
  });

  it("defaults the section heading to h2 and can drop a level", () => {
    const { rerender } = render(<SectionHeader title="Active fleet" />);
    expect(screen.getByRole("heading", { name: "Active fleet", level: 2 })).toBeTruthy();
    rerender(<SectionHeader title="Active fleet" titleAs="h3" />);
    expect(screen.getByRole("heading", { name: "Active fleet", level: 3 })).toBeTruthy();
  });

  it("renders a badge as inert text", () => {
    render(<Badge tone="error">Admin</Badge>);
    expect(screen.getByText("Admin")).toBeTruthy();
  });
});
