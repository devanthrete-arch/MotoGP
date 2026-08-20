// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { OwnerPost } from "../../../core/entities";
import { PostCard } from "./PostCard";

afterEach(cleanup);

const basePost: OwnerPost = {
  author: "Amit from Pune",
  body: "The pedal feel changed slowly, not overnight.",
  brand: "Tata",
  city: "Pune",
  comments: [],
  createdAt: "2026-07-14T10:00:00.000Z",
  fixesConfirmed: 7,
  fuel: "Diesel",
  helpful: 31,
  id: "post-1",
  label: "Fix",
  model: "Nexon",
  odometerKm: 42000,
  title: "Clutch fix that worked",
  topic: "Repairs",
  variant: "XZ+",
};

/**
 * Counts renders precisely: the component body reads `title`, so a getter on it
 * increments only when the body actually runs. A memo bail-out leaves it flat.
 */
const countingPost = (overrides: Partial<OwnerPost> = {}) => {
  const state = { renders: 0 };
  const post = {
    ...basePost,
    ...overrides,
    get title() {
      state.renders += 1;
      return overrides.title ?? basePost.title;
    },
  } as OwnerPost;
  return { post, state };
};

const noop = () => undefined;
const handlers = {
  onHelpful: noop,
  onOpenDetail: noop,
  onSelect: noop,
  onToggleSave: noop,
};

describe("PostCard memoisation", () => {
  it("skips re-rendering when an unrelated keystroke re-renders the parent", () => {
    const { post, state } = countingPost();

    function Harness() {
      // Stands in for the composer/search/comment draft in the same tree.
      const [keystrokes, setKeystrokes] = useState(0);
      return (
        <div>
          <button onClick={() => setKeystrokes((value) => value + 1)} type="button">
            type
          </button>
          <span data-testid="count">{keystrokes}</span>
          <PostCard isSaved={false} isSelected={false} post={post} {...handlers} />
        </div>
      );
    }

    const { getByTestId, getByText } = render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    const afterMount = state.renders;
    expect(afterMount).toBeGreaterThan(0);

    fireEvent.click(getByText("type"));
    fireEvent.click(getByText("type"));
    fireEvent.click(getByText("type"));

    // The parent really did re-render three times...
    expect(getByTestId("count").textContent).toBe("3");
    // ...and the card body never ran again.
    expect(state.renders).toBe(afterMount);
  });

  it("still re-renders when its own post data changes", () => {
    const first = countingPost();
    const { rerender } = render(
      <MemoryRouter>
        <PostCard isSaved={false} isSelected={false} post={first.post} {...handlers} />
      </MemoryRouter>,
    );
    const afterMount = first.state.renders;

    const second = countingPost({ title: "Updated title" });
    rerender(
      <MemoryRouter>
        <PostCard isSaved={false} isSelected={false} post={second.post} {...handlers} />
      </MemoryRouter>,
    );

    expect(second.state.renders).toBeGreaterThan(0);
    expect(first.state.renders).toBe(afterMount);
  });

  it("re-renders when the saved or selected flag flips", () => {
    const { post, state } = countingPost();
    const { rerender } = render(
      <MemoryRouter>
        <PostCard isSaved={false} isSelected={false} post={post} {...handlers} />
      </MemoryRouter>,
    );
    const afterMount = state.renders;

    rerender(
      <MemoryRouter>
        <PostCard isSaved isSelected={false} post={post} {...handlers} />
      </MemoryRouter>,
    );
    expect(state.renders).toBeGreaterThan(afterMount);
  });

  it("keeps fuel out of the title line and shows it as its own field", () => {
    const { container } = render(
      <MemoryRouter>
        <PostCard isSaved={false} isSelected={false} post={basePost} {...handlers} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Tata Nexon • XZ+");
    expect(text).toContain("Fuel: Diesel");
  });
});
