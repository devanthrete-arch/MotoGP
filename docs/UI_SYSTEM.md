# AutoFlex UI system

`src/ui/` is the design-system layer: the primitives every screen and every
feature renders with. This document is the contract for that folder — what is
in it, how its props are shaped and why, what accessibility it guarantees, and
what you have to do to add to it.

It assumes `docs/ARCHITECTURE.md`. The single structural rule that matters here:
**`ui/` may import `core/` and `ui/`, and nothing else.** No feature, no screen,
no app state. `tests/architecture/layers.test.ts` fails the build if that slips.

---

## 1. Component architecture

```
src/ui/
  cn.ts               cn(), focusRing, touchTarget — the shared class contract
  primitives.tsx      typography, surfaces, buttons, chips, EmptyState, FactPair
  Skeleton.tsx        Skeleton, SkeletonText, SkeletonCard, SkeletonList
  ErrorState.tsx      the quiet hosted-failure notice
  LiveRegion.tsx      the always-mounted polite announcer
  AsyncBoundary.tsx   loading / error / empty / content, in one place
  useFocusTrap.ts     Tab containment for overlays
  VehicleFactGrid.tsx renders core catalog facts (the one domain-aware primitive)
  ErrorBoundary.tsx   last-resort recovery screen
  Hero3D.tsx          the Three.js hero
  index.ts            the barrel new code imports from
```

Three tiers, and the tier decides what a component may know:

| Tier | Examples | Knows about |
| --- | --- | --- |
| **Style atoms** | `LabelCaps`, `DataText`, `EdgeGlow`, `Badge` | Nothing. Pure presentation. |
| **Controls & surfaces** | `PrimaryButton`, `GhostButton`, `IconButton`, `ToggleChip`, `Card`, `SectionHeader`, `EmptyState` | Interaction and accessibility semantics. No data. |
| **State compositions** | `Skeleton*`, `ErrorState`, `LiveRegion`, `AsyncBoundary` | The *shape* of asynchrony in this app. Still no data. |

`VehicleFactGrid` is the deliberate exception: it takes a `GarageVehicle` from
`core/` because rendering the four vehicle facts consistently is a
design-system job and `core` is inside `ui`'s allowed set.

### Why the state compositions look the way they do

AutoFlex is local-first. Every screen paints from `localStorage` before a
network call is made, and `infrastructure/hosted` returns a `HostedResult` whose
**failure arm still carries `data`**. That single fact drives three decisions:

1. A spinner over the whole screen is always wrong. There is local data.
2. A blocking error page is always wrong. The failure arm has usable data.
3. The only correct "nothing yet" is a genuine empty *and settled* read.

`AsyncBoundary` encodes exactly that, once, so no screen has to remember it.

---

## 2. Props and API conventions

Every primitive in `src/ui` follows these. A new one that does not is a bug.

**1. Props extend the underlying element.**

```tsx
export function Card({ className, children, ...rest }: ComponentPropsWithRef<"div">)
```

`id`, `aria-*`, `data-*`, `title`, `onClick` and `ref` pass through without the
primitive listing them. This is why `<Card id="shortlist-form">` and
`<GhostButton aria-pressed={isFollowing}>` just work.

**2. `className` is merged with `cn()`, never concatenated.**

```tsx
className={cn("base classes", condition && "extra", className)}
```

Hand-built class strings fail two ways that review does not catch: a falsy
conditional printing `undefined` into the attribute, and a missing space welding
two classes into one that matches nothing. `cn()` removes both by construction.
It flattens arrays and object maps, drops falsy values, normalises whitespace and
collapses duplicate tokens. It does **not** resolve Tailwind conflicts — a real
`p-2 p-4` collision is a design bug to fix at the call site, not to paper over.

**3. `ref` is a plain prop.** React 19; no `forwardRef` wrapper. The app has real
focus-management needs (`profileNameRef`, `clearDataCancelRef`,
`vehicleTriggerRef`, `settingsHeadingRef`), so any primitive a parent might need
to focus accepts a ref through `ComponentPropsWithRef`.

**4. Polymorphism only where it earns its keep.** There is no general `as` prop.
The two places it exists are heading levels — `EmptyState titleAs` and
`SectionHeader titleAs` — because the same visual block appears at different
depths and the heading outline has to follow the *document*, not the design.
Everything else is a fixed element.

**5. Variants are named by meaning, not by appearance.** `tone="danger"`, not
`tone="red"`. `variant="banner"`, not `variant="wide"`.

**6. Required props enforce the contract the type system can enforce.**
`IconButton` requires `label`. `StatusChip` requires `children`. `ErrorState`
requires `message`. Each of those is an accessibility rule expressed as a type
error rather than a review comment.

**7. Slots over children for structured components.** `EmptyState` takes
`icon` / `title` / `body` / `action` / `secondaryAction` so every empty state in
the app has the same anatomy and reading order. `children` remains as an escape
hatch and renders after `body`.

---

