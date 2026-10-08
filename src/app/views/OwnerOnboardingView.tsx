import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { GarageVehicle, Profile } from "../../domain";
import { createVehicle } from "../../storage";
import { Button } from "../../ui/Button";
import { SelectField, TextField } from "../../ui/Field";
import { formatRegistrationInput, parseRegistration } from "../../ui/plate";
import {
  brands, catalogueVehicleId, firstModelForBrand, firstVariantForModel, modelsForBrand, variantsForModel, viewPaths,
} from "../model";
import { useOtofolks } from "../state";
import { loadOwnerOnboardingDraft, recallPlate, saveOwnerOnboardingDraft, type OwnerOnboardingDraft } from "../../visitor";

const freshDraft = (): OwnerOnboardingDraft => ({
  kind: "car", brand: "", model: "", generation: "", variant: "", colour: "", fuel: "", manufactureYear: "",
  registration: "", manual: false, step: "vehicle",
});

export function OwnerOnboardingView() {
  const { auth, garage, persistGarage, profile, persistProfile, setActionMessage, requireSignIn, plateDraft } = useOtofolks();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<OwnerOnboardingDraft>(() => {
    const stored = loadOwnerOnboardingDraft() ?? freshDraft();
    return { ...stored, registration: stored.registration || plateDraft || formatRegistrationInput(recallPlate() ?? "") };
  });
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [city, setCity] = useState(profile.city);
  const [error, setError] = useState("");
  const models = useMemo(() => modelsForBrand(draft.brand), [draft.brand]);
  const variants = useMemo(() => variantsForModel(draft.brand, draft.model), [draft.brand, draft.model]);

  useEffect(() => { saveOwnerOnboardingDraft(draft); }, [draft]);
  const patch = (updates: Partial<OwnerOnboardingDraft>) => setDraft(value => ({ ...value, ...updates }));
  const startCatalogue = (brand: string) => {
    const model = firstModelForBrand(brand);
    patch({ brand, model, variant: firstVariantForModel(brand, model), manual: false });
  };

  const saveVehicle = () => {
    const registration = parseRegistration(draft.registration);
    if (draft.registration.trim() && !registration.ok) { setError("Check the registration number or leave it blank."); return; }
    if (!draft.brand.trim() || !draft.model.trim()) { setError("Add a make and model to continue."); return; }
    if (draft.manufactureYear && (!/^\d{4}$/.test(draft.manufactureYear) || Number(draft.manufactureYear) < 1900
      || Number(draft.manufactureYear) > new Date().getFullYear() + 1)) {
      setError("Enter a valid manufacture year."); return;
    }
    if (!auth.isSignedIn) {
      patch({ step: "profile" });
      saveOwnerOnboardingDraft({ ...draft, step: "profile" });
      requireSignIn(viewPaths["owner-onboarding"], "sign-up");
      return;
    }
    const savedProfile: Profile = { ...profile, displayName: displayName.trim(), city: city.trim(), garageRole: "Owner" };
    const vehicle: GarageVehicle = createVehicle({
      nickname: `${draft.brand.trim()} ${draft.model.trim()}`,
      brand: draft.brand.trim(), model: draft.model.trim(), variant: draft.variant.trim(), city: city.trim(),
      odometerKm: 0, purchaseMonth: "", kind: draft.kind,
      catalogueId: draft.manual ? undefined : catalogueVehicleId(draft.brand, draft.model),
      generation: draft.generation.trim() || undefined, generationId: undefined,
      registration: registration.ok ? registration.normalized : undefined,
      colour: draft.colour.trim() || undefined, fuel: draft.fuel.trim() || undefined,
      manufactureYear: draft.manufactureYear ? Number(draft.manufactureYear) : undefined,
      source: draft.manual ? "manual" : "catalogue",
    });
    persistProfile(savedProfile);
    persistGarage([vehicle, ...garage]);
    saveOwnerOnboardingDraft(null);
    setActionMessage("Vehicle added to your garage on this device.");
    navigate(viewPaths.garage);
  };

  return (
    <section className="owner-onboarding" aria-labelledby="owner-onboarding-title">
      <header className="owner-onboarding__head">
        <p className="eyebrow">My garage · {draft.step === "vehicle" ? "1 of 2" : "2 of 2"}</p>
        <h1 id="owner-onboarding-title">{draft.step === "vehicle" ? "Add your vehicle" : "Make it yours"}</h1>
        <p>{draft.step === "vehicle" ? "Choose a car from the list, or add any vehicle yourself." : "Your vehicle is ready. Add your name and city before saving."}</p>
      </header>

      {draft.step === "vehicle" ? <form className="owner-onboarding__form" onSubmit={event => { event.preventDefault(); setError(""); saveVehicle(); }}>
        <div className="owner-onboarding__segmented" role="group" aria-label="Vehicle type">
          {(["car", "two-wheeler"] as const).map(kind => <Button key={kind} type="button" variant={draft.kind === kind ? "primary" : "secondary"}
            aria-pressed={draft.kind === kind} onClick={() => patch({ kind, brand: "", model: "", variant: "", manual: kind === "two-wheeler" })}>
            {kind === "car" ? "Car" : "Two-wheeler"}
          </Button>)}
        </div>
        {draft.kind === "car" && !draft.manual ? <>
          <SelectField label="Make" options={brands} placeholder="Choose a make" value={draft.brand}
            onChange={event => startCatalogue(event.target.value)} />
          <SelectField label="Model" options={models.map(item => item.model)} placeholder="Choose a model" value={draft.model}
            onChange={event => patch({ model: event.target.value, variant: firstVariantForModel(draft.brand, event.target.value) })} />
          <SelectField label="Variant" options={variants.map(item => item.name)} placeholder="Choose a variant" value={draft.variant}
            onChange={event => patch({ variant: event.target.value })} />
          <p className="owner-onboarding__note">This list is a starting catalogue. Confirm the exact generation and variant from your documents.</p>
          <Button type="button" variant="ghost" onClick={() => patch({ manual: true, brand: "", model: "", variant: "" })}>My vehicle is not listed</Button>
        </> : <>
          {draft.kind === "two-wheeler" && <p className="owner-onboarding__note">Two-wheeler catalogue is coming later. Add the make and model as shown on your documents.</p>}
          <TextField label="Make" required maxLength={80} value={draft.brand} onChange={event => patch({ brand: event.target.value })} placeholder="e.g. Honda" />
          <TextField label="Model" required maxLength={100} value={draft.model} onChange={event => patch({ model: event.target.value })} placeholder="e.g. Activa 6G" />
          {draft.kind === "car" && <Button type="button" variant="ghost" onClick={() => { patch({ manual: false, brand: "", model: "", variant: "" }); }}>Back to car catalogue</Button>}
        </>}
        <div className="owner-onboarding__details">
          <TextField label="Generation (optional)" maxLength={80} value={draft.generation} onChange={event => patch({ generation: event.target.value })} placeholder="e.g. 2020–2024" />
          <TextField label="Colour (optional)" maxLength={60} value={draft.colour} onChange={event => patch({ colour: event.target.value })} placeholder="e.g. White" />
          <TextField label="Fuel (optional)" maxLength={40} value={draft.fuel} onChange={event => patch({ fuel: event.target.value })} placeholder="e.g. Petrol" />
          <TextField label="Manufacture year (optional)" inputMode="numeric" maxLength={4} value={draft.manufactureYear} onChange={event => patch({ manufactureYear: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="e.g. 2022" />
        </div>
        <TextField label="Registration number (optional)" maxLength={14} value={draft.registration}
          onChange={event => patch({ registration: event.target.value.toUpperCase() })}
          hint="Saved on this device only. It is not looked up or added to your account copy." />
        <section className="owner-onboarding__confirm" aria-label="Vehicle summary">
          <h2>Check your vehicle</h2>
          <p><strong>{draft.brand || "Make"} {draft.model || "model"}</strong>{draft.variant ? ` · ${draft.variant}` : ""}</p>
          <p>{[draft.generation, draft.manufactureYear, draft.colour, draft.fuel].filter(Boolean).join(" · ") || "You can add more details later."}</p>
          <small>{draft.manual ? "Added manually" : "Selected from the car catalogue"}</small>
        </section>
        {error && <p className="owner-onboarding__error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" fullWidth>{auth.isSignedIn ? "Save vehicle" : "Continue to sign up"}</Button>
      </form> : <form className="owner-onboarding__form" onSubmit={event => { event.preventDefault(); saveVehicle(); }}>
        <TextField label="Your name" autoComplete="name" required maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} />
        <TextField label="City" autoComplete="address-level2" required maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder="e.g. Pune" />
        {error && <p className="owner-onboarding__error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" fullWidth>Save to my garage</Button>
        <Button type="button" variant="ghost" onClick={() => patch({ step: "vehicle" })}>Back to vehicle</Button>
      </form>}
    </section>
  );
}
