import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  it("renders a recovery state after an app error", () => {
    const boundary = new ErrorBoundary({ children: "App" });

    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error("Garage panel failed"));
    const fallback = boundary.render();

    expect(isValidElement(fallback)).toBe(true);
    if (!isValidElement<{ className?: string }>(fallback)) {
      throw new Error("Expected fallback element");
    }
    expect(fallback.props.className).toBe("app-shell");
  });
});