## 3. The primitives

### `cn(...values)` / `focusRing` / `touchTarget`

```tsx
import { cn, focusRing, touchTarget } from "../../ui";

cn("rounded p-2", isActive && "border-primary", className);
cn(["a", ["b"]], { c: true, d: false });   // "a b c"
```

`focusRing` is the shared `:focus-visible` treatment; `touchTarget` is
`min-h-[44px]`. Both are constants so the rule has one definition.

### Typography and surfaces

```tsx
<LabelCaps className="text-primary">Reminders</LabelCaps>
<DataText size="lg">42,000 km</DataText>
<Card id="shortlist-form">…</Card>
<SectionHeader eyebrow="My cars" title="Active fleet" titleAs="h3" detail="…" actions={<GhostButton>Export</GhostButton>} />
<Badge tone="error">Open</Badge>
<FactPair label="Fuel" muted value="Not recorded" />
```

### Buttons

```tsx
<PrimaryButton onClick={openComposer}>Add my car</PrimaryButton>
<PrimaryButton type="submit">Publish note</PrimaryButton>
<PrimaryButton tone="danger" onClick={clearAllData}>Clear all data</PrimaryButton>

<GhostButton ref={clearDataCancelRef} onClick={cancel}>Cancel</GhostButton>
<GhostButton aria-pressed={isFollowing}>Following</GhostButton>

<IconButton icon={Camera} label="Share a photo note" onClick={openComposer} />
<ToggleChip pressed={mode === "saved"} onClick={() => setMode("saved")}>Saved</ToggleChip>
```

`type="button"` is applied before the prop spread, so a form can still pass
`type="submit"`.

### `StatusChip`

```tsx
<StatusChip>SYS.RDY</StatusChip>
<StatusChip on={false}>No vehicle paired</StatusChip>
<StatusChip error>Sync failed</StatusChip>
```

The coloured dot is `aria-hidden` decoration. The state is always spelled out in
the children, which is why `children` is required.

### `EmptyState`

```tsx
<EmptyState
  icon={CarFront}
  title="Your garage is empty"
  body="Track service, costs, and ownership notes for every car you own — in one place, on this device."
  action={<PrimaryButton onClick={openVehicleComposer}>Add my car</PrimaryButton>}
/>
```

An empty list is a product moment, not a blank. Say what would be here, why it
is worth having, and offer the one action that fills it.

### `Skeleton` family

```tsx
<Skeleton width="12rem" height="2.5rem" />
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonList count={3} />
```

Skeletons take **explicit dimensions** — a placeholder that does not reserve the
real box trades a blank for a jump, which is worse. The shimmer is
`motion-safe:animate-pulse`, so under `prefers-reduced-motion: reduce` the shape
still holds the layout and simply stops moving. Skeletons are `aria-hidden`;
announcing is `AsyncBoundary`'s job.

### `ErrorState`

```tsx
<ErrorState
  message="We could not refresh from the server. These are your saved records."
  onRetry={retry}
/>

<ErrorState variant="banner" message="You are offline. Saved records remain available on this device." />
```

`role="status"`, never `role="alert"`. Nothing is broken — the hosted failure arm
carries the local snapshot, so the screen still works and must not be
interrupted. Retry is optional and secondary: doing nothing is a valid response.

### `LiveRegion`

```tsx
<LiveRegion className="action-message" message={actionMessage} />
```

Always mounted, even while silent. A live region inserted into the document at
the same moment as its text is frequently never announced at all — assistive
tech has to be observing the node *before* it changes.

### `AsyncBoundary`

```tsx
<AsyncBoundary
  label="owner notes"
  loading={feedLoading}
  error={feedError ? { message: feedError } : null}
  isEmpty={!filteredPosts.length}
  skeleton={<SkeletonList count={3} />}
  empty={<EmptyState title="No notes match these filters" body="…" action={<GhostButton onClick={reset}>Show all notes</GhostButton>} />}
>
  <div className="flex flex-col gap-4">
    {filteredPosts.map((post) => <PostCard key={post.id} post={post} … />)}
  </div>
</AsyncBoundary>
```

| State | What renders |
| --- | --- |
| `loading` **and** `isEmpty` | `skeleton` (defaults to `<SkeletonList />`) |
| `loading` **and** not empty | `children`, wrapper marked `aria-busy` |
| `error` with content | `ErrorState` above `children` |
| `isEmpty`, settled | `empty` |
| otherwise | `children` |

**Placement rule:** put the boundary *around* a list container, never inside one
as a sibling of the items. It renders one wrapper element, which would otherwise
become a stray grid or flex child.

### `useFocusTrap(ref, active, { onEscape })`

```tsx
useFocusTrap(app.vehicleMenuRef, vehicleMenuOpen);
```

A hook rather than a `<Dialog>` component, because the app's overlays are already
positioned by the screen that owns them and their open state plus trigger ref
live in the app store. The hook adds only the missing behaviour: Tab and
Shift+Tab wrap inside the container instead of walking out of it. `onEscape` is
optional so it can layer onto an existing Escape handler without double-closing.

