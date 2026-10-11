import { useRef } from "react";
import {
  BookmarkCheck, CarFront, ChevronDown, CircleHelp, Fuel, Gauge, Plus, Ruler, Scale, Share2, Shield,
  SlidersHorizontal, Sparkles, Wrench, X,
} from "lucide-react";
import { legacyVariantSourceFor, verifiedComparisonFor } from "../../comparisonCatalog";
import { shortlistStatuses, type ShortlistItem } from "../../domain";
import { formatMoney } from "../../insights";
import {
  type PriceState, brands, defaultPriceState, firstModelForBrand, firstVariantForModel,
  modelDetailsFor, modelsForBrand, priceForModel, priceSourceFor, priceStates, variantsForModel,
} from "../model";
import { useOtofolks } from "../state";
import "./CompareView.css";

const categoryOrder = [
  "Basic Information", "Dimensions & Capacity", "Fuel & Performance", "Engine & Transmission",
  "Suspension, Steering & Brakes", "Safety", "ADAS", "Comfort & Convenience", "Interior",
  "Exterior", "Advanced Internet", "Entertainment & Communication",
];

const categoryIcon = (title: string) => {
  if (title.includes("Dimensions")) return Ruler;
  if (title.includes("Fuel")) return Fuel;
  if (title.includes("Engine") || title.includes("Suspension")) return Wrench;
  if (title.includes("Safety") || title.includes("ADAS")) return Shield;
  if (title.includes("Comfort") || title.includes("Interior")) return SlidersHorizontal;
  if (title.includes("Exterior")) return CarFront;
  if (title.includes("Entertainment") || title.includes("Internet")) return Sparkles;
  return Gauge;
};

