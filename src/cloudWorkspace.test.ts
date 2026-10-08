import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCloudWorkspace, parsePrivateWorkspace, saveCloudWorkspace, type PrivateWorkspace } from "./cloudWorkspace";
import { createClerkSupabaseClient, sessionTokenGetter } from "./supabase";

export const fixture: PrivateWorkspace = {
  version: 2, profile: { displayName: "Owner", city: "Delhi", garageRole: "Owner" },
  garage: [{ id: "car", nickname: "Family car", brand: "Tata", model: "Nexon", variant: "Smart", city: "Delhi", odometerKm: 400, purchaseMonth: "2025-03" }],
  timeline: [{ id: "service", vehicleId: "car", kind: "Service", title: "Oil", amount: 3000, odometerKm: 400, happenedOn: "2026-10-05", note: "Filter too" }],
  shortlist: [{ id: "choice", brand: "Tata", model: "Punch", budget: 900000, status: "Test drive", notes: "Quote", variant: "Pure", state: "Delhi", priceSource: "Dealer quote" }],
  follows: { models: ["Tata Nexon"], topics: ["Fix"] }, saved: ["example-post"],
};
const owner = "user_owner";
const client = () => createClerkSupabaseClient({ url: "https://example.supabase.co", publishableKey: "sb_publishable_fixture" }, async () => "test-token");
const row = () => ({ user_id: owner, payload: structuredClone(fixture), revision: 1, updated_at: "2026-10-05T10:00:00Z" });
const reply = (data: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })));
afterEach(() => vi.unstubAllGlobals());

describe("private workspace decoding", () => {
  it("preserves all private fields without publishing drafts", () => {
    expect(parsePrivateWorkspace(fixture)).toEqual(fixture);
    const legacy = parsePrivateWorkspace({ ...fixture, version: 1, garage: [{ ...fixture.garage[0], kind: undefined, catalogueId: undefined }] });
    expect(legacy.version).toBe(2);
    const expanded = parsePrivateWorkspace({ ...fixture, garage: [{ ...fixture.garage[0], kind: "car", catalogueId: "car:tata:nexon", colour: "White", fuel: "Petrol", manufactureYear: 2022, registration: "MH12AB1234" }] });
    expect(expanded.garage[0]).toMatchObject({ kind: "car", catalogueId: "car:tata:nexon", colour: "White", fuel: "Petrol", manufactureYear: 2022 });
    expect(JSON.stringify(expanded)).not.toContain("MH12AB1234");
    expect(() => parsePrivateWorkspace({ ...fixture, posts: [] })).toThrow();
    // A registration number stays on the device: even if one were put on a vehicle, it is not uploaded.
    const withNumber = { ...fixture, garage: fixture.garage.map((vehicle) => ({ ...vehicle, registration: "MH12AB1234" })) };
    expect(parsePrivateWorkspace(withNumber)).toEqual(fixture);
    expect(JSON.stringify(parsePrivateWorkspace(withNumber))).not.toContain("MH12AB1234");
  });
  it.each([
    { ...fixture, version: 3 }, { ...fixture, timeline: undefined },
    { ...fixture, garage: [...fixture.garage, ...fixture.garage] },
    { ...fixture, timeline: [{ ...fixture.timeline[0], vehicleId: "someone-else" }] },
    { ...fixture, timeline: [{ ...fixture.timeline[0], happenedOn: "2026-02-30" }] },
    { ...fixture, timeline: [{ ...fixture.timeline[0], happenedOn: "0000-01-01" }] },
    { ...fixture, garage: [{ ...fixture.garage[0], purchaseMonth: "0000-01" }] },
    { ...fixture, shortlist: [{ ...fixture.shortlist[0], status: "Old unknown status" }] },
    { ...fixture, shortlist: [{ ...fixture.shortlist[0], budget: -1 }] },
    { ...fixture, profile: { ...fixture.profile, displayName: 42 } },
  ])("rejects partial or malformed state before restore", value => expect(() => parsePrivateWorkspace(value)).toThrow());
  it("rejects a snapshot whose jsonb representation can exceed the database limit", () => {
    const garage = Array.from({ length: 4400 }, (_, index) => ({ ...fixture.garage[0], id: `car-${index}`, nickname: "Family car ".repeat(5) }));
    const value = { ...fixture, garage, timeline: [] };
    expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThan(1_000_000);
    expect(() => parsePrivateWorkspace(value)).toThrow("unsupported format");
  });
});

describe("cloud protocol", () => {
  it("reads only the requested owner and treats an absent record as absent", async () => {
    reply([]);
    expect(await loadCloudWorkspace(client(), owner)).toBeNull();
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("user_id=eq.user_owner");
  });
  it("does not turn a failed read into an empty workspace", async () => {
    reply({ code: "PGRST205" }, 404);
    await expect(loadCloudWorkspace(client(), owner)).rejects.toThrow("not set up");
  });
  it("rejects another owner's response", async () => {
    reply([{ ...row(), user_id: "user_other" }]);
    await expect(loadCloudWorkspace(client(), owner)).rejects.toThrow("unsupported");
  });
  it("saves with an expected revision and never accepts caller-controlled ownership", async () => {
    reply(row());
    expect((await saveCloudWorkspace(client(), owner, fixture, 0)).revision).toBe(1);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toEqual({ p_payload: fixture, p_expected_revision: 0 });
  });
  it("surfaces stale-device conflicts without retrying an overwrite", async () => {
    reply({ code: "40001" }, 409);
    await expect(saveCloudWorkspace(client(), owner, fixture, 1)).rejects.toThrow("another device");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("session binding", () => {
  it("rejects a different user before obtaining a token", async () => {
    const session = { id: "session_A", user: { id: "user_A" }, getToken: vi.fn(async () => "token_A") };
    const getToken = sessionTokenGetter(session, () => ({ ...session, id: "session_B", user: { id: "user_B" } }));
    await expect(getToken()).rejects.toThrow("sign-in changed");
    expect(session.getToken).not.toHaveBeenCalled();
  });
  it("rejects sign-out during token refresh", async () => {
    let resolve!: (token: string) => void;
    const session = { id: "session_A", user: { id: "user_A" }, getToken: () => new Promise<string>(done => { resolve = done; }) };
    let active: typeof session | null = session;
    const pending = sessionTokenGetter(session, () => active)();
    active = null;
    resolve("token_A");
    await expect(pending).rejects.toThrow("sign-in changed");
  });
});
