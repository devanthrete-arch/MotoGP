import { useMemo, useState } from "react";
import {
  Bookmark,
  CarFront,
  ChevronsUp,
  Flag,
  ListChecks,
  MapPin,
  Share2,
  Star,
  Wrench,
} from "lucide-react";
import { useApp } from "../appState";
import { modelKeyFor } from "../insights";
import { findModel, formatINR, indianStates, onRoadPriceINR } from "../carData";
import { Badge, DataText, EdgeGlow, GhostButton, LabelCaps, PrimaryButton } from "../components/ui";

/**
 * Owner-note / car detail pane (template: car_detail_pricing_autoflex).
 * Rendered inside the CommunityFeed content grid; owns the note detail,
 * mono spec sheet, state-wise on-road pricing matrix, signals, discussion,
 * and report flows.
 */
export function CarDetail() {
  const app = useApp();
  const { selectedPost, selectedPostQuality, saved, followedModelSet, followedTopicSet, postDetailOpen } = app;

  const [pricingState, setPricingState] = useState<string>(indianStates[0] ?? "Delhi");
  const [variantName, setVariantName] = useState<string>("");

  const catalogModel = useMemo(
    () => (selectedPost ? findModel(selectedPost.brand, selectedPost.model) : undefined),
    [selectedPost],
  );
  const activeVariant = useMemo(() => {
    if (!catalogModel) return undefined;
    return (
      catalogModel.variants.find((variant) => variant.name === variantName) ??
      catalogModel.variants.find((variant) => selectedPost?.variant?.toLowerCase().includes(variant.name.toLowerCase())) ??
      catalogModel.variants[0]
    );
  }, [catalogModel, variantName, selectedPost]);

  const specRows: Array<{ label: string; value: string }> = activeVariant
    ? [
        { label: "FUEL", value: activeVariant.fuel.toUpperCase() },
        { label: "TRANSMISSION", value: activeVariant.transmission },
        ...(activeVariant.engineCC ? [{ label: "ENGINE", value: `${activeVariant.engineCC} CC` }] : []),
        ...(activeVariant.powerBHP ? [{ label: "POWER", value: `${activeVariant.powerBHP} BHP` }] : []),
        ...(activeVariant.torqueNM ? [{ label: "TORQUE", value: `${activeVariant.torqueNM} NM` }] : []),
        ...(activeVariant.mileageKMPL
          ? [{ label: activeVariant.fuel === "Electric" ? "RANGE" : "MILEAGE", value: activeVariant.fuel === "Electric" ? `${activeVariant.mileageKMPL} KM` : `${activeVariant.mileageKMPL} KMPL` }]
          : []),
        ...(activeVariant.seats ? [{ label: "SEATS", value: String(activeVariant.seats) }] : []),
      ]
    : [];

  const exShowroom = activeVariant?.priceExShowroomINR ?? 0;
  const onRoad = activeVariant ? onRoadPriceINR(exShowroom, pricingState) : 0;

  return (
    <aside
      aria-label="Owner note detail"
      className={`${postDetailOpen && selectedPost ? "flex" : "hidden lg:flex"} detail-card relative overflow-hidden flex-col gap-5 bg-surface-container border border-outline-variant rounded-lg p-4 sm:p-5 min-w-0`}
    >
      <EdgeGlow />
      {postDetailOpen && selectedPost ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <GhostButton className="min-h-[44px]" onClick={app.returnToCommunityFeed}>
              Back to notes
            </GhostButton>
            <Badge>{selectedPost.label}</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <h2
              className="font-display text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-on-surface"
              ref={app.postDetailHeadingRef}
              tabIndex={-1}
            >
              {selectedPost.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DataText className="text-on-surface-variant uppercase">BY {selectedPost.author}</DataText>
              <span className="inline-flex items-center gap-1.5">
                <CarFront aria-hidden="true" className="w-3.5 h-3.5 text-outline" />
                <DataText className="text-on-surface-variant uppercase">
                  {selectedPost.brand} {selectedPost.model}
                  {selectedPost.variant ? ` • ${selectedPost.variant}` : ""}
                  {selectedPost.fuel ? ` • Fuel: ${selectedPost.fuel}` : ""}
                </DataText>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="w-3.5 h-3.5 text-outline" />
                <DataText className="text-on-surface-variant uppercase">{selectedPost.city}</DataText>
              </span>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">{selectedPost.body}</p>

          {selectedPostQuality ? (
            <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-2">
              <EdgeGlow />
              <div className="flex items-center justify-between gap-3">
                <LabelCaps className="text-primary">Signal quality</LabelCaps>
                <DataText className="text-on-surface">
                  {selectedPostQuality.score}/{selectedPostQuality.maxScore}
                </DataText>
              </div>
              <progress
                aria-label={`Owner note detail quality ${selectedPostQuality.score} of ${selectedPostQuality.maxScore}`}
                className="w-full h-1 appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-container-highest [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
                max={selectedPostQuality.maxScore}
                value={selectedPostQuality.score}
              />
              <DataText className="text-on-surface-variant uppercase">{selectedPostQuality.grade}</DataText>
              <p className="text-xs text-on-surface-variant">
                {selectedPostQuality.strengths[0] ?? "Add car, mileage, and location details to make this note more useful."}
              </p>
            </div>
          ) : null}

          {/* SPEC SHEET */}
          {catalogModel && activeVariant ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Wrench aria-hidden="true" className="w-4 h-4 text-primary" />
                  <LabelCaps className="text-on-surface">Spec sheet</LabelCaps>
                </span>
                {catalogModel.safetyRatingStars ? (
                  <span aria-label={`Safety rating ${catalogModel.safetyRatingStars} stars`} className="flex items-center gap-0.5">
                    {Array.from({ length: catalogModel.safetyRatingStars }).map((_, index) => (
                      <Star aria-hidden="true" className="w-3.5 h-3.5 text-primary fill-current" key={index} />
                    ))}
                  </span>
                ) : null}
              </div>
              {catalogModel.variants.length > 1 ? (
                <select
                  aria-label="Select variant"
                  className="w-full min-h-[44px] !bg-surface-container-high font-mono !text-xs tracking-[0.05em]"
                  value={activeVariant.name}
                  onChange={(event) => setVariantName(event.target.value)}
                >
                  {catalogModel.variants.map((variant) => (
                    <option key={variant.name} value={variant.name}>
                      {variant.name} · {variant.fuel} {variant.transmission}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-1">
                {specRows.map((row) => (
                  <div className="flex items-center justify-between gap-4 py-2.5 border-b border-outline-variant/40 last:border-b-0" key={row.label}>
                    <DataText className="text-on-surface-variant">{row.label}</DataText>
                    <DataText className="text-on-surface">{row.value}</DataText>
                  </div>
                ))}
              </div>

              {/* STATE-WISE PRICING */}
              <div className="flex items-center justify-between gap-3 mt-2">
                <LabelCaps className="text-on-surface">On-road pricing</LabelCaps>
                <select
                  aria-label="Select state"
                  className="min-h-[44px] !bg-surface-container-high !text-primary font-mono !text-xs tracking-[0.05em] !py-2"
                  value={pricingState}
                  onChange={(event) => setPricingState(event.target.value)}
                >
                  {indianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-col gap-3">
                <EdgeGlow />
                <div className="flex items-center justify-between gap-4 border-b border-outline-variant/40 pb-3">
                  <DataText className="text-on-surface-variant">EX-SHOWROOM</DataText>
                  <DataText className="text-on-surface">{formatINR(exShowroom)}</DataText>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <DataText className="text-on-surface-variant">RTO + INS + CESS (EST.)</DataText>
                  <DataText className="text-on-surface-variant">{formatINR(onRoad - exShowroom)}</DataText>
                </div>
                <div className="flex items-end justify-between gap-4 border-t border-outline-variant/40 pt-3">
                  <span className="flex flex-col">
                    <LabelCaps className="text-primary">Estimated</LabelCaps>
                    <span className="font-display text-sm font-semibold uppercase text-on-surface">On-road · {pricingState}</span>
                  </span>
                  <DataText size="lg" className="text-primary glow-text">
                    {formatINR(onRoad)}
                  </DataText>
                </div>
                <DataText className="text-on-surface-variant text-right !text-[10px]">*Approx. Varies by dealership and city.</DataText>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[300px] border-collapse">
                  <caption className="sr-only">On-road price by state for {catalogModel.brand} {catalogModel.model} {activeVariant.name}</caption>
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="text-left py-2 pr-3 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface-variant" scope="col">
                        State
                      </th>
                      <th className="text-right py-2 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface-variant" scope="col">
                        On-road
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {indianStates.map((state) => (
                      <tr
                        className={`border-b border-outline-variant/30 last:border-b-0 cursor-pointer transition-colors ${
                          state === pricingState ? "bg-primary-container/60" : "hover:bg-surface-container-high"
                        }`}
                        key={state}
                        onClick={() => setPricingState(state)}
                      >
                        <td className="py-2.5 pr-3">
                          <button
                            aria-pressed={state === pricingState}
                            className={`flex items-center w-full font-mono text-xs tracking-[0.1em] text-left min-h-[44px] ${
                              state === pricingState ? "text-primary" : "text-on-surface-variant"
                            }`}
                            type="button"
                            onClick={() => setPricingState(state)}
                          >
                            {state.toUpperCase()}
                          </button>
                        </td>
                        <td className={`py-2.5 text-right font-mono text-xs tracking-[0.1em] ${state === pricingState ? "text-primary" : "text-on-surface"}`}>
                          {formatINR(onRoadPriceINR(exShowroom, state))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <DataText className="text-outline">SPEC DATA: NOT IN CATALOG YET</DataText>
          )}

          {/* PRIMARY ACTIONS */}
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryButton className="flex-1 min-h-[44px]" onClick={app.addSelectedToShortlist}>
              <ListChecks aria-hidden="true" className="w-4 h-4" />
              Add to compare
            </PrimaryButton>
            <GhostButton
              aria-pressed={saved.has(selectedPost.id)}
              className="flex-1 min-h-[44px]"
              onClick={() => app.toggleSaved(selectedPost.id)}
            >
              <Bookmark aria-hidden="true" className={`w-4 h-4 ${saved.has(selectedPost.id) ? "fill-current text-primary" : ""}`} />
              {saved.has(selectedPost.id) ? "Remove from saved" : "Save note"}
            </GhostButton>
          </div>

          {/* SIGNALS */}
          <div className="flex flex-wrap gap-2" aria-label="Note signals">
            <GhostButton className="min-h-[44px]" onClick={() => app.markHelpful(selectedPost.id)}>
              <ChevronsUp aria-hidden="true" className="w-4 h-4" />
              Helpful · {selectedPost.helpful}
            </GhostButton>
            {selectedPost.label === "Fix" ? (
              <GhostButton className="min-h-[44px]" onClick={() => app.confirmFix(selectedPost.id)}>
                Worked for me · {selectedPost.fixesConfirmed}
              </GhostButton>
            ) : null}
            <GhostButton className="min-h-[44px]" onClick={() => app.toggleFollowModel(selectedPost.brand, selectedPost.model)}>
              {followedModelSet.has(modelKeyFor(selectedPost.brand, selectedPost.model)) ? "Following model" : "Follow model"}
            </GhostButton>
            <GhostButton className="min-h-[44px]" onClick={() => app.toggleFollowTopic(selectedPost.label)}>
              {followedTopicSet.has(selectedPost.label) ? "Following topic" : "Follow topic"}
            </GhostButton>
            <GhostButton className="min-h-[44px]" onClick={app.shareSelectedPost}>
              <Share2 aria-hidden="true" className="w-4 h-4" />
              Share note
            </GhostButton>
          </div>

          {/* DISCUSSION */}
          <div className="flex flex-col gap-2">
            <LabelCaps className="text-on-surface">Discussion</LabelCaps>
            {selectedPost.comments.length ? (
              selectedPost.comments.map((comment) => (
                <p className="text-sm text-on-surface-variant bg-surface-container-lowest border border-outline-variant/60 rounded px-3 py-2.5" key={comment}>
                  {comment}
                </p>
              ))
            ) : (
              <DataText className="text-on-surface-variant">NO REPLIES YET</DataText>
            )}
          </div>
          <form className="flex flex-col gap-2" onSubmit={app.addComment}>
            <textarea
              aria-label="Write a comment on this note"
              className="w-full"
              placeholder="Add a useful reply, correction, bill detail, or ownership question."
              required
              rows={3}
              value={app.commentDraft}
              onChange={(event) => app.setCommentDraft(event.target.value)}
            />
            <GhostButton className="self-start min-h-[44px]" type="submit">
              Post comment
            </GhostButton>
          </form>

          {/* REPORT */}
          <form className="flex flex-col gap-2 border-t border-outline-variant/60 pt-4" onSubmit={app.reportSelectedPost}>
            <span className="flex items-center gap-2">
              <Flag aria-hidden="true" className="w-3.5 h-3.5 text-error" />
              <LabelCaps className="text-error">Report this note</LabelCaps>
            </span>
            <textarea
              aria-label="Report this owner note"
              className="w-full"
              placeholder="Report spam, abuse, fake lead, or dangerous advice."
              required
              rows={3}
              value={app.reportDraft}
              onChange={(event) => app.setReportDraft(event.target.value)}
            />
            <GhostButton className="self-start min-h-[44px] !border-error/40 !text-error hover:!border-error" type="submit">
              Submit report
            </GhostButton>
          </form>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2 py-6">
          <LabelCaps className="text-on-surface-variant">Detail feed</LabelCaps>
          <p className="text-sm text-on-surface-variant">Choose a note to read what the owner reported.</p>
        </div>
      )}
    </aside>
  );
}