export function CompareView() {
  const formRef = useRef<HTMLFormElement>(null);
  const {
    shortlist, shortlistDraft, setShortlistDraft, dealerQuote, setDealerQuote, shortlistComparisons,
    displayedComparisonSections, compareVerdict, inspectionChecklistByItemId, shortlistDraftPrice,
    shortlistDraftSource, addShortlistItem, updateShortlistItem,
    removeShortlistItem, openComparisonSections, setComparisonSectionOpen, persistShortlist,
    setActionMessage, shareText,
  } = useOtofolks();
  const topTwo = shortlistComparisons.slice(0, 2);
  const orderedSections = [...displayedComparisonSections].sort(
    (a, b) => categoryOrder.indexOf(a.title) - categoryOrder.indexOf(b.title),
  );

  const saveComparison = () => {
    persistShortlist(shortlist);
    setActionMessage("Comparison saved.");
  };

  const shareComparison = () => {
    const heading = topTwo.length === 2
      ? `${topTwo[0].item.brand} ${topTwo[0].item.model} vs ${topTwo[1].item.brand} ${topTwo[1].item.model}`
      : "My Otofolks car shortlist";
    const lines = shortlistComparisons.map(({ item }) =>
      `- ${item.brand} ${item.model} · ${item.variant || "Variant not selected"} · ${formatMoney(item.budget)} (${item.priceSource || "Example price"}; ${item.state || defaultPriceState})`,
    );
    const facts = orderedSections.flatMap(section => section.rows.map(([label, first, second]) =>
      `- ${section.title} / ${label}: ${first} | ${second}`,
    ));
    void shareText({ title: heading, text: [...lines, ...(facts.length ? ["", ...facts] : [])].join("\n") });
  };

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => formRef.current?.querySelector<HTMLSelectElement>("select")?.focus(), 200);
  };

  return (
    <section className="compare-page" id="compare" aria-labelledby="compare-title">
      <header className="compare-heading">
        <p className="compare-eyebrow"><Scale size={15} aria-hidden="true" /> Unbiased comparison</p>
        <h1 id="compare-title">Compare vehicles</h1>
        <p>Side-by-side details from the catalogue and verified sources. Pick what fits your life.</p>
      </header>

      <section className="compare-slots" aria-label="Vehicles in this comparison">
        {[0, 1].map(index => {
          const comparison = topTwo[index];
          const item = comparison?.item;
          const detail = item ? modelDetailsFor(item.brand, item.model) : null;
          return (
            <article className={`compare-slot${item ? " is-filled" : " is-empty"}`} key={index}>
              <div className="compare-slot__top"><span>Vehicle {index + 1}</span>
                {item ? <button className="compare-icon-button" type="button" aria-label={`Remove ${item.brand} ${item.model} from comparison`} onClick={() => removeShortlistItem(item.id)}><X size={17} /></button> : null}
              </div>
              <div className="compare-slot__visual" aria-hidden="true"><CarFront size={34} strokeWidth={1.5} /></div>
              {item ? <>
                <h2>{item.brand} {item.model}</h2>
                <p className="compare-slot__variant">{item.variant || "Variant not selected"} · {detail?.bodyType || "Body type not verified"}</p>
                <div className="compare-slot__price"><span>{item.priceSource || "Example price"}</span><strong>{formatMoney(item.budget)}</strong></div>
              </> : <>
                <h2>Add a vehicle</h2>
                <p className="compare-slot__variant">Choose a model and variant to see the available details.</p>
                <button className="compare-slot__change" type="button" onClick={focusForm}><Plus size={16} /> Choose vehicle</button>
              </>}
            </article>
          );
        })}
      </section>

      <form className="compare-builder" ref={formRef} onSubmit={addShortlistItem} aria-labelledby="compare-builder-title">
        <div className="compare-builder__heading">
          <div><p className="compare-eyebrow">Build your shortlist</p><h2 id="compare-builder-title">Add a vehicle</h2></div>
          <span>{shortlist.length} saved {shortlist.length === 1 ? "vehicle" : "vehicles"}</span>
        </div>
        <div className="compare-builder__fields">
          <label>Brand
            <select aria-label="Car brand" value={shortlistDraft.brand} onChange={event => {
              const brand = event.target.value;
              const model = firstModelForBrand(brand);
              const variant = firstVariantForModel(brand, model);
              const state = shortlistDraft.state ?? defaultPriceState;
              setShortlistDraft({ ...shortlistDraft, brand, model, variant,
                budget: priceForModel(brand, model, variant, state, shortlistDraft.status),
                priceSource: priceSourceFor(state, shortlistDraft.status) });
            }}>{brands.map(brand => <option key={brand}>{brand}</option>)}</select>
          </label>
          <label>Model
            <select aria-label="Car model" value={shortlistDraft.model} onChange={event => {
              const model = event.target.value;
              const variant = firstVariantForModel(shortlistDraft.brand, model);
              const state = shortlistDraft.state ?? defaultPriceState;
              setShortlistDraft({ ...shortlistDraft, model, variant,
                budget: priceForModel(shortlistDraft.brand, model, variant, state, shortlistDraft.status),
                priceSource: priceSourceFor(state, shortlistDraft.status) });
            }}>{modelsForBrand(shortlistDraft.brand).map(option => <option key={option.model}>{option.model}</option>)}</select>
          </label>
          <label>Variant
            <select aria-label="Variant" value={shortlistDraft.variant} onChange={event => {
              const variant = event.target.value;
              const state = shortlistDraft.state ?? defaultPriceState;
              setShortlistDraft({ ...shortlistDraft, variant,
                budget: priceForModel(shortlistDraft.brand, shortlistDraft.model, variant, state, shortlistDraft.status),
                priceSource: priceSourceFor(state, shortlistDraft.status) });
            }}>{variantsForModel(shortlistDraft.brand, shortlistDraft.model).map(option => <option key={option.name}>{option.name}</option>)}</select>
          </label>
          <label>State
            <select aria-label="State" value={shortlistDraft.state} onChange={event => {
              const state = event.target.value as PriceState;
              setShortlistDraft({ ...shortlistDraft, state,
                budget: priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, state, shortlistDraft.status),
                priceSource: priceSourceFor(state, shortlistDraft.status) });
            }}>{priceStates.map(state => <option key={state}>{state}</option>)}</select>
          </label>
        </div>
        <div className="compare-builder__details">
          <div className="compare-builder__price"><span>{dealerQuote ? "Your dealer quote" : "Example price"}</span><strong>{formatMoney(shortlistDraftPrice)}</strong><small>{shortlistDraftSource}</small></div>
          <label>Shopping stage
            <select aria-label="Car condition" value={shortlistDraft.status} onChange={event => {
              const status = event.target.value as ShortlistItem["status"];
              const state = shortlistDraft.state ?? defaultPriceState;
              setShortlistDraft({ ...shortlistDraft, status,
                budget: priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, state, status),
                priceSource: priceSourceFor(state, status) });
            }}>{shortlistStatuses.map(status => <option key={status}>{status}</option>)}</select>
          </label>
          <label>Dealer quote (optional)
            <input type="number" min="1" value={dealerQuote || ""} onChange={event => setDealerQuote(Number(event.target.value))} placeholder="Amount in INR" />
          </label>
        </div>
        {legacyVariantSourceFor(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant) ? <p className="compare-note">This variant is not listed in the manufacturer's current online range. It may still be available as old stock or used.</p> : null}
        <div className="compare-builder__actions">
          <label className="compare-builder__notes">Your note
            <input value={shortlistDraft.notes} onChange={event => setShortlistDraft({ ...shortlistDraft, notes: event.target.value })} placeholder="What matters to you about this car?" />
          </label>
          <button className="compare-primary" type="submit"><CarFront size={17} /> Add to compare</button>
        </div>
      </form>

      {topTwo.length === 2 ? <div className="compare-source-note">
        <CircleHelp size={17} aria-hidden="true" />
        <div><p>Manufacturer-verified specifications are shown where available. “Not verified” does not mean “No”. Catalogue details and example prices should be checked with a dealer.</p>
          <div className="compare-source-links">{topTwo.map(({ item }) => {
            const verified = verifiedComparisonFor(item.brand, item.model, item.variant);
            const legacy = legacyVariantSourceFor(item.brand, item.model, item.variant);
            const source = verified?.source ?? legacy;
            return <span key={item.id}><strong>{item.brand} {item.model}:</strong> {source
              ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} specifications</a>
              : "Manufacturer specs pending for this variant"}</span>;
          })}</div>
        </div>
      </div> : <p className="compare-empty-hint">Add two vehicles to unlock the detailed side-by-side comparison.</p>}

      <div className="compare-categories" role="region" aria-label="Comparison categories">
        {orderedSections.map(section => {
          const Icon = categoryIcon(section.title);
          const index = displayedComparisonSections.findIndex(candidate => candidate.title === section.title);
          return <details className="compare-category" key={section.title}
            open={openComparisonSections.includes(section.title)}
            onToggle={event => setComparisonSectionOpen(section.title, event.currentTarget.open)}>
            <summary>
              <span className="compare-category__icon"><Icon size={17} aria-hidden="true" /></span>
              <span className="compare-category__title">{section.title}</span>
              {section.rows.length && topTwo.length === 2 ? <span className="compare-category__delta" aria-hidden="true">Comparing</span> : null}
              <ChevronDown className="compare-category__chevron" size={18} aria-hidden="true" />
              <span className="ui-visually-hidden">Category {index + 1}</span>
            </summary>
            {section.rows.length && topTwo.length === 2 ? <div className="compare-table-wrap">
              <div className="compare-table" role="table" aria-label={`${section.title} comparison`}>
                <div className="compare-table__row compare-table__head" role="row">
                  <strong role="columnheader">Detail</strong>
                  <strong role="columnheader">{topTwo[0].item.model}</strong>
                  <strong role="columnheader">{topTwo[1].item.model}</strong>
                </div>
                {section.rows.map(([metric, first, second]) => <div className="compare-table__row" role="row" key={metric}>
                  <span className="compare-table__metric" role="rowheader">{metric}</span>
                  <span role="cell">{first}</span><span role="cell">{second}</span>
                </div>)}
              </div>
            </div> : <p className="compare-category__empty">{topTwo.length === 2 ? "Details for this category are not available yet." : "Add two vehicles to see these details."}</p>}
          </details>;
        })}
      </div>

      {compareVerdict ? <section className="compare-takeaway" aria-label="Comparison takeaway">
        <div><span className="compare-takeaway__icon"><Sparkles size={17} aria-hidden="true" /></span><div><h2>What stands out</h2><p>{compareVerdict.coreDifference}</p></div></div>
        <div><span className="compare-takeaway__icon"><CircleHelp size={17} aria-hidden="true" /></span><div><h3>What to check next</h3><p>{compareVerdict.reason}</p></div></div>
      </section> : null}

      {shortlistComparisons.length > 0 ? <section className="compare-more" aria-labelledby="compare-more-title">
        <h2 id="compare-more-title">Your shortlist</h2>
        <div className="compare-more__grid comparison-grid">{shortlistComparisons.map(({ item }) => {
          const inspection = inspectionChecklistByItemId.get(item.id);
          const detail = modelDetailsFor(item.brand, item.model);
          return <article className="compare-more__item comparison-card" key={item.id}>
            <div className="compare-more__top"><div><small>{item.brand}</small><h3>{item.model}</h3></div>
              <button className="compare-icon-button" type="button" aria-label={`Remove ${item.brand} ${item.model} from shortlist`} onClick={() => removeShortlistItem(item.id)}><X size={17} /></button></div>
            <p>{item.variant || "Variant not selected"}</p><strong>{formatMoney(item.budget)}</strong>
            <small>{item.priceSource || "Example price"} · {item.state || defaultPriceState}</small>
            {detail ? <p className="compare-more__detail">{detail.bodyType} · {detail.seating} seats</p> : null}
            {inspection ? <div className="compare-inspection"><strong>Things to check</strong>{inspection.checklist.slice(0, 2).map(entry => <p key={entry.id}>{entry.title}</p>)}</div> : null}
            <label>Shopping stage<select aria-label={`${item.model} shopping stage`} value={item.status} onChange={event => updateShortlistItem(item.id, { status: event.target.value as ShortlistItem["status"] })}>{shortlistStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Your note<textarea aria-label={`${item.model} decision notes`} value={item.notes} onChange={event => updateShortlistItem(item.id, { notes: event.target.value })} placeholder="Decision notes" rows={2} /></label>
          </article>;
        })}</div>
      </section> : null}

      <footer className="compare-actions">
        <button className="compare-primary" type="button" disabled={!shortlist.length} onClick={saveComparison}><BookmarkCheck size={17} /> Save comparison</button>
        <button className="compare-share" type="button" disabled={!shortlist.length} aria-label="Share comparison" onClick={shareComparison}><Share2 size={18} /><span>Share</span></button>
      </footer>
    </section>
  );
}
