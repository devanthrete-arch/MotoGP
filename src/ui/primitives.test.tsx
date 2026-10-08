import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button, Chip, GlassCard, IconButton, LinkButton, PlateInput, SelectField, Skeleton, TextAreaField, TextField, ToggleChip,
  cx, toastDuration, useToast,
} from "./index";

const html = renderToStaticMarkup;

describe("ui primitives", () => {
  it("joins class names and drops falsy parts", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("renders a button that never submits a form by accident", () => {
    expect(html(<Button>Save</Button>)).toBe(
      '<button type="button" class="ui-button ui-button--secondary"><span class="ui-button__label">Save</span></button>');
    expect(html(<Button type="submit" variant="primary" size="sm" fullWidth>Post</Button>))
      .toContain('type="submit" class="ui-button ui-button--primary ui-button--sm ui-button--full"');
  });

  it("marks a busy button busy without disabling it, so keyboard focus stays put", () => {
    const markup = html(<Button busy icon={<i data-icon />}>Saving</Button>);
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/ disabled=""/);
    expect(html(<Button disabled>Save</Button>)).toMatch(/ disabled=""/);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("ui-button__spinner");
    expect(markup).not.toContain("data-icon");
    expect(html(<Button icon={<i data-icon />}>Save</Button>)).not.toContain("aria-busy");
  });

  it("renders navigation as a link and gives icon buttons a name", () => {
    expect(html(<LinkButton href="/read" variant="ghost">Read</LinkButton>))
      .toBe('<a href="/read" class="ui-button ui-button--ghost"><span class="ui-button__label">Read</span></a>');
    const icon = html(<IconButton label="Close"><svg /></IconButton>);
    expect(icon).toContain('aria-label="Close"');
    expect(icon).toContain('type="button"');
    expect(icon).toContain("ui-icon-button");
  });

  it("ties a label and hint to its text field", () => {
    const markup = html(<TextField id="nick" label="Nickname" hint="Optional" />);
    expect(markup).toContain('<label class="ui-field__label" for="nick">Nickname</label>');
    expect(markup).toContain('id="nick"');
    expect(markup).toContain('aria-describedby="nick-hint"');
    expect(markup).toContain('<p class="ui-field__hint" id="nick-hint">Optional</p>');
    expect(markup).not.toContain("aria-invalid");
  });

  it("shows an error instead of the hint and marks the control invalid", () => {
    const markup = html(<TextField id="model" label="Model" hint="As on the boot" error="Enter the model" />);
    expect(markup).toContain('class="ui-field ui-field--invalid"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="model-error"');
    expect(markup).toContain('<p class="ui-field__error" id="model-error" role="alert">Enter the model</p>');
    expect(markup).not.toContain("As on the boot");
  });

  it("adds its own hint or error to a caller's aria-describedby instead of replacing it", () => {
    const hinted = html(<TextField id="m" label="Model" hint="As on the boot" aria-describedby="shared-help" aria-invalid />);
    expect(hinted).toContain('aria-describedby="shared-help m-hint"');
    expect(hinted).toContain('aria-invalid="true"');
    expect(html(<TextField id="m" label="Model" aria-describedby="shared-help" />)).toContain('aria-describedby="shared-help"');
    expect(html(<PlateInput id="p" value="" onChange={() => {}} error="Wrong" aria-describedby="shared-help" />))
      .toContain('aria-describedby="shared-help p-error"');
  });

  it("accepts a ref on every control", () => {
    const input = { current: null as HTMLInputElement | null };
    const button = { current: null as HTMLButtonElement | null };
    expect(html(<><TextField label="Model" ref={input} /><Button ref={button}>Save</Button>
      <PlateInput value="" onChange={() => {}} ref={input} /><IconButton label="Close" ref={button}>x</IconButton></>))
      .toContain("ui-plate__input");
  });

  it("keeps a hidden label available to screen readers and generates ids when none is given", () => {
    const markup = html(<TextAreaField label="Notes" hideLabel />);
    expect(markup).toContain('class="ui-field__label ui-visually-hidden"');
    const id = /<textarea[^>]* id="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`for="${id}"`);
  });

  it("renders select options from strings or value/label pairs, with an unselectable placeholder", () => {
    const markup = html(<SelectField label="Brand" placeholder="Choose a brand"
      options={["Tata", { value: "ms", label: "Maruti Suzuki" }]} />);
    expect(markup).toContain('<option value="" disabled="" selected="">Choose a brand</option>');
    expect(markup).toContain('<option value="Tata">Tata</option>');
    expect(markup).toContain('<option value="ms">Maruti Suzuki</option>');
    // A caller's own starting value still wins over the placeholder.
    expect(html(<SelectField label="Brand" placeholder="Choose a brand" defaultValue="Tata" options={["Tata"]} />))
      .toContain('<option value="Tata" selected="">Tata</option>');
  });

  it("labels the plate field, hides the decorative tag and turns off text assistance", () => {
    const markup = html(<PlateInput id="plate" value="MH 12 AB 1234" onChange={() => {}} error="Check the state code" />);
    expect(markup).toContain('for="plate">Registration number</label>');
    expect(markup).toContain('<span class="ui-plate__tag" aria-hidden="true">IND</span>');
    expect(markup).toContain('value="MH 12 AB 1234"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain('spellCheck="false"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="plate-error"');
  });

  it("renders surfaces with the requested element and tone", () => {
    expect(html(<GlassCard as="article" tone="band" flush>Hi</GlassCard>))
      .toBe('<article class="ui-card ui-card--band ui-card--flush">Hi</article>');
    expect(html(<GlassCard>Hi</GlassCard>)).toBe('<div class="ui-card ui-card--glass">Hi</div>');
    expect(html(<Chip mono tone="accent">17.4 km/l</Chip>)).toBe('<span class="ui-chip ui-chip--accent ui-chip--mono">17.4 km/l</span>');
  });

  it("exposes toggle state on filter chips and hides skeletons from screen readers", () => {
    expect(html(<ToggleChip pressed>Builds</ToggleChip>)).toContain('aria-pressed="true"');
    expect(html(<ToggleChip pressed={false}>Builds</ToggleChip>)).toContain('aria-pressed="false"');
    const skeleton = html(<Skeleton width={120} height={36} shape="pill" />);
    expect(skeleton).toContain('aria-hidden="true"');
    expect(skeleton).toContain("ui-skeleton--pill");
    expect(skeleton).toContain("width:120px;height:36px");
  });

  it("keeps toasts up between four and ten seconds, longer for longer text", () => {
    expect(toastDuration("")).toBe(4000);
    expect(toastDuration("Note deleted.")).toBe(4780);
    expect(toastDuration("x".repeat(500))).toBe(10000);
    expect(toastDuration("Saved")).toBeLessThan(toastDuration("Report draft saved on this device."));
  });

  it("fails loudly when a toast is requested outside its provider", () => {
    const Lost = () => { useToast(); return null; };
    expect(() => html(<Lost />)).toThrow(/ToastProvider/);
  });
});