---

## 4. Accessibility guarantees

These hold for every primitive in `src/ui` and are asserted in
`src/ui/primitives.test.tsx`, `src/ui/states.test.tsx`,
`src/ui/useFocusTrap.test.tsx` and `tests/a11y/shell.test.tsx` — by role and
accessible name, never by class.

**Keyboard.** Every interactive primitive is a real `<button>`, focusable and
operable with Enter and Space, and none is removed from the tab order.

**Focus visibility.** One shared `focusRing`, keyed off `:focus-visible` only.
Mouse presses leave no ring; every keyboard route in is visible. The global
`:focus-visible` rule in `styles.css` covers bare markup, and the `outline: none`
reset on form controls is scoped to `:not(:focus-visible)` so a field's focus is
never signalled by border colour alone.

**Names.** `IconButton` requires `label` — the type refuses to build an unnamed
icon button. Text buttons take their name from their children.

**State.** `ToggleChip` owns the `aria-pressed` contract; `GhostButton` and
`PrimaryButton` pass `aria-pressed` through for toggles that need other styling.
Navigation marks the current destination with `aria-current="page"`.

**Landmarks.** The sidebar is an `aside` containing two named `nav`s
("Primary destinations", "Secondary destinations"); the mobile dock is a named
`nav` ("Primary mobile navigation"). Exactly one link in each carries
`aria-current="page"`.

**Live regions.** One always-mounted polite region for the action toast
(`LiveRegion`); `AsyncBoundary` owns a second for load announcements.
`ErrorState` is `role="status"` — nothing in the hosted-failure path is urgent
enough for `role="alert"`. `role="alert"` is reserved for genuinely destructive
confirmations, such as the Clear-data step in Account.

**Overlays.** `#vehicle-menu` is a `listbox` with `aria-expanded`,
`aria-haspopup`, `aria-controls` and exactly one `aria-selected` option; it opens
on ArrowDown, cycles with ArrowUp/ArrowDown/Home/End, traps Tab, closes on
Escape and restores focus to its trigger.

**Colour is never the only signal.** `StatusChip` requires text. `Badge` tones
carry a label. `FactPair` uses the `muted` tone *and* a title attribute for
unknown values. `ErrorState` leads with a heading and an icon.

**Touch.** `touchTarget` (44px) is applied by every control primitive, and the
global `input/select/textarea` rule sets the same floor for bare form markup.

### Known gap: nothing passes `loading` yet

`AsyncBoundary`'s loading arm and the whole `Skeleton` family are implemented and
tested, but no screen currently supplies a `loading` flag. The reason is
structural rather than cosmetic: the only hosted-progress state the app tracks is
`hostedSyncing` inside `appState.tsx`, and it is not returned from `useApp()`.
Surfacing it is one line, but showing a busy treatment over local records during
a background sync is a product decision, not a UI-layer one, so the boundary is
wired and the switch is left off. The one deferred-content case that *is* adopted
is the lazy `Hero3D` chunk on Home, which renders a `Skeleton` of the same 420px
box as the loaded canvas.

---

## 5. Adding a new primitive

1. **Prove it is a primitive.** If it renders a domain type it belongs in
   `features/<f>/ui/`. If it composes app state it belongs in `app/`. `ui/` may
   import `core/` and `ui/` and nothing else.
2. **Extend the element's props.** `ComponentPropsWithRef<"…">`, spread `...rest`
   last, and merge `className` through `cn()`.
3. **Take the accessibility decision in the type.** If the component needs a
   name, a pressed state or a text label to be correct, make that prop required.
4. **Apply `focusRing` and `touchTarget`** to anything interactive.
5. **Use only the existing tokens.** `surface*`, `on-surface*`, `outline*`,
   `primary*`, `error*`, the two font families and the label-caps convention.
   Introducing a colour is a design-system change, not a component change.
6. **Respect `prefers-reduced-motion`** for anything that animates — use the
   `motion-safe:` variant so the layout survives without the motion.
7. **Write a JSDoc block that says what it is for and, where the shape is not
   obvious, why it is that shape.** "What" is readable from the props; "why" is
   not, and it is the part that rots.
8. **Test by role and accessible name**, in a `// @vitest-environment happy-dom`
   file next to the component. Assert behaviour (focus moved, callback fired,
   state announced), not class strings.
9. **Export it from `src/ui/index.ts`.**

### Anti-patterns

- Building a class string with `+` or a template literal. Use `cn()`.
- A new colour, radius or font size. Use the tokens.
- `:focus` styling, or `outline: none` without a `:focus-visible` replacement.
- An icon-only control without an accessible name.
- Signalling state with colour alone.
- A full-screen error or a blocking spinner. The local snapshot is always there;
  see `AsyncBoundary`.
- Putting `AsyncBoundary` inside a grid as a sibling of the items.
