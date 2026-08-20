// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

afterEach(cleanup);

function Menu({ onEscape }: { onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  useFocusTrap(ref, open, { onEscape });
  return (
    <div>
      <button type="button">outside before</button>
      <div aria-label="Choose a vehicle" ref={ref} role="listbox">
        <button role="option" type="button">Nexon</button>
        <button role="option" type="button">Altroz</button>
        <button role="option" type="button">Creta</button>
      </div>
      <button onClick={() => setOpen(false)} type="button">close</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("wraps Tab from the last option back to the first", () => {
    render(<Menu />);
    const last = screen.getByRole("option", { name: "Creta" });
    last.focus();

    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Nexon" }));
  });

  it("wraps Shift+Tab from the first option to the last", () => {
    render(<Menu />);
    const first = screen.getByRole("option", { name: "Nexon" });
    first.focus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Creta" }));
  });

  it("leaves the middle of the list to the browser's own tab order", () => {
    render(<Menu />);
    const middle = screen.getByRole("option", { name: "Altroz" });
    middle.focus();

    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
    middle.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("calls onEscape so the owner can close and restore focus", () => {
    const onEscape = vi.fn();
    render(<Menu onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByRole("option", { name: "Nexon" }), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops trapping once the overlay closes", () => {
    render(<Menu />);
    fireEvent.click(screen.getByRole("button", { name: "close" }));

    const last = screen.getByRole("option", { name: "Creta" });
    last.focus();
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
    last.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores keys that are not Tab or Escape", () => {
    render(<Menu />);
    const first = screen.getByRole("option", { name: "Nexon" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);
  });
});
