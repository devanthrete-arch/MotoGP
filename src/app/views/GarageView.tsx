// Garage dashboard: real vehicles, maintenance timeline, reminders and running costs.
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Activity, Bell, CalendarClock, CarFront, Check, CircleAlert, Download, Fuel, Gauge, Plus, ShieldCheck, Wrench, Pencil, Trash2, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { timelineKinds, type DraftVehicle, type GarageVehicle, type TimelineEntryKind } from "../../domain";
import { formatMoney } from "../../insights";
import { PlateInput } from "../../ui/PlateInput";
import { Button, IconButton } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { SelectField, TextAreaField, TextField } from "../../ui/Field";
import { parseRegistration, registrationProblemText } from "../../ui/plate";
import { brands, initialVehicleDraft } from "../model";
import { useOtofolks } from "../state";
import "./GarageView.css";

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
  const [plateChecked, setPlateChecked] = useState(false);
  const plateField = useRef<HTMLInputElement>(null);
  const registration = parseRegistration(plateDraft);
  const plateProblem = plateChecked && plateDraft.trim() && !registration.ok ? registrationProblemText[registration.problem] : undefined;
  const [editing, setEditing] = useState<GarageVehicle | null>(null);
  const [editDraft, setEditDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [editRegistration, setEditRegistration] = useState("");
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState<GarageVehicle | null>(null);
  const recentEntries = useMemo(() => [...timeline].sort((a, b) => b.happenedOn.localeCompare(a.happenedOn)).slice(0, 5), [timeline]);

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
    <TextField label="PUC expiry date (optional)" type="date" value={draft.pucExpiryDate ?? ""}
      onChange={event => change({ ...draft, pucExpiryDate: event.target.value || undefined })}
      hint="Reminder timing uses only the date recorded on your certificate." />
  </>;

  return (
    <section className="garage-page" id="garage" aria-labelledby="garage-page-title">
      <header className="garage-page__heading">
        <div><p className="eyebrow">Otofolks / My Garage</p><h1 id="garage-page-title">My Garage</h1>
          <p className="garage-page__summary">Your vehicles, care reminders and service history in one place.</p></div>
        <div className="garage-page__heading-actions">
          <Button type="button" variant="secondary" icon={<Download size={16} aria-hidden="true" />} onClick={exportGarage}>Export garage</Button>
          <a className="ui-button ui-button--primary" href="#add-vehicle"><Plus size={17} aria-hidden="true" /> Add vehicle</a>
        </div>
      </header>

      <section className="garage-section garage-vehicles" aria-labelledby="garage-vehicles-title">
        <div className="garage-section__head"><div><p className="eyebrow">Your collection</p><h2 id="garage-vehicles-title">Your vehicles</h2></div>
          <span className="garage-count"><span aria-hidden="true" />{garage.length} {garage.length === 1 ? "vehicle" : "vehicles"}</span></div>
        {garage.length ? <div className="garage-vehicle-list">
          {garage.map(vehicle => {
            const ledger = garageCostLedger.find(item => item.vehicle.id === vehicle.id);
            const vehicleEntries = timeline.filter(entry => entry.vehicleId === vehicle.id).sort((a, b) => b.happenedOn.localeCompare(a.happenedOn));
            const vehicleAlerts = garageReminders.filter(item => item.vehicleName === (vehicle.nickname || `${vehicle.brand} ${vehicle.model}`));
            return <article className="garage-vehicle vehicle-card" key={vehicle.id}>
              <div className="garage-vehicle__visual" aria-hidden="true"><CarFront size={52} strokeWidth={1.35} /></div>
              <div className="garage-vehicle__body">
                <div className="garage-vehicle__top"><div><span className="garage-tag">{vehicle.kind === "two-wheeler" ? "Two-wheeler" : "Vehicle"}</span>
                  <h3>{vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}</h3>
                  <p>{[vehicle.manufactureYear, vehicle.brand, vehicle.model, vehicle.variant, vehicle.colour, vehicle.fuel, vehicle.city].filter(Boolean).join(" · ")}</p></div>
                  <div className="garage-vehicle__actions"><IconButton label="Edit vehicle" onClick={() => beginEdit(vehicle)}><Pencil size={17} aria-hidden="true" /></IconButton>
                    <IconButton label="Delete vehicle" variant="ghost" onClick={() => setDeleting(vehicle)}><Trash2 size={17} aria-hidden="true" /></IconButton></div></div>
                <div className="garage-vehicle__metrics">
                  <div><Gauge size={16} aria-hidden="true" /><span>Odometer</span><strong>{vehicle.odometerKm.toLocaleString("en-IN")} km</strong></div>
                  <div><Activity size={16} aria-hidden="true" /><span>Last logged</span><strong>{vehicleEntries[0]?.happenedOn || "No service yet"}</strong></div>
                </div>
                <div className="garage-vehicle__footer"><span className={vehicleAlerts.length ? "garage-status garage-status--alert" : "garage-status"}>
                  {vehicleAlerts.length ? <><CircleAlert size={15} aria-hidden="true" /> {vehicleAlerts.length} care {vehicleAlerts.length === 1 ? "reminder" : "reminders"}</> : <><Check size={15} aria-hidden="true" /> No upcoming alerts</>}
                </span><span>{ledger ? `${formatMoney(ledger.totalSpend)} logged` : "No costs logged"}</span></div>
                {(vehicle.registration || vehiclePlates[vehicle.id]) ? <p className="garage-plate-note"><b>{plateText(vehicle.registration ?? vehiclePlates[vehicle.id])}</b><span>Registration stays on this device</span></p> : null}
              </div>
            </article>;
          })}
        </div> : <div className="garage-empty"><span><CarFront size={24} aria-hidden="true" /></span><div><h3>Your garage starts here</h3><p>Add a car or two-wheeler to track its service history, costs and care reminders.</p></div><a className="ui-button ui-button--primary" href="#add-vehicle"><Plus size={17} aria-hidden="true" /> Add your first vehicle</a></div>}
      </section>

      <nav className="garage-quick-actions" aria-label="Garage quick actions">
        <a href="#timeline-form"><span className="garage-quick-actions__icon garage-quick-actions__icon--fuel"><Fuel size={19} aria-hidden="true" /></span><span><strong>Log fuel or expense</strong><small>Keep running costs up to date</small></span><ArrowRight size={17} aria-hidden="true" /></a>
        <a href="#timeline-form"><span className="garage-quick-actions__icon garage-quick-actions__icon--service"><Wrench size={19} aria-hidden="true" /></span><span><strong>Log service</strong><small>Add work, date and amount</small></span><ArrowRight size={17} aria-hidden="true" /></a>
        <a href="#garage-reminders"><span className="garage-quick-actions__icon garage-quick-actions__icon--reminder"><CalendarClock size={19} aria-hidden="true" /></span><span><strong>View reminders</strong><small>Insurance, PUC and maintenance</small></span><ArrowRight size={17} aria-hidden="true" /></a>
      </nav>

      <div className="garage-dashboard-grid">
        <section className="garage-section garage-reminders" id="garage-reminders" aria-labelledby="garage-reminders-title">
          <div className="garage-section__head"><div><p className="eyebrow">Stay road-ready</p><h2 id="garage-reminders-title"><ShieldCheck size={20} aria-hidden="true" /> Upcoming reminders</h2></div><span className="garage-subtle-count">{garageReminders.length}</span></div>
          {garageReminders.length ? <div className="garage-reminders__list">{garageReminders.map(reminder => <article className={`garage-reminder garage-reminder--${reminder.urgency.toLowerCase()}`} key={reminder.id}>
            <span className="garage-reminder__icon"><Bell size={17} aria-hidden="true" /></span><div><h3>{reminder.title}</h3><p>{reminder.vehicleName} · {reminder.detail}</p></div><span className="garage-reminder__urgency">{reminder.urgency}</span>
          </article>)}</div> : <p className="garage-section__empty">No upcoming reminders. Record service dates or add a PUC expiry to see them here.</p>}
        </section>

        <section className="garage-section garage-costs" id="garage-costs" aria-labelledby="garage-costs-title">
          <div className="garage-section__head"><div><p className="eyebrow">What you have recorded</p><h2 id="garage-costs-title">Running costs</h2></div><Link to="/garage#timeline-form">Add cost <ArrowRight size={15} aria-hidden="true" /></Link></div>
          {garageCostLedger.length ? <div className="garage-costs__list">{garageCostLedger.map(ledger => <article key={ledger.vehicle.id}>
            <div className="garage-costs__vehicle"><span>{ledger.vehicle.nickname || ledger.vehicle.model}</span><strong>{formatMoney(ledger.totalSpend)}</strong></div>
            <div className="garage-costs__track" aria-label={`${ledger.entryCount} entries logged`}><span style={{ width: `${Math.max(8, garageCostLedger.length === 1 ? 100 : Math.round(ledger.totalSpend / Math.max(...garageCostLedger.map(item => item.totalSpend), 1) * 100))}%` }} /></div>
            <small>{ledger.entryCount} {ledger.entryCount === 1 ? "entry" : "entries"}{ledger.costPerKm === null ? " · cost per km unavailable" : ` · ${formatMoney(ledger.costPerKm, 2)}/km`}</small>
          </article>)}</div> : <p className="garage-section__empty">Your running costs will appear after you add an expense to a timeline entry.</p>}
        </section>
      </div>

      <section className="garage-section garage-history timeline-board" aria-labelledby="garage-history-title">
        <div className="garage-section__head"><div><p className="eyebrow">Your records</p><h2 id="garage-history-title">Recent timeline</h2></div><a href="#timeline-form">View all logs <ArrowRight size={15} aria-hidden="true" /></a></div>
        {recentEntries.length ? <ol className="garage-history__list">{recentEntries.map(entry => {
          const vehicle = garage.find(item => item.id === entry.vehicleId);
          return <li key={entry.id}><span className="garage-history__dot" aria-hidden="true" /><div><small>{entry.happenedOn} · {vehicle?.nickname || "Vehicle"} · {entry.odometerKm.toLocaleString("en-IN")} km</small>
            <h3>{entry.title}</h3><p>{entry.note || entry.kind}</p></div><strong>{formatMoney(entry.amount)}</strong></li>;
        })}</ol> : <p className="garage-section__empty">No maintenance entries yet. Use “Log service” to add your first one.</p>}
      </section>

      <section className="garage-health" aria-label="Garage health">
        <span><ShieldCheck size={23} aria-hidden="true" /></span><div><h2>{garage.length ? "Your garage care snapshot" : "A little care goes a long way"}</h2>
          <p>{garageInsights[0]?.detail || "Add your vehicles and their service details to get useful maintenance reminders."}</p></div>
        {garageInsights[0] && <span className={`garage-health__state garage-health__state--${garageInsights[0].tone}`}>{garageInsights[0].tone}</span>}
      </section>

      <div className="garage-forms">
        <form id="add-vehicle" className="composer garage-form" onSubmit={event => {
          const saved = addVehicle(event);
          setPlateChecked(!saved);
          if (!saved) plateField.current?.focus();
        }}>
          <div className="garage-form__heading"><span><Plus size={18} aria-hidden="true" /></span><div><p className="eyebrow">Your garage</p><h2>Add a vehicle</h2></div></div>
          <PlateInput ref={plateField} className="garage-plate" label="Registration number (optional)" value={plateDraft}
            onChange={value => setPlateDraft(value)} error={plateProblem} onBlur={event => setPlateChecked(Boolean(event.target.value.trim()))}
            hint="Kept on this device only. It is not saved to your account copy and is not looked up." />
          {vehicleFields(vehicleDraft, setVehicleDraft)}
          <Button type="submit" variant="primary" fullWidth>Save vehicle</Button>
        </form>

        <form id="timeline-form" className="composer garage-form" onSubmit={addTimelineNote}>
          <div className="garage-form__heading"><span><Wrench size={18} aria-hidden="true" /></span><div><p className="eyebrow">Keep a record</p><h2>Log maintenance or a cost</h2></div></div>
          {!garage.length ? <p>Add a vehicle first to record its maintenance.</p> : null}
          <SelectField label="Vehicle" required options={garage.map(vehicle => ({ value: vehicle.id, label: vehicle.nickname || `${vehicle.brand} ${vehicle.model}` }))}
            value={timelineDraft.vehicleId} disabled={!garage.length} onChange={event => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })} />
          <div className="garage-form__row"><SelectField label="Entry type" options={timelineKinds} value={timelineDraft.kind}
            onChange={event => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })} />
            <TextField label="Date" type="date" value={timelineDraft.happenedOn} onChange={event => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })} /></div>
          <TextField label="What happened?" required maxLength={160} value={timelineDraft.title}
            onChange={event => setTimelineDraft({ ...timelineDraft, title: event.target.value })} placeholder="Service, fuel, repair..." />
          <div className="garage-form__row"><TextField label="Amount paid" min="0" type="number" value={timelineDraft.amount || ""} placeholder="Amount paid"
            onChange={event => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })} />
            <TextField label="Odometer (km)" min="0" type="number" value={timelineDraft.odometerKm || ""} onChange={event => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })} /></div>
          <TextAreaField label="Details" rows={4} maxLength={10000} value={timelineDraft.note}
            onChange={event => setTimelineDraft({ ...timelineDraft, note: event.target.value })} placeholder="Bill details, symptoms, shop notes, or what you would do differently." />
          <Button type="submit" variant="primary" fullWidth disabled={!garage.length}>Add timeline note</Button>
        </form>
      </div>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit vehicle" variant="sheet"
        actions={<><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="garage-edit-form" variant="primary">Save changes</Button></>}>
        <form id="garage-edit-form" className="garage-form" onSubmit={saveEdit}>{vehicleFields(editDraft, setEditDraft)}
          <TextField label="Registration number (optional)" maxLength={14} value={editRegistration} onChange={event => setEditRegistration(event.target.value.toUpperCase())}
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
