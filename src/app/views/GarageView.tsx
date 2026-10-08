// Garage: vehicles, maintenance timeline, reminders and running costs.
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Download, Pencil, Trash2 } from "lucide-react";
import { timelineKinds, type DraftVehicle, type GarageVehicle, type TimelineEntryKind } from "../../domain";
import { formatMoney } from "../../insights";
import { PlateInput } from "../../ui/PlateInput";
import { Button, IconButton } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { SelectField, TextAreaField, TextField } from "../../ui/Field";
import { parseRegistration, registrationProblemText } from "../../ui/plate";
import { brands, initialVehicleDraft } from "../model";
import { useOtofolks } from "../state";

// A stored number in the form it has on the plate.
const plateText = (normalized: string) => {
  const parsed = parseRegistration(normalized);
  return parsed.ok ? parsed.display : normalized;
};

export function GarageView() {
  const {
    garage, timeline, vehicleDraft, setVehicleDraft, timelineDraft, setTimelineDraft,
    garageInsights, garageCostLedger, garageReminders, exportGarage, addVehicle, addTimelineNote, updateVehicle, removeVehicle,
    vehiclePlates, plateDraft, setPlateDraft,
  } = useOtofolks();
  // The number is optional. A problem with it is shown once the member has left the field with
  // something in it, or tried to save; not while they are still typing it for the first time.
  const [plateChecked, setPlateChecked] = useState(false);
  const plateField = useRef<HTMLInputElement>(null);
  const registration = parseRegistration(plateDraft);
  const plateProblem = plateChecked && plateDraft.trim() && !registration.ok ? registrationProblemText[registration.problem] : undefined;
  const [editing, setEditing] = useState<GarageVehicle | null>(null);
  const [editDraft, setEditDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [editRegistration, setEditRegistration] = useState("");
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState<GarageVehicle | null>(null);
  const beginEdit = (vehicle: GarageVehicle) => {
    const { id: _id, ...draft } = vehicle;
    setEditing(vehicle);
    setEditDraft(draft);
    setEditRegistration(vehicle.registration ?? vehiclePlates[vehicle.id] ?? "");
    setEditError("");
  };
  const saveEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const plate = parseRegistration(editRegistration);
    if (editRegistration.trim() && !plate.ok) { setEditError(registrationProblemText[plate.problem]); return; }
    const nextPlates = { ...vehiclePlates };
    if (plate.ok) nextPlates[editing.id] = plate.normalized;
    else delete nextPlates[editing.id];
    updateVehicle({
      ...editing, ...editDraft,
      nickname: editDraft.nickname.trim() || `${editDraft.brand} ${editDraft.model}`,
      city: editDraft.city.trim(), odometerKm: Number(editDraft.odometerKm) || 0,
      registration: plate.ok ? plate.normalized : undefined,
    }, nextPlates);
    setEditing(null);
  };

  const vehicleFields = (draft: DraftVehicle, change: (value: DraftVehicle) => void) => <>
    <TextField label="Nickname" maxLength={80} value={draft.nickname}
      onChange={event => change({ ...draft, nickname: event.target.value })} placeholder="Nickname" />
    <div className="garage-form__row">
      <SelectField label="Vehicle type" options={[{ value: "car", label: "Car" }, { value: "two-wheeler", label: "Two-wheeler" }]}
        value={draft.kind ?? "car"} onChange={event => change({ ...draft, kind: event.target.value as GarageVehicle["kind"] })} />
      <SelectField label="Make" options={brands} value={draft.brand}
        onChange={event => change({ ...draft, brand: event.target.value, source: "manual" })} />
    </div>
    <div className="garage-form__row">
      <TextField label="Model" required maxLength={100} value={draft.model}
        onChange={event => change({ ...draft, model: event.target.value, source: "manual" })} placeholder="Model" />
      <TextField label="Variant" maxLength={100} value={draft.variant}
        onChange={event => change({ ...draft, variant: event.target.value })} placeholder="e.g. XZ+" />
    </div>
    <div className="garage-form__row">
      <TextField label="City" maxLength={80} value={draft.city}
        onChange={event => change({ ...draft, city: event.target.value })} placeholder="e.g. Pune" />
      <TextField label="Current odometer (km)" min="0" type="number" value={draft.odometerKm || ""}
        onChange={event => change({ ...draft, odometerKm: Number(event.target.value) })} />
    </div>
    <div className="garage-form__row">
      <TextField label="Colour" maxLength={60} value={draft.colour ?? ""}
        onChange={event => change({ ...draft, colour: event.target.value })} placeholder="Optional" />
      <TextField label="Fuel" maxLength={40} value={draft.fuel ?? ""}
        onChange={event => change({ ...draft, fuel: event.target.value })} placeholder="Optional" />
    </div>
    <div className="garage-form__row">
      <TextField label="Manufacture year" inputMode="numeric" maxLength={4} value={draft.manufactureYear ?? ""}
        onChange={event => change({ ...draft, manufactureYear: event.target.value ? Number(event.target.value.replace(/\D/g, "").slice(0, 4)) : undefined })} />
      <TextField label="Purchase month" type="month" value={draft.purchaseMonth}
        onChange={event => change({ ...draft, purchaseMonth: event.target.value })} />
    </div>
  </>;
  return (
    <section className="panel" id="garage">
      <div className="section-head">
        <div>
          <p className="eyebrow">Garage timeline</p>
          <h2>Your vehicles and maintenance</h2>
        </div>
        <Button type="button" variant="secondary" icon={<Download size={16} aria-hidden="true" />} onClick={exportGarage}>Export garage</Button>
      </div>
      <div className="garage-grid">
        <form className="composer garage-form" onSubmit={(event) => {
          const saved = addVehicle(event);
          setPlateChecked(!saved);
          if (!saved) plateField.current?.focus();
        }}>
          <h3>Add vehicle</h3>
          <PlateInput ref={plateField} className="garage-plate" label="Registration number (optional)" value={plateDraft}
            onChange={(value) => setPlateDraft(value)} error={plateProblem}
            onBlur={(event) => setPlateChecked(Boolean(event.target.value.trim()))}
            hint="Kept on this device only. It is not saved to your account copy and is not looked up." />
          {vehicleFields(vehicleDraft, setVehicleDraft)}
          <Button type="submit" variant="primary" fullWidth>Save vehicle</Button>
        </form>

        <form className="composer garage-form" onSubmit={addTimelineNote}>
          <h3>Add timeline note</h3>
          {!garage.length ? <p>Add a vehicle first to record its maintenance.</p> : null}
          <SelectField label="Vehicle" required options={garage.map(vehicle => ({ value: vehicle.id, label: vehicle.nickname || `${vehicle.brand} ${vehicle.model}` }))}
            value={timelineDraft.vehicleId} disabled={!garage.length}
            onChange={event => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })} />
          <div className="garage-form__row">
            <SelectField label="Entry type" options={timelineKinds}
              value={timelineDraft.kind} onChange={event => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })} />
            <TextField label="Date" type="date" value={timelineDraft.happenedOn}
              onChange={event => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })} />
          </div>
          <TextField label="What happened?" required maxLength={160} value={timelineDraft.title}
            onChange={event => setTimelineDraft({ ...timelineDraft, title: event.target.value })} placeholder="What happened?" />
          <div className="garage-form__row">
            <TextField label="Amount paid" min="0" type="number" value={timelineDraft.amount || ""} placeholder="Amount paid"
              onChange={event => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })} />
            <TextField label="Odometer (km)" min="0" type="number" value={timelineDraft.odometerKm || ""}
              onChange={event => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })} />
          </div>
          <TextAreaField label="Details" rows={4} maxLength={10000} value={timelineDraft.note}
            onChange={event => setTimelineDraft({ ...timelineDraft, note: event.target.value })}
            placeholder="Bill details, symptoms, shop notes, or what you would do differently." />
          <Button type="submit" variant="primary" fullWidth disabled={!garage.length}>Add timeline note</Button>
        </form>
      </div>

      <div className="reminder-board" aria-label="Garage reminders">
        {garageReminders.length ? (
          garageReminders.map((reminder) => (
            <article className={`reminder-card ${reminder.urgency.toLowerCase()}`} key={reminder.id}>
              <span>{reminder.urgency}</span>
              <h3>{reminder.title}</h3>
              <p>
                {reminder.vehicleName}: {reminder.detail}
              </p>
            </article>
          ))
        ) : (
          <div className="empty-state">No garage reminders right now. Keep logging service, insurance, tyre, and repair notes.</div>
        )}
      </div>

      <div className="timeline-board">
        {garage.map((vehicle) => (
          <article className="vehicle-card" key={vehicle.id}>
            <span className="pill">{vehicle.brand}</span>
            <h3>{vehicle.nickname}</h3>
            {(vehicle.registration || vehiclePlates[vehicle.id]) ? (
              <p><b className="vehicle-plate">{plateText(vehicle.registration ?? vehiclePlates[vehicle.id])}</b> · number kept on this device only</p>
            ) : null}
            <p>
              {vehicle.model} {vehicle.variant} · {vehicle.city || "City not set"} · {vehicle.odometerKm.toLocaleString("en-IN")} km
            </p>
            <p>{[vehicle.kind === "two-wheeler" ? "Two-wheeler" : "Car", vehicle.manufactureYear, vehicle.colour, vehicle.fuel].filter(Boolean).join(" · ")}</p>
            <div className="vehicle-card__actions">
              <IconButton label="Edit vehicle" onClick={() => beginEdit(vehicle)}><Pencil size={17} aria-hidden="true" /></IconButton>
              <IconButton label="Delete vehicle" variant="ghost" onClick={() => setDeleting(vehicle)}><Trash2 size={17} aria-hidden="true" /></IconButton>
            </div>
            {timeline
              .filter((entry) => entry.vehicleId === vehicle.id)
              .slice(0, 3)
              .map((entry) => (
                <div className="timeline-entry" key={entry.id}>
                  <strong>
                    {entry.kind}: {entry.title}
                  </strong>
                  <span>
                    {formatMoney(entry.amount)} · {entry.odometerKm.toLocaleString("en-IN")} km · {entry.happenedOn}
                  </span>
                  <p>{entry.note}</p>
                </div>
              ))}
          </article>
        ))}
      </div>

      <div className="ledger-board" aria-label="Garage running cost ledger">
        {garageCostLedger.map((ledger) => (
          <article className="ledger-card" key={ledger.vehicle.id}>
            <span>{ledger.vehicle.brand}</span>
            <h3>{ledger.vehicle.nickname || ledger.vehicle.model}</h3>
            <div className="ledger-stats">
              <p>
                <strong>{formatMoney(ledger.totalSpend)}</strong>
                <small>Total logged</small>
              </p>
              <p>
                <strong>{ledger.costPerKm === null ? "—" : `${formatMoney(ledger.costPerKm, 2)}/km`}</strong>
                <small>Approx cost/km</small>
              </p>
              <p>
                <strong>{ledger.entryCount}</strong>
                <small>Timeline notes</small>
              </p>
            </div>
            <p>
              {ledger.latestEntry
                ? `Latest: ${ledger.latestEntry.kind.toLowerCase()} · ${ledger.latestEntry.title}`
                : "No timeline spend yet. Add service, repair, tyre, fuel, or insurance notes."}
            </p>
          </article>
        ))}
      </div>

      <div className="insight-grid">
        {garageInsights.map((insight) => (
          <article className={`insight-card ${insight.tone}`} key={insight.id}>
            <span>{insight.tone}</span>
            <h3>{insight.title}</h3>
            <p>{insight.detail}</p>
          </article>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit vehicle" variant="sheet"
        actions={<><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="garage-edit-form" variant="primary">Save changes</Button></>}>
        <form id="garage-edit-form" className="garage-form" onSubmit={saveEdit}>
          {vehicleFields(editDraft, setEditDraft)}
          <TextField label="Registration number (optional)" maxLength={14} value={editRegistration}
            onChange={event => setEditRegistration(event.target.value.toUpperCase())}
            hint="Saved on this device only; never added to your account copy." error={editError || undefined} />
        </form>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete vehicle" variant="dialog"
        actions={<><Button type="button" variant="secondary" onClick={() => setDeleting(null)}>Keep vehicle</Button>
          <Button type="button" variant="primary" onClick={() => { if (deleting) removeVehicle(deleting.id); setDeleting(null); }}>Delete vehicle</Button></>}>
        <p>Maintenance history for this vehicle will also be deleted.</p>
      </Dialog>
    </section>
  );
}
