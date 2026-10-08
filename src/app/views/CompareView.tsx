// Compare: build a shortlist and read two cars side by side.
import { legacyVariantSourceFor, verifiedComparisonFor } from "../../comparisonCatalog";
import { ChevronDown } from "lucide-react";
import { shortlistStatuses, type ShortlistItem } from "../../domain";
import { formatMoney } from "../../insights";
import {
  type PriceState, brands, defaultPriceState, firstModelForBrand, firstVariantForModel, modelDetailsFor,
  modelsForBrand, priceForModel, priceSourceFor, priceStates, variantsForModel,
} from "../model";
import { useOtofolks } from "../state";

export function CompareView() {
  const {
    shortlistDraft, setShortlistDraft, dealerQuote, setDealerQuote, shortlistComparisons,
    comparisonSections, displayedComparisonSections, compareVerdict, inspectionChecklistByItemId,
    shortlistDraftPrice, shortlistDraftSource, shortlistDraftDetails, addShortlistItem,
    updateShortlistItem, removeShortlistItem, openComparisonSections, setComparisonSectionOpen,
  } = useOtofolks();
  return (
    <section className="panel" id="compare">
      <div className="section-head">
        <div>
          <p className="eyebrow">Compare</p>
          <h2>Which car feels right?</h2>
        </div>
      </div>
      <div className="shortlist-grid">
        <form className="composer" onSubmit={addShortlistItem}>
          <h3>Add model to compare</h3>
          <div className="form-row">
            <select
              aria-label="Car brand"
              value={shortlistDraft.brand}
              onChange={(event) => {
                const brand = event.target.value;
                const model = firstModelForBrand(brand);
                const variant = firstVariantForModel(brand, model);
                const budget = priceForModel(brand, model, variant, shortlistDraft.state, shortlistDraft.status);
                setShortlistDraft({
                  ...shortlistDraft,
                  brand,
                  budget,
                  model,
                  priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                  variant,
                });
              }}
            >
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <select
              aria-label="Car model"
              value={shortlistDraft.model}
              onChange={(event) => {
                const model = event.target.value;
                const variant = firstVariantForModel(shortlistDraft.brand, model);
                const budget = priceForModel(shortlistDraft.brand, model, variant, shortlistDraft.state, shortlistDraft.status);
                setShortlistDraft({
                  ...shortlistDraft,
                  budget,
                  model,
                  priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                  variant,
                });
              }}
            >
              {modelsForBrand(shortlistDraft.brand).map((option) => (
                <option key={option.model}>{option.model}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select
              aria-label="Variant"
              value={shortlistDraft.variant}
              onChange={(event) => {
                const variant = event.target.value;
                const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, variant, shortlistDraft.state, shortlistDraft.status);
                setShortlistDraft({
                  ...shortlistDraft,
                  budget,
                  priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status),
                  variant,
                });
              }}
            >
              {variantsForModel(shortlistDraft.brand, shortlistDraft.model).map((option) => (
                <option key={option.name}>{option.name}</option>
              ))}
            </select>
            <select
              aria-label="State"
              value={shortlistDraft.state}
              onChange={(event) => {
                const state = event.target.value as PriceState;
                const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, state, shortlistDraft.status);
                setShortlistDraft({
                  ...shortlistDraft,
                  budget,
                  priceSource: priceSourceFor(state, shortlistDraft.status),
                  state,
                });
              }}
            >
              {priceStates.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </div>
          {legacyVariantSourceFor(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant) ? (
            <p className="form-note">This variant is not listed in the manufacturer's current online range. It may still be available as old stock or used.</p>
          ) : null}
          <div className="form-row">
            <div className="price-display" aria-label="Model price">
              <span>{dealerQuote ? "Your dealer quote" : "Example price"}</span>
              <strong>{formatMoney(shortlistDraftPrice)}</strong>
              <small>{shortlistDraftSource}</small>
            </div>
            <select
              aria-label="Car condition"
              value={shortlistDraft.status}
              onChange={(event) => {
                const status = event.target.value as ShortlistItem["status"];
                const budget = priceForModel(shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, shortlistDraft.state, status);
                setShortlistDraft({
                  ...shortlistDraft,
                  budget,
                  priceSource: priceSourceFor(shortlistDraft.state ?? defaultPriceState, status),
                  status,
                });
              }}
            >
              {shortlistStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
          <textarea
            rows={4}
            value={shortlistDraft.notes}
            onChange={(event) => setShortlistDraft({ ...shortlistDraft, notes: event.target.value })}
            placeholder="Why is it on the list? Dealer quote, family need, must-check concern..."
          />
          <label>Dealer quote (INR, optional)
            <input type="number" min="1" value={dealerQuote || ""} onChange={event => setDealerQuote(Number(event.target.value))} placeholder="Enter the price quoted to you" />
          </label>
          <button className="primary-action" type="submit">
            Add to compare
          </button>
        </form>

        <div className="compare-side">
          <article className="comparison-card one-to-one-card" aria-label="One to one comparison">
            <span className="confidence high">Side by side</span>
            <h3>{comparisonSections.length
              ? `${shortlistComparisons[0].item.brand} ${shortlistComparisons[0].item.model} vs ${shortlistComparisons[1].item.brand} ${shortlistComparisons[1].item.model}`
              : `Add ${2 - shortlistComparisons.length} more ${shortlistComparisons.length ? "car" : "cars"} to compare`}</h3>
            {comparisonSections.length ? (
              <div className="comparison-sources">
                <p className="form-note">Manufacturer-verified specs are shown where available. "Not verified" does not mean "No". Catalog body type, seats and example prices still need a dealer check.</p>
                {shortlistComparisons.slice(0, 2).map((comparison) => {
                  const verified = verifiedComparisonFor(comparison.item.brand, comparison.item.model, comparison.item.variant);
                  const legacy = legacyVariantSourceFor(comparison.item.brand, comparison.item.model, comparison.item.variant);
                  return <p key={comparison.item.id} className="form-note">
                    <strong>{comparison.item.brand} {comparison.item.model} {comparison.item.variant}:</strong>{" "}
                    {verified ? <a href={verified.source.url} target="_blank" rel="noopener noreferrer">{verified.source.label} specifications</a>
                      : legacy ? <>Not listed in the current online range. <a href={legacy.url} target="_blank" rel="noopener noreferrer">Check {legacy.label}</a></>
                        : "Manufacturer specs pending for this variant"}
                  </p>;
                })}
              </div>
            ) : null}
            <div className="comparison-sections" role="region" aria-label="Comparison categories">
              {displayedComparisonSections.map((section, index) => (
                <details className="comparison-section" key={section.title}
                  open={openComparisonSections.includes(section.title)}
                  onToggle={(event) => setComparisonSectionOpen(section.title, event.currentTarget.open)}>
                  <summary><span className="comparison-section-number">{String(index + 1).padStart(2, "0")}</span>
                    <span>{section.title}</span><ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  {comparisonSections.length && section.rows.length ? (
                    <div className="compare-table" role="table" aria-label={`${section.title} comparison`}>
                      <div role="row">
                        <strong role="columnheader">Metric</strong>
                        <strong role="columnheader">{shortlistComparisons[0].item.model}</strong>
                        <strong role="columnheader">{shortlistComparisons[1].item.model}</strong>
                      </div>
                      {section.rows.map(([metric, first, second]) => (
                        <div role="row" key={metric}>
                          <span role="rowheader">{metric}</span>
                          <span role="cell">{first}</span>
                          <span role="cell">{second}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="form-note comparison-section-note">{comparisonSections.length
                    ? "Details for this category are not available yet."
                    : "Add two cars to see this comparison."}</p>}
                </details>
              ))}
            </div>
            {compareVerdict ? (
                <div className="compare-verdict">
                  <div className="verdict-block">
                    <h4>What is the core difference?</h4>
                    <p>{compareVerdict.coreDifference}</p>
                  </div>
                  <div className="verdict-block verdict-pick">
                    <h4>What should you check next?</h4>
                    <p>{compareVerdict.reason}</p>
                  </div>
                </div>
            ) : null}
          </article>
          <article className="comparison-card example-card" aria-label="Compare preview">
            <span className="confidence medium">Example preview</span>
            <h3>
              {shortlistDraft.brand} {shortlistDraft.model}
            </h3>
            <p>{shortlistDraft.variant}</p>
            <p>{formatMoney(shortlistDraftPrice)} estimated price</p>
            {shortlistDraftDetails ? (
              <div className="spec-grid" aria-label="Selected car details">
                <span>{shortlistDraftDetails.bodyType}</span>
                <span>{shortlistDraftDetails.fuel}</span>
                <span>{shortlistDraftDetails.seating} seats</span>
                <span>{shortlistDraftDetails.mileage}</span>
                <span>{shortlistDraftDetails.safety}</span>
              </div>
            ) : null}
            <div className="comparison-stats">
              <span>{shortlistDraft.status}</span>
              <span>{shortlistDraft.state}</span>
            </div>
            <small>{shortlistDraftSource}</small>
          </article>
          <div className="comparison-grid">
          {shortlistComparisons.length ? (
            shortlistComparisons.map((comparison) => {
              const inspection = inspectionChecklistByItemId.get(comparison.item.id);
              const comparisonDetails = modelDetailsFor(comparison.item.brand, comparison.item.model);
              return (
                <article className="comparison-card" key={comparison.item.id}>
                  {inspection ? (
                    <div className="inspection-list">
                      <strong>Inspection checklist</strong>
                      {inspection.checklist.map((item) => (
                        <div className={`inspection-item ${item.priority.toLowerCase()}`} key={item.id}>
                          <span>{item.priority}</span>
                          <div>
                            <b>{item.title}</b>
                            <p>{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <h3>
                    {comparison.item.brand} {comparison.item.model}
                  </h3>
                  {comparison.item.variant ? <p>{comparison.item.variant}</p> : null}
                  <p>{formatMoney(comparison.item.budget)} estimated price</p>
                  {comparison.item.priceSource ? <small>{comparison.item.priceSource}</small> : null}
                  {comparisonDetails ? (
                    <div className="spec-grid" aria-label="Car details">
                      <span>{comparisonDetails.bodyType}</span>
                      <span>{comparisonDetails.fuel}</span>
                      <span>{comparisonDetails.seating} seats</span>
                      <span>{comparisonDetails.mileage}</span>
                      <span>{comparisonDetails.safety}</span>
                    </div>
                  ) : null}
                  <div className="form-row">
                    <select
                      value={comparison.item.status}
                      onChange={(event) =>
                        updateShortlistItem(comparison.item.id, {
                          status: event.target.value as ShortlistItem["status"],
                        })
                      }
                    >
                      {shortlistStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button className="save-button" type="button" onClick={() => removeShortlistItem(comparison.item.id)}>
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={comparison.item.notes}
                    onChange={(event) => updateShortlistItem(comparison.item.id, { notes: event.target.value })}
                    placeholder="Decision notes"
                  />
                </article>
              );
            })
          ) : (
            <div className="empty-state">Add a car to begin comparing.</div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
