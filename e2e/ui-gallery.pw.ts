import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Drives the development gallery of src/ui (ui.html), where every primitive is on one page.
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
});
test.afterEach(() => { expect(pageErrors).toEqual([]); });

async function openGallery(page: Page) {
  await page.goto("/ui.html");
  await expect(page.getByRole("heading", { name: "UI primitives", level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const violations = async (page: Page, include?: string) => {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  const results = await (include ? builder.include(include) : builder).analyze();
  return results.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(" ")).join(", ")}`);
};

// axe cannot judge text over gradients or tints, so the pairs it skips are measured here: the
// element's text colour against each solid colour it can sit on. Pass none to use the element's
// own (opaque) background.
const contrastRatios = (element: Locator, grounds: string[] = []) => element.evaluate((node, colours) => {
  const probe = document.createElement("span");
  document.body.append(probe);
  const luminance = (colour: string) => {
    probe.style.color = colour;
    const [x, y, z] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      .map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * x + 0.7152 * y + 0.0722 * z;
  };
  const style = getComputedStyle(node);
  const text = luminance(style.color);
  const ratios = (colours.length ? colours : [style.backgroundColor]).map(colour => {
    const ground = luminance(colour);
    return (Math.max(text, ground) + 0.05) / (Math.min(text, ground) + 0.05);
  });
  probe.remove();
  return ratios;
}, grounds);

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`primitives pass accessibility checks and fit: ${width}px ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await openGallery(page);
      expect(await violations(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/ui-gallery-${width}-${colorScheme}.png`, fullPage: true });

      // Amber text on its chip ground: the accent chip and the pressed filter.
      for (const chip of [page.locator(".ui-chip--accent").first(), page.getByRole("button", { name: "All", pressed: true })]) {
        for (const ratio of await contrastRatios(chip)) expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
      // Everything placed on the slate band, against both ends of the band's gradient.
      const band = page.getByTestId("band");
      const bandStops = await band.evaluate(node => getComputedStyle(node).getPropertyValue("--gradient-band").match(/#[0-9a-f]{6}/gi) ?? []);
      expect(bandStops).toHaveLength(2);
      for (const element of [band.getByRole("heading"), band.locator("p"), band.getByRole("button", { name: "Not now" }),
        band.getByRole("button", { name: "How it works" })]) {
        for (const ratio of await contrastRatios(element, bandStops)) expect(ratio).toBeGreaterThanOrEqual(4.5);
      }

      await page.getByRole("button", { name: "Open dialog" }).click();
      await expect(page.getByRole("dialog", { name: "Remove this vehicle?" })).toBeVisible();
      expect(await violations(page, "dialog")).toEqual([]);
    });
  }
}

test("buttons are pills, icon buttons are circles, and a long label wraps instead of clipping", async ({ page }) => {
  await openGallery(page);
  for (const name of ["Find my car", "Just browsing", "Skip for now", "Save vehicle", "Open sheet"]) {
    const shape = await page.getByRole("button", { name, exact: true }).evaluate(element => ({
      radius: parseFloat(getComputedStyle(element).borderTopLeftRadius), height: element.getBoundingClientRect().height,
    }));
    expect(shape.radius, name).toBeGreaterThanOrEqual(shape.height / 2);
  }
  expect((await page.getByRole("button", { name: "Save vehicle", exact: true }).boundingBox())!.height).toBe(36);
  const link = page.getByRole("link", { name: "Read owner stories" });
  expect(await link.evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThanOrEqual(22);
  const icon = await page.getByRole("button", { name: "Refresh account copy" }).evaluate(element => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, radius: getComputedStyle(element).borderTopLeftRadius };
  });
  expect(icon).toEqual({ width: 44, height: 44, radius: "50%" });

  const long = page.getByRole("button", { name: /Save this vehicle and its maintenance history/ });
  const fit = await long.evaluate(element => {
    const label = element.querySelector(".ui-button__label") as HTMLElement;
    return {
      buttonWidth: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width,
      lines: Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight)),
      clipped: label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight,
    };
  });
  expect(fit.buttonWidth).toBeLessThanOrEqual(fit.parentWidth);
  expect(fit.lines).toBeGreaterThan(1);
  expect(fit.clipped).toBe(false);
});

test("a busy button keeps focus, says it is busy and ignores further presses", async ({ page }) => {
  await openGallery(page);
  const save = page.getByRole("button", { name: "Save to account" });
  await save.focus();
  await page.keyboard.press("Enter");
  const saving = page.getByRole("button", { name: "Saving" });
  await expect(saving).toBeFocused();
  await expect(saving).toHaveAttribute("aria-busy", "true");
  await expect(saving).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(save).toBeVisible({ timeout: 4000 });
  await expect(save).toBeFocused();
  await expect(save).toHaveAttribute("data-saves", "1");
  await expect(save).not.toHaveAttribute("aria-disabled", "true");
});

test("the plate field groups what is typed, keeps the caret on a mid-string edit, and explains a wrong plate after leaving it", async ({ page }) => {
  await openGallery(page);
  const plate = page.getByRole("textbox", { name: "Registration number" });
  await plate.pressSequentially("zz12ab1234");
  // No error while first typing in the field; it appears on leaving.
  await expect(page.getByText(/state code is not one we recognise/)).toHaveCount(0);
  await plate.blur();
  await expect(page.getByText(/state code is not one we recognise/)).toBeVisible();
  await expect(plate).toHaveAttribute("aria-invalid", "true");

  await plate.fill("");
  await plate.pressSequentially("mh12ab1234");
  await expect(plate).toHaveValue("MH 12 AB 1234");
  await expect(page.getByText("Reads as MH 12 AB 1234.")).toBeVisible();
  await expect(plate).not.toHaveAttribute("aria-invalid", "true");

  // Replace the series letters in the middle: both keys must land where the caret is.
  await plate.evaluate((input: HTMLInputElement) => input.setSelectionRange(6, 8));
  await page.keyboard.type("cd");
  expect(await plate.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(8);
  await plate.blur();
  await expect(plate).toHaveValue("MH 12 CD 1234");
  await expect(page.getByText("Reads as MH 12 CD 1234.")).toBeVisible();

  // A pasted plate with punctuation is tidied; nothing is cut off.
  await plate.fill("");
  await plate.evaluate((input: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "dl-3c ab-1234");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(plate).toHaveValue("DL 3 CAB 1234");

  await plate.fill("");
  await plate.pressSequentially("22bh1234aa");
  await expect(plate).toHaveValue("22 BH 1234 AA");
  await expect(plate).not.toHaveAttribute("aria-invalid", "true");
});

test("a select with a placeholder starts on the placeholder, and a disabled field looks disabled", async ({ page }) => {
  await openGallery(page);
  const brand = page.getByRole("combobox", { name: "Brand" });
  await expect(brand).toHaveValue("");
  await brand.selectOption("Kia");
  await expect(brand).toHaveValue("Kia");
  const colours = await page.evaluate(() => {
    const background = (label: string) => getComputedStyle(document.querySelector(`input[id="${
      [...document.querySelectorAll("label")].find(node => node.textContent === label)!.getAttribute("for")}"]`)!).backgroundColor;
    return { enabled: background("Nickname"), disabled: background("Registered owner") };
  });
  expect(colours.disabled).not.toBe(colours.enabled);
});

test("the dialog traps focus, locks the page, and every way of leaving it returns focus exactly once", async ({ page }) => {
  await openGallery(page);
  const opener = page.getByRole("button", { name: "Open dialog" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Remove this vehicle?" });
  await expect(dialog).toBeVisible();
  // A native modal dialog lets Tab pass through the browser's own controls (focus then reads as
  // <body>) before coming back round, but it must never reach the page behind the dialog.
  const focus = () => page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return "browser";
    return active.closest("dialog") ? "dialog" : "page";
  });
  expect(await focus()).toBe("dialog");
  const visited: string[] = [];
  for (let presses = 0; presses < 10; presses += 1) {
    await page.keyboard.press("Tab");
    visited.push(await focus());
  }
  expect(visited).not.toContain("page");
  expect(visited.filter(place => place === "dialog").length).toBeGreaterThanOrEqual(6);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");

  await opener.click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // A click outside closes it; a drag that starts inside and ends outside does not.
  await opener.click();
  await expect(dialog).toBeVisible();
  const text = (await dialog.locator("p").boundingBox())!;
  await page.mouse.move(text.x + 20, text.y + 10);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();

  await opener.click();
  await dialog.getByRole("button", { name: "Remove vehicle" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".ui-toast")).toHaveText("Vehicle removed.");
  await expect(page.locator(".ui-toast")).toBeVisible();
});

test("the sheet sits on the bottom edge on a phone, shows toasts inside itself, and returns focus when removed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGallery(page);
  const opener = page.getByRole("button", { name: "Open sheet" });
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "Add a maintenance note" });
  const panel = page.locator("dialog[open] .ui-dialog__panel");
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(844);
  expect(Math.round(box.width)).toBe(390);

  // A message raised while the sheet stays open is inside it: visible above the backdrop and
  // reachable by assistive technology, which treats everything outside a modal dialog as inert.
  await sheet.getByRole("button", { name: "Save note" }).click();
  const toast = page.locator("dialog[open] .ui-toast");
  await expect(toast).toHaveText("Could not save. Check your connection and try again.");
  await expect(sheet.getByRole("status")).toContainText("Could not save.");
  const toastBox = (await toast.boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(box.y);
  await expect(sheet).toBeVisible();

  // This sheet is rendered only while shown, so closing it unmounts it.
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
});

test("a toast is announced in a persistent live region and clears itself", async ({ page }) => {
  await openGallery(page);
  const region = page.locator(".ui-toast-region");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toBeEmpty();
  await page.getByRole("button", { name: "Show toast" }).click();
  await expect(region).toHaveText("Vehicle saved on this device.");
  await expect(region).toBeEmpty({ timeout: 8000 });
});

test("two theme switches on one page always agree", async ({ page }) => {
  await openGallery(page);
  // The gallery has one switch in its header and one beside the overlay buttons.
  await expect(page.getByRole("button", { name: /^Theme: System/ })).toHaveCount(2);
  await page.getByRole("button", { name: /^Theme: System/ }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: /^Theme: Light/ })).toHaveCount(2);
  await page.getByRole("button", { name: /^Theme: Light/ }).last().click();
  await expect(page.getByRole("button", { name: /^Theme: Dark/ })).toHaveCount(2);
  await page.getByRole("button", { name: /^Theme: Dark/ }).first().click();
  await expect(page.getByRole("button", { name: /^Theme: System/ })).toHaveCount(2);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});
