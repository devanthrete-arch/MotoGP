import { ArrowRight, CarFront, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button } from "../../ui/Button";
import { SelectField, TextField } from "../../ui/Field";
import { rankCars, type FuelType, type LocalityTier, type RecommenderPreferences } from "../../recommender";
import { priceStates, viewPaths } from "../model";

const fuelOptions: FuelType[] = ["Petrol", "Diesel", "CNG", "Electric"];
const localityOptions: { value: LocalityTier; label: string }[] = [
  { value: "metro", label: "Metro" }, { value: "urban", label: "City or town" },
  { value: "semi-urban", label: "Small town" }, { value: "rural", label: "Rural area" },
];
const energyLabel: Record<FuelType, string> = {
  Petrol: "Petrol price (₹ per litre)", Diesel: "Diesel price (₹ per litre)",
  CNG: "CNG price (₹ per kg)", Electric: "Electricity price (₹ per unit)",
};

export function FindCarView() {
  const [fuel, setFuel] = useState<FuelType>("Petrol");
  const [result, setResult] = useState<ReturnType<typeof rankCars> | null>(null);
  const [answers, setAnswers] = useState<RecommenderPreferences>({
    state: "", localityTier: "urban", budgetRupees: 1_000_000, monthlyKm: 800,
    fuel: "Petrol", firstCar: true,
  });

  const update = <K extends keyof RecommenderPreferences>(key: K, value: RecommenderPreferences[K]) => {
    setAnswers(current => ({ ...current, [key]: value }));
    setResult(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(rankCars([], { ...answers, fuel }, new Date().toISOString().slice(0, 10)));
  };

  return (
    <section className="find-car" aria-labelledby="find-car-title">
      <header className="find-car__head">
        <p className="eyebrow"><CarFront size={16} aria-hidden="true" /> Your next car</p>
        <h1 id="find-car-title">Find a car that fits your life</h1>
        <p>Tell us what matters. We’ll only recommend a car when its price, running cost and ownership details are verified.</p>
      </header>
      <form className="find-car__form" onSubmit={submit}>
        <div className="find-car__fields">
          <TextField label="Your budget (₹)" type="number" min="1" step="any" required
            value={answers.budgetRupees} onChange={event => update("budgetRupees", Number(event.target.value))} />
          <SelectField label="State or territory" placeholder="Choose your state" required value={answers.state}
            onChange={event => update("state", event.target.value)} options={priceStates} />
          <TextField label="Driving each month (km)" type="number" min="1" step="any" required
            value={answers.monthlyKm} onChange={event => update("monthlyKm", Number(event.target.value))} />
          <SelectField label="Where you drive most" value={answers.localityTier}
            onChange={event => update("localityTier", event.target.value as LocalityTier)} options={localityOptions} />
          <SelectField label="Fuel preference" value={fuel} onChange={event => {
            const nextFuel = event.target.value as FuelType;
            setFuel(nextFuel);
            setAnswers(current => ({ ...current, fuel: nextFuel, fuelPricePerLitre: undefined, fuelPricePerKg: undefined, electricityPricePerKwh: undefined }));
            setResult(null);
          }} options={fuelOptions} />
          <TextField label={energyLabel[fuel]} type="number" min="0.01" step="0.01" required
            value={fuel === "CNG" ? answers.fuelPricePerKg ?? "" : fuel === "Electric" ? answers.electricityPricePerKwh ?? "" : answers.fuelPricePerLitre ?? ""}
            onChange={event => {
              const value = Number(event.target.value);
              update(fuel === "CNG" ? "fuelPricePerKg" : fuel === "Electric" ? "electricityPricePerKwh" : "fuelPricePerLitre", value);
            }} hint="Use the rate you pay locally; we won’t guess it." />
          <SelectField label="Is this your first car?" value={String(answers.firstCar)}
            onChange={event => update("firstCar", event.target.value === "true")}
            options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
        </div>
        <Button type="submit" variant="primary" trailingIcon={<ArrowRight size={17} aria-hidden="true" />}>Show my matches</Button>
      </form>
      {result && <section className="find-car__result" aria-live="polite" aria-labelledby="find-car-result-title">
        {result.recommendations.length ? <>
          <h2 id="find-car-result-title">Your best-fit cars</h2>
          <ol className="find-car__matches">
            {result.recommendations.map(({ candidate, score, monthlyEnergyRupees, monthlyServiceRupees, reasons }, index) => {
              const sources = [candidate.source, candidate.prices?.[answers.state], candidate.consumption,
                candidate.serviceSchedule, candidate.serviceCoverage, candidate.firstCarFit, candidate.safetyRatingOutOfFive]
                .flatMap(fact => fact ? [fact.source] : []);
              return <li className="find-car__match" key={candidate.id}>
                <article aria-label={`Rank ${index + 1}: ${candidate.brand} ${candidate.model} ${candidate.variant}`}>
                  <header><span>#{index + 1}</span><h3>{candidate.brand} {candidate.model}</h3><b>{score}% fit</b></header>
                  <p>{candidate.variant} · {candidate.fuel}</p>
                  <p className="find-car__cost">About ₹{Math.round(monthlyEnergyRupees + monthlyServiceRupees).toLocaleString("en-IN")}/month for energy and scheduled service</p>
                  <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
                  <details><summary>See official sources</summary>
                    <ul>{sources.map(source => <li key={`${source.url}:${source.label}`}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> · checked {source.checkedOn}
                    </li>)}</ul>
                  </details>
                </article>
              </li>;
            })}
          </ol>
        </> : !result.notEnoughVerifiedData.length && Object.values(result.excluded).every(items => !items.length) ? <>
          <h2 id="find-car-result-title">Recommendations aren’t ready yet</h2>
          <p>We don’t yet have complete, verified car records with prices and ownership costs for your state, so we haven’t ranked any.</p>
          <p className="find-car__honesty"><Info size={17} aria-hidden="true" /> We haven’t used example prices or guessed a winner.</p>
        </> : result.notEnoughVerifiedData.length ? <>
          <h2 id="find-car-result-title">We’re still checking the details</h2>
          <p>No car meets our evidence standard for your answers yet. We need current, variant-specific on-road prices in {answers.state}, owner running costs, service reach near you and a traceable safety source before ranking any match.</p>
          <p className="find-car__honesty"><Info size={17} aria-hidden="true" /> We haven’t used example prices or guessed a winner.</p>
        </> : <>
          <h2 id="find-car-result-title">No verified cars fit those answers</h2>
          <p>Try a different budget, fuel preference or area. We won’t show a car that doesn’t meet the details you gave us.</p>
        </>}
        <div className="find-car__actions">
          <Link className="ui-button ui-button--secondary" to={viewPaths.compare}>Compare cars</Link>
          <Link className="ui-button ui-button--ghost" to={viewPaths.guides}>Read car-buying guides</Link>
        </div>
      </section>}
    </section>
  );
}
