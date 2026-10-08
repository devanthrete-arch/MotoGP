// Garage: vehicles, maintenance timeline, reminders and running costs.
import { timelineKinds, type TimelineEntryKind } from "../../domain";
import { formatMoney } from "../../insights";
import { brands } from "../model";
import { useOtofolks } from "../state";

export function GarageView() {
  const {
    garage, timeline, vehicleDraft, setVehicleDraft, timelineDraft, setTimelineDraft,
    garageInsights, garageCostLedger, garageReminders, exportGarage, addVehicle, addTimelineNote,
  } = useOtofolks();
  return (
    <section className="panel" id="garage">
      <div className="section-head">
        <div>
          <p className="eyebrow">Garage timeline</p>
          <h2>Your vehicles and maintenance</h2>
        </div>
        <button className="save-button" type="button" onClick={exportGarage}>
          Export garage
        </button>
      </div>
      <div className="garage-grid">
        <form className="composer" onSubmit={addVehicle}>
          <h3>Add vehicle</h3>
          <input
            value={vehicleDraft.nickname}
            onChange={(event) => setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
            placeholder="Nickname"
          />
          <div className="form-row">
            <select value={vehicleDraft.brand} onChange={(event) => setVehicleDraft({ ...vehicleDraft, brand: event.target.value })}>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <input
              required
              value={vehicleDraft.model}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
              placeholder="Model"
            />
          </div>
          <div className="form-row">
            <input
              value={vehicleDraft.variant}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, variant: event.target.value })}
              placeholder="Variant"
            />
            <input
              value={vehicleDraft.city}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, city: event.target.value })}
              placeholder="City"
            />
          </div>
          <div className="form-row">
            <input
              min="0"
              type="number"
              value={vehicleDraft.odometerKm || ""}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, odometerKm: Number(event.target.value) })}
              placeholder="Current odometer"
            />
            <input
              type="month"
              value={vehicleDraft.purchaseMonth}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, purchaseMonth: event.target.value })}
              aria-label="Purchase month"
            />
          </div>
          <button className="primary-action" type="submit">
            Save vehicle
          </button>
        </form>

        <form className="composer" onSubmit={addTimelineNote}>
          <h3>Add timeline note</h3>
          {!garage.length ? <p>Add a vehicle first to record its maintenance.</p> : null}
          <select
            aria-label="Vehicle"
            required
            value={timelineDraft.vehicleId}
            onChange={(event) => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })}
          >
            {garage.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.nickname || vehicle.model}
              </option>
            ))}
          </select>
          <div className="form-row">
            <select
              value={timelineDraft.kind}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })}
            >
              {timelineKinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
            <input
              type="date"
              value={timelineDraft.happenedOn}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })}
              aria-label="Timeline date"
            />
          </div>
          <input
            required
            value={timelineDraft.title}
            onChange={(event) => setTimelineDraft({ ...timelineDraft, title: event.target.value })}
            placeholder="What happened?"
          />
          <div className="form-row">
            <input
              min="0"
              type="number"
              value={timelineDraft.amount || ""}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
              placeholder="Amount paid"
            />
            <input
              min="0"
              type="number"
              value={timelineDraft.odometerKm || ""}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
              placeholder="Odometer"
            />
          </div>
          <textarea
            rows={4}
            value={timelineDraft.note}
            onChange={(event) => setTimelineDraft({ ...timelineDraft, note: event.target.value })}
            placeholder="Bill details, symptoms, shop notes, or what you would do differently."
          />
          <button className="primary-action" type="submit" disabled={!garage.length}>
            Add timeline note
          </button>
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
            <p>
              {vehicle.model} {vehicle.variant} · {vehicle.city} · {vehicle.odometerKm.toLocaleString("en-IN")} km
            </p>
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
    </section>
  );
}
