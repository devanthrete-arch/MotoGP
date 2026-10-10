import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { vehicleCatalogue } from "../catalogue/catalogue";
import { requestedMakes } from "../catalogue/indiaLineup";
import { SelectField } from "../ui/Field";
import VehicleViewer from "./VehicleViewer";

const paintOptions = [
  { name: "Deep teal", value: "#0f6568" },
  { name: "Pearl white", value: "#e5e5df" },
  { name: "Graphite", value: "#464b50" },
  { name: "Oxblood", value: "#713f47" },
];
const requestedModels = vehicleCatalogue.filter(model => requestedMakes.includes(model.brand as typeof requestedMakes[number]));

export default function VehicleGarage3D() {
  const [make, setMake] = useState<string>(requestedMakes[0]);
  const [model, setModel] = useState("S-Presso");
  const [paint, setPaint] = useState(paintOptions[0].value);
  const modelsForMake = useMemo(() => requestedModels.filter(item => item.brand === make), [make]);
  const selectedModel = modelsForMake.find(item => item.name === model) ?? modelsForMake[0];
  const shape = selectedModel?.shape === "scooter" ? "scooter"
    : selectedModel?.kind === "two-wheeler" ? "motorcycle" : "crossover";

  return <div className="vehicle-garage3d">
    <div className="vehicle-garage3d__scene">
      <VehicleViewer paint={paint} shape={shape} />
    </div>
    <div className="vehicle-garage3d__controls">
      <div className="vehicle-garage3d__catalogue" aria-label="Vehicle catalogue preview">
        <SelectField label="Make" options={requestedMakes} value={make} onChange={event => {
          const nextMake = event.target.value;
          setMake(nextMake);
          setModel(requestedModels.find(item => item.brand === nextMake)?.name ?? "");
        }} />
        <SelectField label="Model" options={modelsForMake.map(item => item.name)} value={selectedModel?.name ?? ""}
          onChange={event => setModel(event.target.value)} />
      </div>
      <div className="vehicle-garage3d__paint" role="group" aria-label="Vehicle colour">
        {paintOptions.map(color => <button key={color.value} className="landing-stage__swatch" type="button"
          aria-label={color.name} aria-pressed={paint === color.value} title={color.name}
          style={{ "--swatch": color.value } as CSSProperties} onClick={() => setPaint(color.value)} />)}
      </div>
      <small className="vehicle-garage3d__disclaimer">{selectedModel?.brand} {selectedModel?.name} · generic shape preview, not a replica</small>
    </div>
  </div>;
}
