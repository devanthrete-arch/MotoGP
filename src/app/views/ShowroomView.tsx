import { lazy, Suspense, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Box, Pause, Play, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router";
import { IconButton } from "../../ui/Button";
import { cx } from "../../ui/cx";
import {
  parseShowroomManifest, showroomManifestUrl, webglAvailable, type ShowroomManifest,
} from "../../vehicles/showroomManifest";
import "./ShowroomView.css";

// three.js and drei come with the stage, not with this page: a browser without WebGL never downloads them.
const ShowroomScene = lazy(() => import("../../vehicles/ShowroomScene"));

const compactScreen = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; manifest: ShowroomManifest };

export function ShowroomView() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  // The car is in the address (/showroom?car=kia-sonet), so a link can open the showroom on one car.
  const [params, setParams] = useSearchParams();
  const carId = params.get("car") ?? "";
  const setCarId = (id: string) => setParams((current) => { current.set("car", id); return current; }, { replace: true });
  const [paint, setPaint] = useState("");
  // Motion is on unless the visitor pauses it.
  const [playing, setPlaying] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [failedModels, setFailedModels] = useState<ReadonlySet<string>>(new Set());
  // Asked once, before the 3D code is fetched. A context lost later also falls back to the photo.
  const [webgl, setWebgl] = useState(webglAvailable);
  const [compact] = useState(compactScreen);

  useEffect(() => {
    let current = true;
    fetch(showroomManifestUrl)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((raw: unknown) => {
        if (!current) return;
        const manifest = parseShowroomManifest(raw);
        setLoad(manifest.cars.length ? { state: "ready", manifest } : { state: "failed" });
        const first = manifest.cars.find((entry) => entry.id === carId) ?? manifest.cars[0];
        setPaint(first?.swatches[0]?.hex ?? "#c8102e");
      })
      .catch(() => { if (current) setLoad({ state: "failed" }); });
    return () => { current = false; };
    // Once per visit: the car in the address when the page opened picks the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manifest = load.state === "ready" ? load.manifest : null;
  const car = manifest?.cars.find((entry) => entry.id === carId) ?? manifest?.cars[0];
  const swatch = car?.swatches.find((entry) => entry.hex === paint);
  const modelFailed = car ? failedModels.has(car.id) : false;
  const canRecolour = Boolean(car?.paintMaterials.length) && webgl;

  return (
    <section className="showroom" aria-labelledby="showroom-title">
      <header className="showroom__head">
        <p className="eyebrow"><Box size={16} aria-hidden="true" /> Virtual showroom</p>
        <h1 id="showroom-title">{car ? car.name : "Virtual showroom"}</h1>
        <p>{car?.maker ? `${car.maker} · ` : ""}Drag to walk around the car, pinch or scroll to zoom.</p>
      </header>

      <div className="showroom__stage">
        {load.state === "loading" && <StageMessage busy>Opening the showroom…</StageMessage>}
        {load.state === "failed" && <StageMessage>The showroom could not be opened. Check your connection and reload the page.</StageMessage>}
        {car && !webgl && (
          <figure className="showroom__fallback">
            {car.poster ? <img src={car.poster} alt={`${car.name}, ${swatch?.name ?? "studio"} paint`} /> : <Box size={64} aria-hidden="true" />}
            <figcaption>Your browser cannot show 3D here, so this is a photo of the car.</figcaption>
          </figure>
        )}
        {car && webgl && (
          <div className="showroom__viewport" role="img"
            aria-label={`3D view of the ${car.name}${swatch ? ` in ${swatch.name}` : ""}. Drag to rotate, pinch or scroll to zoom.`}>
            <Suspense fallback={<StageMessage busy>Loading the 3D showroom…</StageMessage>}>
              <ShowroomScene
                car={car} paint={paint} playing={playing} compact={compact} resetSignal={resetSignal}
                onModelError={(id) => setFailedModels((failed) => new Set(failed).add(id))}
                onContextLost={() => setWebgl(false)}
              />
            </Suspense>
            {modelFailed && <StageMessage>This model could not be loaded. Pick another car.</StageMessage>}
          </div>
        )}
        {car && webgl && (
          <div className="showroom__stage-controls">
            <IconButton label={playing ? "Pause the turntable" : "Play the turntable"} aria-pressed={!playing}
              onClick={() => setPlaying((value) => !value)}>
              {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            </IconButton>
            <IconButton label="Reset the view" onClick={() => setResetSignal((value) => value + 1)}>
              <RotateCcw size={18} aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </div>

      {manifest && car && (
        <div className="showroom__panel">
          <fieldset className="showroom__group">
            <legend>Car</legend>
            <div className="showroom__cars">
              {manifest.cars.map((entry) => (
                <button key={entry.id} type="button" className={cx("showroom__car", entry.id === car.id && "is-active")}
                  aria-pressed={entry.id === car.id} onClick={() => {
                    setCarId(entry.id);
                    // Each car opens in its own first paint.
                    if (!entry.swatches.some((option) => option.hex === paint)) setPaint(entry.swatches[0]?.hex ?? paint);
                  }}>
                  <span>{entry.name}</span>
                  {entry.maker && <small>{entry.maker}</small>}
                </button>
              ))}
            </div>
          </fieldset>

          {canRecolour && car.swatches.length > 0 && (
            <fieldset className="showroom__group">
              <legend>Paint <span>{swatch?.name}</span></legend>
              <div className="showroom__swatches">
                {car.swatches.map((entry) => (
                  <button key={entry.hex} type="button" className={cx("showroom__swatch", entry.hex === paint && "is-active")}
                    style={{ "--swatch": entry.hex } as CSSProperties}
                    aria-pressed={entry.hex === paint} aria-label={entry.name} title={entry.name}
                    onClick={() => setPaint(entry.hex)} />
                ))}
              </div>
            </fieldset>
          )}

          <p className="showroom__credit">
            Model: {car.credit.url ? <a href={car.credit.url} target="_blank" rel="noreferrer">{car.credit.author || car.name}</a> : (car.credit.author || "Unknown")}
            {car.credit.licence && ` · ${car.credit.licence}`}
          </p>
        </div>
      )}
    </section>
  );
}

function StageMessage({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <div className="showroom__message" role="status">
      {busy && <span className="ui-button__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}
