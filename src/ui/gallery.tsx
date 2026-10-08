// Development-only gallery of the primitives, served at /ui.html by the dev server.
// It is what the browser tests in e2e/ui-gallery.pw.ts drive, and where to look before using one.
import { ArrowRight, RefreshCw } from "lucide-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button, Chip, Dialog, GlassCard, IconButton, LinkButton, PlateInput, SelectField, Skeleton, TextAreaField, TextField,
  ThemeToggle, ToastProvider, ToggleChip, parseRegistration, registrationProblemText, useToast,
} from "./index";
import "../styles.css";
import "./gallery.css";

const brands = ["Tata", "Maruti Suzuki", "Hyundai", "Mahindra", "Toyota", "Kia", "Honda"];
const categories = ["All", "Builds", "Launches", "Ownership"];

function PlateDemo() {
  const [plate, setPlate] = useState("");
  const [touched, setTouched] = useState(false);
  const parsed = parseRegistration(plate);
  const error = touched && !parsed.ok && parsed.problem !== "empty" ? registrationProblemText[parsed.problem] : undefined;
  return (
    <PlateInput value={plate} onChange={(value) => setPlate(value)} onBlur={() => setTouched(true)} error={error}
      hint={parsed.ok ? `Reads as ${parsed.display}.` : "Type it as it appears on the plate. Spaces are added for you."} />
  );
}

function Gallery() {
  const toast = useToast();
  const [category, setCategory] = useState("All");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saves, setSaves] = useState(0);

  return (
    <main className="ui-gallery">
      <header className="ui-gallery__head">
        <div>
          <p className="ui-gallery__eyebrow">Otofolks</p>
          <h1>UI primitives</h1>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="g-buttons">
        <h2 id="g-buttons">Buttons</h2>
        <div className="ui-gallery__row">
          <Button variant="primary" trailingIcon={<ArrowRight size={18} aria-hidden="true" />}>Find my car</Button>
          <Button>Just browsing</Button>
          <Button variant="ghost">Skip for now</Button>
          <LinkButton href="#g-fields">Read owner stories</LinkButton>
        </div>
        <div className="ui-gallery__row">
          <Button variant="primary" size="sm">Save vehicle</Button>
          <Button size="sm">Export garage</Button>
          <Button variant="primary" busy={saving} data-saves={saves}
            onClick={() => { setSaving(true); setSaves((count) => count + 1); window.setTimeout(() => setSaving(false), 1500); }}>
            {saving ? "Saving" : "Save to account"}
          </Button>
          <Button disabled>Add timeline note</Button>
          <IconButton label="Refresh account copy"><RefreshCw size={18} aria-hidden="true" /></IconButton>
        </div>
        <div className="ui-gallery__phone">
          <Button variant="primary" fullWidth>Save this vehicle and its maintenance history to my account</Button>
        </div>
      </section>

      <section aria-labelledby="g-plate">
        <h2 id="g-plate">Number plate</h2>
        <div className="ui-gallery__narrow"><PlateDemo /></div>
      </section>

      <section aria-labelledby="g-fields">
        <h2 id="g-fields">Fields</h2>
        <div className="ui-gallery__grid">
          <TextField label="Nickname" placeholder="Family car" hint="Optional. Shown on your garage card." />
          <TextField label="Model" defaultValue="" error="Enter the model, for example Nexon." />
          <SelectField label="Brand" options={brands} placeholder="Choose a brand" />
          <TextField label="Current odometer" type="number" inputMode="numeric" defaultValue={42000} />
          <TextField label="Registered owner" defaultValue="Locked after verification" disabled />
          <TextAreaField label="What happened?" placeholder="Bill details, symptoms, shop notes." />
        </div>
      </section>

      <section aria-labelledby="g-cards">
        <h2 id="g-cards">Cards and chips</h2>
        <div className="ui-gallery__grid">
          <GlassCard as="article">
            <h3>Tata Nexon</h3>
            <p>Smart Petrol MT · Pune · 42,000 km</p>
            <div className="ui-gallery__row">
              <Chip mono>1,199 cc</Chip><Chip mono>118 bhp</Chip><Chip mono>17.4 km/l</Chip><Chip tone="accent">5-star</Chip>
            </div>
          </GlassCard>
          <GlassCard tone="sunken"><h3>Example price</h3><p className="ui-gallery__mono">₹8,15,000</p></GlassCard>
          <GlassCard tone="band" data-testid="band">
            <h3>Find your next car</h3>
            <p>Six questions. Every car on sale in India.</p>
            <div className="ui-gallery__row">
              <Button variant="primary">Start</Button>
              <Button>How it works</Button>
              <Button variant="ghost">Not now</Button>
              <Chip tone="accent">New</Chip>
            </div>
          </GlassCard>
        </div>
        <div className="ui-gallery__row" role="group" aria-label="Pit Stop categories">
          {categories.map((name) => (
            <ToggleChip key={name} pressed={category === name} onClick={() => setCategory(name)}>{name}</ToggleChip>
          ))}
        </div>
      </section>

      <section aria-labelledby="g-loading">
        <h2 id="g-loading">Loading</h2>
        <GlassCard>
          <p className="ui-visually-hidden" role="status">Loading shared notes</p>
          <div className="ui-gallery__stack">
            <Skeleton width={56} height={56} shape="circle" />
            <Skeleton width="60%" height={20} />
            <Skeleton />
            <Skeleton width="80%" />
            <Skeleton width={120} height={36} shape="pill" />
          </div>
        </GlassCard>
      </section>

      <section aria-labelledby="g-overlays">
        <h2 id="g-overlays">Dialog, sheet and toast</h2>
        <div className="ui-gallery__row">
          <Button onClick={() => setConfirmOpen(true)}>Open dialog</Button>
          <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
          <Button onClick={() => toast("Vehicle saved on this device.")}>Show toast</Button>
          <ThemeToggle />
        </div>
      </section>

      {/* Always mounted, driven by the open prop. */}
      <Dialog open={confirmOpen} title="Remove this vehicle?" onClose={() => setConfirmOpen(false)}
        actions={<>
          <Button onClick={() => setConfirmOpen(false)}>Keep it</Button>
          <Button variant="primary" onClick={() => { setConfirmOpen(false); toast("Vehicle removed."); }}>Remove vehicle</Button>
        </>}>
        <p>Family car and its 12 maintenance entries will be removed from this device. Your account copy is not changed until you save.</p>
      </Dialog>

      {/* Mounted only while shown, the way a screen with data-dependent content would. */}
      {sheetOpen ? (
        <Dialog open variant="sheet" title="Add a maintenance note" onClose={() => setSheetOpen(false)}
          actions={<>
            <Button onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => toast("Could not save. Check your connection and try again.")}>Save note</Button>
          </>}>
          <TextField label="What happened?" defaultValue="Oil and filter replaced" />
        </Dialog>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode><ToastProvider><Gallery /></ToastProvider></StrictMode>,
);
